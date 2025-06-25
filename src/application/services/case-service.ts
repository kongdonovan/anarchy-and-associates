import { 
  Case, 
  CaseStatus, 
  CasePriority,
  CaseResult,
  CaseCreationRequest, 
  CaseAssignmentRequest,
  CaseClosureRequest,
  CaseUpdateRequest,
  CaseDocument,
  CaseNote,
  generateCaseNumber,
  generateChannelName
} from '../../domain/entities/case';
import { CaseRepository, CaseSearchFilters, CaseSortOptions, CasePaginationOptions } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { BusinessRuleValidationService } from './business-rule-validation-service';
import { logger } from '../../infrastructure/logger';
import { randomUUID } from 'crypto';
import { Client, CategoryChannel, ChannelType, PermissionFlagsBits, TextChannel, Guild } from 'discord.js';
import { CaseChannelArchiveService } from './case-channel-archive-service';

export class CaseService {
  private archiveService?: CaseChannelArchiveService;

  constructor(
    private caseRepository: CaseRepository,
    private caseCounterRepository: CaseCounterRepository,
    private guildConfigRepository: GuildConfigRepository,
    private permissionService: PermissionService,
    private businessRuleValidationService: BusinessRuleValidationService,
    private discordClient?: Client
  ) {
    // Initialize archive service if we have required dependencies
    if (this.permissionService && this.businessRuleValidationService) {
      this.initializeArchiveService();
    }
  }

  private initializeArchiveService(): void {
    try {
      // Import audit log repository
      const { AuditLogRepository } = require('../../infrastructure/repositories/audit-log-repository');
      const auditLogRepository = new AuditLogRepository();

      this.archiveService = new CaseChannelArchiveService(
        this.caseRepository,
        this.guildConfigRepository,
        auditLogRepository,
        this.permissionService,
        this.businessRuleValidationService
      );
    } catch (error) {
      logger.warn('Failed to initialize archive service:', error);
    }
  }

  public async createCase(context: PermissionContext, request: CaseCreationRequest): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to create cases');
    }

    // Validate client case limits (5 active cases max per client)
    const caseLimitValidation = await this.validateClientCaseLimits(
      request.clientId,
      request.guildId
    );
    
    if (!caseLimitValidation.valid) {
      const errorMessage = caseLimitValidation.errors.join(', ');
      logger.warn('Case creation blocked due to client case limit', {
        clientId: request.clientId,
        guildId: request.guildId,
        errors: caseLimitValidation.errors
      });
      throw new Error(errorMessage);
    }

    // Log warnings if client is approaching limit
    if (caseLimitValidation.warnings.length > 0) {
      logger.warn('Client approaching case limit', {
        clientId: request.clientId,
        warnings: caseLimitValidation.warnings
      });
    }

    logger.info('Creating new case', {
      guildId: request.guildId,
      clientId: request.clientId,
      title: request.title,
      clientCurrentCases: caseLimitValidation.currentCases
    });

    // Generate sequential case number
    const caseCount = await this.caseCounterRepository.getNextCaseNumber(request.guildId);
    const currentYear = new Date().getFullYear();
    const caseNumber = generateCaseNumber(currentYear, caseCount, request.clientUsername);

    const caseData: Omit<Case, '_id' | 'createdAt' | 'updatedAt'> = {
      guildId: request.guildId,
      caseNumber,
      clientId: request.clientId,
      clientUsername: request.clientUsername,
      title: request.title,
      description: request.description,
      status: CaseStatus.PENDING,
      priority: request.priority || CasePriority.MEDIUM,
      assignedLawyerIds: [],
      documents: [],
      notes: []
    };

    const createdCase = await this.caseRepository.add(caseData);
    
    logger.info('Case created successfully', {
      caseId: createdCase._id,
      caseNumber: createdCase.caseNumber,
      clientId: request.clientId
    });

    return createdCase;
  }

  public async assignLawyer(context: PermissionContext, request: CaseAssignmentRequest): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to assign lawyers to cases');
    }

    // Validate that the lawyer being assigned has the required permissions
    const lawyerValidation = await this.validateLawyerPermissions(
      context.guildId,
      request.lawyerId,
      'lawyer'
    );

    if (!lawyerValidation.valid) {
      const errorMessage = `User cannot be assigned to case: ${lawyerValidation.errors.join(', ')}`;
      logger.warn('Lawyer assignment blocked due to insufficient permissions', {
        caseId: request.caseId,
        lawyerId: request.lawyerId,
        assignedBy: request.assignedBy,
        errors: lawyerValidation.errors
      });
      throw new Error(errorMessage);
    }

    logger.info('Assigning lawyer to case', {
      caseId: request.caseId,
      lawyerId: request.lawyerId,
      assignedBy: request.assignedBy
    });

    const updatedCase = await this.caseRepository.assignLawyer(request.caseId, request.lawyerId);
    
    if (!updatedCase) {
      throw new Error('Case not found or assignment failed');
    }

    logger.info('Lawyer assigned successfully', {
      caseId: request.caseId,
      lawyerId: request.lawyerId,
      isLeadAttorney: updatedCase.leadAttorneyId === request.lawyerId
    });

    return updatedCase;
  }

  public async unassignLawyer(context: PermissionContext, caseId: string, lawyerId: string): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to unassign lawyers from cases');
    }

    logger.info('Unassigning lawyer from case', { caseId, lawyerId });

    const updatedCase = await this.caseRepository.unassignLawyer(caseId, lawyerId);
    
    if (!updatedCase) {
      throw new Error('Case not found or unassignment failed');
    }

    logger.info('Lawyer unassigned successfully', { caseId, lawyerId });
    return updatedCase;
  }

  public async reassignLawyer(context: PermissionContext, fromCaseId: string, toCaseId: string, lawyerId: string): Promise<{
    fromCase: Case | null;
    toCase: Case | null;
  }> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to reassign lawyers between cases');
    }

    logger.info('Reassigning lawyer between cases', { fromCaseId, toCaseId, lawyerId });

    const result = await this.caseRepository.reassignLawyer(fromCaseId, toCaseId, lawyerId);
    
    if (!result.fromCase || !result.toCase) {
      throw new Error('One or both cases not found, or reassignment failed');
    }

    logger.info('Lawyer reassigned successfully', { fromCaseId, toCaseId, lawyerId });
    return result;
  }

  public async updateCaseStatus(context: PermissionContext, caseId: string, status: CaseStatus): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to update case status');
    }

    logger.info('Updating case status', { caseId, status, updatedBy: context.userId });

    const updatedCase = await this.caseRepository.update(caseId, { status });
    
    if (!updatedCase) {
      throw new Error('Case not found or status update failed');
    }

    logger.info('Case status updated successfully', { caseId, status });
    return updatedCase;
  }

  public async closeCase(context: PermissionContext, request: CaseClosureRequest): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to close cases');
    }

    logger.info('Closing case', {
      caseId: request.caseId,
      result: request.result,
      closedBy: request.closedBy
    });

    // Use atomic conditional update to ensure only open/in-progress cases can be closed
    // This prevents race conditions by checking and updating in a single operation
    const updatedCase = await this.caseRepository.conditionalUpdate(
      request.caseId,
      { 
        status: CaseStatus.IN_PROGRESS
      } as any, // MongoDB query for "status is IN_PROGRESS"
      {
        status: CaseStatus.CLOSED,
        result: request.result,
        resultNotes: request.resultNotes,
        closedAt: new Date(),
        closedBy: request.closedBy
      }
    );

    if (!updatedCase) {
      // Check if case exists but is not in closable state
      const existingCase = await this.caseRepository.findById(request.caseId);
      if (!existingCase) {
        throw new Error('Case not found');
      } else {
        throw new Error(`Case cannot be closed - current status: ${existingCase.status}`);
      }
    }

    logger.info('Case closed successfully', {
      caseId: request.caseId,
      result: request.result
    });

    // Optionally archive the case channel if Discord client and archive service are available
    if (this.discordClient && this.archiveService && updatedCase.channelId) {
      try {
        const guild = this.discordClient.guilds.cache.get(updatedCase.guildId);
        if (guild) {
          // Note: We don't await this to avoid blocking the case closure
          // The channel will be archived in the background
          this.archiveService.archiveCaseChannel(guild, updatedCase, context)
            .then(result => {
              if (result.success) {
                logger.info('Case channel archived successfully after case closure', {
                  caseId: request.caseId,
                  channelId: result.channelId,
                  archiveCategoryId: result.archiveCategoryId
                });
              } else {
                logger.warn('Failed to archive case channel after closure', {
                  caseId: request.caseId,
                  channelId: result.channelId,
                  error: result.error
                });
              }
            })
            .catch(error => {
              logger.error('Error archiving case channel after closure:', {
                caseId: request.caseId,
                channelId: updatedCase.channelId,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            });
        }
      } catch (error) {
        logger.warn('Failed to initiate case channel archiving after closure:', error);
      }
    }

    return updatedCase;
  }

  public async setLeadAttorney(context: PermissionContext, caseId: string, newLeadAttorneyId: string): Promise<Case> {
    // Check lead-attorney permission (updated to use new permission system)
    const hasPermission = await this.permissionService.hasLeadAttorneyPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to set lead attorney');
    }

    // Validate that the new lead attorney has the required permissions
    const leadAttorneyValidation = await this.validateLawyerPermissions(
      context.guildId,
      newLeadAttorneyId,
      'lead-attorney'
    );

    if (!leadAttorneyValidation.valid) {
      const errorMessage = `User cannot be assigned as lead attorney: ${leadAttorneyValidation.errors.join(', ')}`;
      logger.warn('Lead attorney assignment blocked due to insufficient permissions', {
        caseId,
        newLeadAttorneyId,
        changedBy: context.userId,
        errors: leadAttorneyValidation.errors
      });
      throw new Error(errorMessage);
    }

    logger.info('Setting lead attorney for case', { 
      caseId, 
      newLeadAttorneyId, 
      changedBy: context.userId 
    });

    const existingCase = await this.caseRepository.findById(caseId);
    if (!existingCase) {
      throw new Error('Case not found');
    }

    // Ensure the new lead attorney is in the assigned lawyers list
    const assignedLawyerIds = existingCase.assignedLawyerIds.includes(newLeadAttorneyId)
      ? existingCase.assignedLawyerIds
      : [...existingCase.assignedLawyerIds, newLeadAttorneyId];

    const updatedCase = await this.caseRepository.update(caseId, {
      leadAttorneyId: newLeadAttorneyId,
      assignedLawyerIds
    });

    if (!updatedCase) {
      throw new Error('Failed to update lead attorney');
    }

    // Update case channel permissions if channel exists and Discord client is available
    if (this.discordClient && updatedCase.channelId && updatedCase.guildId) {
      try {
        await this.updateCaseChannelPermissions(updatedCase);
        logger.info('Case channel permissions updated for new lead attorney', { 
          caseId, 
          channelId: updatedCase.channelId,
          newLeadAttorneyId 
        });
      } catch (error) {
        logger.warn('Failed to update case channel permissions', { 
          caseId, 
          channelId: updatedCase.channelId,
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    logger.info('Lead attorney updated successfully', {
      caseId,
      previousLeadAttorney: existingCase.leadAttorneyId,
      newLeadAttorney: newLeadAttorneyId,
      changedBy: context.userId
    });

    return updatedCase;
  }

  private async updateCaseChannelPermissions(caseData: Case): Promise<void> {
    if (!this.discordClient || !caseData.channelId) {
      return;
    }

    const guild = this.discordClient.guilds.cache.get(caseData.guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    const channel = guild.channels.cache.get(caseData.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Case channel not found');
    }

    // Only update topic and permissions for text channels (not threads)
    if (channel.type === ChannelType.GuildText) {
      const textChannel = channel as TextChannel;
      
      // Update channel topic with new lead attorney
      const topic = `Case: ${caseData.title} | Client: ${caseData.clientUsername} | Lead: <@${caseData.leadAttorneyId || 'TBD'}>`;
      await textChannel.setTopic(topic);

      // Validate assigned lawyers have proper permissions before updating
      const validatedLawyers: string[] = [];
      for (const lawyerId of caseData.assignedLawyerIds) {
        try {
          const validation = await this.validateLawyerPermissions(caseData.guildId, lawyerId, 'lawyer');
          if (validation.valid) {
            validatedLawyers.push(lawyerId);
          } else {
            logger.warn('Removing invalid lawyer from case channel permissions during update', {
              caseId: caseData._id,
              lawyerId,
              errors: validation.errors
            });
            // Remove permissions for invalid lawyers
            await textChannel.permissionOverwrites.delete(lawyerId);
          }
        } catch (error) {
          logger.warn('Failed to validate lawyer permissions for channel update', {
            caseId: caseData._id,
            lawyerId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Update permissions for validated lawyers only
      for (const lawyerId of validatedLawyers) {
        await textChannel.permissionOverwrites.edit(lawyerId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          ManageMessages: true
        });
      }

      // Ensure staff roles maintain their permissions
      const staffRolePermissions = await this.getStaffRolePermissions(guild);
      for (const staffPermission of staffRolePermissions) {
        await textChannel.permissionOverwrites.edit(staffPermission.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          ManageMessages: true,
          ManageThreads: true
        });
      }

      logger.info('Case channel permissions updated with validation', {
        caseId: caseData._id,
        channelId: caseData.channelId,
        validatedLawyers: validatedLawyers.length,
        totalAssignedLawyers: caseData.assignedLawyerIds.length,
        staffRolesUpdated: staffRolePermissions.length
      });
    }
  }

  public async updateCase(context: PermissionContext, request: CaseUpdateRequest): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to update cases');
    }
    const updates: Partial<Case> = {};
    
    if (request.title !== undefined) updates.title = request.title;
    if (request.description !== undefined) updates.description = request.description;
    if (request.priority !== undefined) updates.priority = request.priority;
    if (request.status !== undefined) updates.status = request.status;

    const updatedCase = await this.caseRepository.update(request.caseId, updates);
    
    if (!updatedCase) {
      throw new Error('Case not found or update failed');
    }

    return updatedCase;
  }

  public async addDocument(context: PermissionContext, caseId: string, title: string, content: string): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to add documents to cases');
    }
    const document: CaseDocument = {
      id: randomUUID(),
      title,
      content,
      createdBy: context.userId,
      createdAt: new Date()
    };

    const updatedCase = await this.caseRepository.addDocument(caseId, document);
    
    if (!updatedCase) {
      throw new Error('Case not found or document addition failed');
    }

    logger.info('Document added to case', { caseId, documentId: document.id, title });
    return updatedCase;
  }

  public async addNote(context: PermissionContext, caseId: string, content: string, isInternal = false): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to add notes to cases');
    }
    const note: CaseNote = {
      id: randomUUID(),
      content,
      createdBy: context.userId,
      createdAt: new Date(),
      isInternal
    };

    const updatedCase = await this.caseRepository.addNote(caseId, note);
    
    if (!updatedCase) {
      throw new Error('Case not found or note addition failed');
    }

    logger.info('Note added to case', { caseId, noteId: note.id, isInternal });
    return updatedCase;
  }

  public async searchCases(
    context: PermissionContext,
    filters: CaseSearchFilters,
    sort?: CaseSortOptions,
    pagination?: CasePaginationOptions
  ): Promise<Case[]> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to search cases');
    }

    return this.caseRepository.searchCases(filters, sort, pagination);
  }

  public async getCaseById(context: PermissionContext, caseId: string): Promise<Case | null> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to view case details');
    }

    return this.caseRepository.findById(caseId);
  }

  public async getCaseByCaseNumber(context: PermissionContext, caseNumber: string): Promise<Case | null> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to view case details');
    }

    return this.caseRepository.findByCaseNumber(caseNumber);
  }

  public async getCasesByClient(context: PermissionContext, clientId: string): Promise<Case[]> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to view client cases');
    }

    return this.caseRepository.findByClient(clientId);
  }

  public async getCasesByLawyer(context: PermissionContext, lawyerId: string): Promise<Case[]> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to view lawyer cases');
    }

    return this.caseRepository.findByLawyer(lawyerId);
  }

  public async getActiveCases(context: PermissionContext): Promise<Case[]> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to view active cases');
    }

    return this.caseRepository.getActiveCases(context.guildId);
  }

  public async getPendingCases(context: PermissionContext): Promise<Case[]> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to view pending cases');
    }

    return this.caseRepository.getPendingCases(context.guildId);
  }

  public async getCaseStats(context: PermissionContext): Promise<{
    total: number;
    pending: number;
    open: number;
    inProgress: number;
    closed: number;
    wins: number;
    losses: number;
    settlements: number;
  }> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to view case statistics');
    }

    return this.caseRepository.getCaseStats(context.guildId);
  }

  public async getCaseReviewCategoryId(guildId: string): Promise<string | null> {
    const config = await this.guildConfigRepository.findByGuildId(guildId);
    return config?.caseReviewCategoryId || null;
  }

  public async getCaseArchiveCategoryId(guildId: string): Promise<string | null> {
    const config = await this.guildConfigRepository.findByGuildId(guildId);
    return config?.caseArchiveCategoryId || null;
  }

  public generateChannelName(caseNumber: string): string {
    return generateChannelName(caseNumber);
  }

  public async acceptCase(context: PermissionContext, caseId: string): Promise<Case> {
    // Check lead-attorney permission (since accepting a case makes you the lead attorney)
    const hasPermission = await this.permissionService.hasLeadAttorneyPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to accept cases as lead attorney');
    }

    logger.info('Accepting case', { caseId, acceptedBy: context.userId });

    // First, get the case to access its details for channel creation
    const existingCase = await this.caseRepository.findById(caseId);
    if (!existingCase) {
      throw new Error('Case not found');
    }

    if (existingCase.status !== CaseStatus.PENDING) {
      throw new Error(`Case cannot be accepted - current status: ${existingCase.status}`);
    }

    let channelId: string | undefined;

    // Create case channel if Discord client is available
    if (this.discordClient && existingCase.guildId) {
      try {
        channelId = await this.createCaseChannel(existingCase);
        logger.info('Case channel created', { caseId, channelId });
      } catch (error) {
        logger.warn('Failed to create case channel, proceeding without channel', { 
          caseId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // Use atomic conditional update to ensure only pending cases can be accepted
    // This prevents race conditions by checking and updating in a single operation
    const updatedCase = await this.caseRepository.conditionalUpdate(
      caseId,
      { status: CaseStatus.PENDING }, // Only update if status is PENDING
      {
        status: CaseStatus.IN_PROGRESS,
        leadAttorneyId: context.userId,
        assignedLawyerIds: [context.userId],
        ...(channelId && { channelId })
      }
    );

    if (!updatedCase) {
      // Check if case exists but is not pending (race condition)
      const recheckCase = await this.caseRepository.findById(caseId);
      if (!recheckCase) {
        throw new Error('Case not found');
      } else {
        throw new Error(`Case cannot be accepted - current status: ${recheckCase.status}`);
      }
    }

    logger.info('Case accepted successfully', {
      caseId,
      acceptedBy: context.userId,
      leadAttorney: context.userId,
      channelId: updatedCase.channelId
    });

    return updatedCase;
  }

  private async createCaseChannel(caseData: Case): Promise<string> {
    if (!this.discordClient) {
      throw new Error('Discord client not available');
    }

    const guild = this.discordClient.guilds.cache.get(caseData.guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    // Validate bot permissions for channel creation
    const botMember = guild.members.me;
    if (!botMember) {
      throw new Error('Bot member not found in guild');
    }

    const requiredPermissions = [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageMessages
    ];

    const hasRequiredPermissions = botMember.permissions.has(requiredPermissions);
    if (!hasRequiredPermissions) {
      logger.error('Bot lacks required permissions for channel creation', {
        guildId: caseData.guildId,
        caseId: caseData._id,
        requiredPermissions: requiredPermissions.map(p => p.toString())
      });
      throw new Error('Bot does not have required permissions to create case channels');
    }

    // Generate channel name from case number
    const channelName = generateChannelName(caseData.caseNumber);

    // Try to find the "Cases" category or create the channel in the first available category
    let parentCategory: CategoryChannel | null = null;
    const categories = guild.channels.cache.filter(channel => 
      channel.type === ChannelType.GuildCategory && 
      channel.name.toLowerCase().includes('case')
    );

    if (categories.size > 0) {
      parentCategory = categories.first() as CategoryChannel;
    }

    // Validate assigned lawyers have proper permissions
    const validatedLawyers: string[] = [];
    for (const lawyerId of caseData.assignedLawyerIds) {
      try {
        const validation = await this.validateLawyerPermissions(caseData.guildId, lawyerId, 'lawyer');
        if (validation.valid) {
          validatedLawyers.push(lawyerId);
        } else {
          logger.warn('Removing invalid lawyer from case channel permissions', {
            caseId: caseData._id,
            lawyerId,
            errors: validation.errors
          });
        }
      } catch (error) {
        logger.warn('Failed to validate lawyer permissions for channel creation', {
          caseId: caseData._id,
          lawyerId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Get staff roles for automatic channel access
    const staffRolePermissions = await this.getStaffRolePermissions(guild);

    // Create the case channel with enhanced permission validation
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentCategory?.id,
      topic: `Case: ${caseData.title} | Client: ${caseData.clientUsername} | Lead: <@${caseData.leadAttorneyId || 'TBD'}>`,
      permissionOverwrites: [
        // Deny everyone by default
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        // Allow client access
        {
          id: caseData.clientId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ],
        },
        // Add permissions for validated lawyers only
        ...validatedLawyers.map(lawyerId => ({
          id: lawyerId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages
          ],
        })),
        // Add staff role permissions
        ...staffRolePermissions
      ],
    });

    logger.info('Case channel created successfully with enhanced permissions', {
      caseId: caseData._id,
      channelId: channel.id,
      channelName,
      guildId: caseData.guildId,
      clientId: caseData.clientId,
      validatedLawyers: validatedLawyers.length,
      totalAssignedLawyers: caseData.assignedLawyerIds.length,
      staffRolesAdded: staffRolePermissions.length,
      categoryId: parentCategory?.id
    });

    return channel.id;
  }

  public async declineCase(context: PermissionContext, caseId: string, reason?: string): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to decline cases');
    }

    logger.info('Declining case', { caseId, declinedBy: context.userId, reason });

    // For now, we'll set status to closed with a specific result
    // In a more complex system, you might want a separate "declined" status
    const updatedCase = await this.caseRepository.update(caseId, {
      status: CaseStatus.CLOSED,
      result: CaseResult.DISMISSED,
      resultNotes: reason || 'Case declined by staff',
      closedAt: new Date(),
      closedBy: context.userId
    });

    if (!updatedCase) {
      throw new Error('Case not found or decline failed');
    }

    logger.info('Case declined successfully', { caseId, declinedBy: context.userId });
    return updatedCase;
  }

  /**
   * Helper method to validate that a user has the required permissions to be assigned to a case
   */
  private async validateLawyerPermissions(
    guildId: string, 
    userId: string, 
    requiredPermission: 'lawyer' | 'lead-attorney'
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const userContext: PermissionContext = {
        guildId,
        userId,
        userRoles: [], // Will be populated by the validation service
        isGuildOwner: false // Will be checked by the validation service
      };

      const validation = await this.businessRuleValidationService.validatePermission(
        userContext, 
        requiredPermission
      );

      return {
        valid: validation.valid,
        errors: validation.errors
      };
    } catch (error) {
      logger.error('Error validating lawyer permissions:', error);
      return {
        valid: false,
        errors: ['Failed to validate lawyer permissions']
      };
    }
  }

  /**
   * Helper method to validate client case limits
   */
  private async validateClientCaseLimits(
    clientId: string, 
    guildId: string
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[]; currentCases?: number }> {
    try {
      const validation = await this.businessRuleValidationService.validateClientCaseLimit(
        clientId,
        guildId
      );

      return {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        currentCases: validation.currentCases
      };
    } catch (error) {
      logger.error('Error validating client case limits:', error);
      return {
        valid: false,
        errors: ['Failed to validate client case limits'],
        warnings: [],
        currentCases: 0
      };
    }
  }

  /**
   * Get staff role permissions for case channels
   * Senior staff (Managing Partner, Senior Partner) get full access to case channels
   */
  private async getStaffRolePermissions(guild: any): Promise<Array<{
    id: string;
    allow: bigint[];
  }>> {
    try {
      const staffRolePermissions: Array<{ id: string; allow: bigint[] }> = [];
      
      // Define staff roles that should have access to case channels
      const staffRoleNames = [
        'Managing Partner',
        'Senior Partner', 
        'Junior Partner'
      ];

      // Find staff roles in the guild
      for (const roleName of staffRoleNames) {
        const role = guild.roles.cache.find((r: any) => r.name === roleName);
        if (role) {
          staffRolePermissions.push({
            id: role.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.ManageThreads
            ]
          });
        }
      }

      logger.debug('Added staff role permissions to case channel', {
        guildId: guild.id,
        staffRolesFound: staffRolePermissions.length,
        staffRoleIds: staffRolePermissions.map(p => p.id)
      });

      return staffRolePermissions;
    } catch (error) {
      logger.error('Error getting staff role permissions:', error);
      return [];
    }
  }

  /**
   * Archive a specific case channel
   */
  public async archiveCaseChannel(
    context: PermissionContext, 
    caseId: string
  ): Promise<{ success: boolean; message: string; channelId?: string }> {
    try {
      if (!this.discordClient || !this.archiveService) {
        return {
          success: false,
          message: 'Archive service not available'
        };
      }

      // Get case data
      const caseData = await this.caseRepository.findById(caseId);
      if (!caseData) {
        return {
          success: false,
          message: 'Case not found'
        };
      }

      if (!caseData.channelId) {
        return {
          success: false,
          message: 'Case has no associated channel'
        };
      }

      // Get guild
      const guild = this.discordClient.guilds.cache.get(caseData.guildId);
      if (!guild) {
        return {
          success: false,
          message: 'Guild not found'
        };
      }

      // Archive the channel
      const result = await this.archiveService.archiveCaseChannel(guild, caseData, context);
      
      return {
        success: result.success,
        message: result.success 
          ? `Channel archived successfully: ${result.channelName}`
          : `Archive failed: ${result.error}`,
        channelId: result.channelId
      };
    } catch (error) {
      logger.error('Error in archiveCaseChannel:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Archive all closed case channels in a guild
   */
  public async archiveAllClosedCaseChannels(
    context: PermissionContext
  ): Promise<{ success: boolean; message: string; archivedCount: number; failedCount: number }> {
    try {
      if (!this.discordClient || !this.archiveService) {
        return {
          success: false,
          message: 'Archive service not available',
          archivedCount: 0,
          failedCount: 0
        };
      }

      // Get guild
      const guild = this.discordClient.guilds.cache.get(context.guildId);
      if (!guild) {
        return {
          success: false,
          message: 'Guild not found',
          archivedCount: 0,
          failedCount: 0
        };
      }

      // Archive all closed case channels
      const results = await this.archiveService.archiveClosedCaseChannels(guild, context);
      
      const archivedCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      
      return {
        success: true,
        message: `Archive process completed. ${archivedCount} channels archived, ${failedCount} failed.`,
        archivedCount,
        failedCount
      };
    } catch (error) {
      logger.error('Error in archiveAllClosedCaseChannels:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        archivedCount: 0,
        failedCount: 0
      };
    }
  }

  /**
   * Find and optionally clean up orphaned case channels
   */
  public async findOrphanedCaseChannels(
    context: PermissionContext
  ): Promise<{ 
    success: boolean; 
    message: string; 
    orphanedChannels: Array<{
      channelId: string;
      channelName: string;
      inactiveDays: number;
      shouldArchive: boolean;
    }>;
  }> {
    try {
      if (!this.discordClient || !this.archiveService) {
        return {
          success: false,
          message: 'Archive service not available',
          orphanedChannels: []
        };
      }

      // Get guild
      const guild = this.discordClient.guilds.cache.get(context.guildId);
      if (!guild) {
        return {
          success: false,
          message: 'Guild not found',
          orphanedChannels: []
        };
      }

      // Find orphaned channels
      const orphanedChannels = await this.archiveService.findOrphanedCaseChannels(guild, context);
      
      return {
        success: true,
        message: `Found ${orphanedChannels.length} orphaned case channels`,
        orphanedChannels: orphanedChannels.map(c => ({
          channelId: c.channelId,
          channelName: c.channelName,
          inactiveDays: c.inactiveDays,
          shouldArchive: c.shouldArchive
        }))
      };
    } catch (error) {
      logger.error('Error in findOrphanedCaseChannels:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        orphanedChannels: []
      };
    }
  }
}