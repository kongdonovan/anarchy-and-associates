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
import { logger } from '../../infrastructure/logger';
import { randomUUID } from 'crypto';
import { Client, CategoryChannel, ChannelType, PermissionFlagsBits, TextChannel } from 'discord.js';

export class CaseService {
  constructor(
    private caseRepository: CaseRepository,
    private caseCounterRepository: CaseCounterRepository,
    private guildConfigRepository: GuildConfigRepository,
    private permissionService: PermissionService,
    private discordClient?: Client
  ) {}

  public async createCase(context: PermissionContext, request: CaseCreationRequest): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to create cases');
    }

    logger.info('Creating new case', {
      guildId: request.guildId,
      clientId: request.clientId,
      title: request.title
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

    return updatedCase;
  }

  public async setLeadAttorney(context: PermissionContext, caseId: string, newLeadAttorneyId: string): Promise<Case> {
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to set lead attorney');
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

      // Clear existing lawyer permissions and re-add them
      for (const lawyerId of caseData.assignedLawyerIds) {
        await textChannel.permissionOverwrites.edit(lawyerId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          ManageMessages: true
        });
      }
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
    // Check case permission
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      throw new Error('You do not have permission to accept cases');
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

    // Create the case channel
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentCategory?.id,
      topic: `Case: ${caseData.title} | Client: ${caseData.clientUsername} | Lead: <@${caseData.leadAttorneyId || 'TBD'}>`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: caseData.clientId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ],
        },
        // Add permissions for assigned lawyers
        ...caseData.assignedLawyerIds.map(lawyerId => ({
          id: lawyerId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages
          ],
        }))
      ],
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
}