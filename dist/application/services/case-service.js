"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseService = void 0;
const case_1 = require("../../domain/entities/case"); // Keep utility functions and enums
const migration_adapter_1 = require("../validation/migration-adapter");
const logger_1 = require("../../infrastructure/logger");
const crypto_1 = require("crypto");
const discord_js_1 = require("discord.js");
const case_channel_archive_service_1 = require("./case-channel-archive-service");
const validation_1 = require("../../validation");
class CaseService {
    constructor(caseRepository, caseCounterRepository, guildConfigRepository, permissionService, validationService, discordClient) {
        this.caseRepository = caseRepository;
        this.caseCounterRepository = caseCounterRepository;
        this.guildConfigRepository = guildConfigRepository;
        this.permissionService = permissionService;
        this.validationService = validationService;
        this.discordClient = discordClient;
        this.validationAdapter = new migration_adapter_1.ValidationMigrationAdapter(validationService);
        // Initialize archive service if we have required dependencies
        if (this.permissionService && this.validationService) {
            this.initializeArchiveService();
        }
    }
    initializeArchiveService() {
        try {
            // Import audit log repository
            const { AuditLogRepository } = require('../../infrastructure/repositories/audit-log-repository');
            const auditLogRepository = new AuditLogRepository();
            this.archiveService = new case_channel_archive_service_1.CaseChannelArchiveService(this.caseRepository, this.guildConfigRepository, auditLogRepository, this.permissionService, this.validationService);
        }
        catch (error) {
            logger_1.logger.warn('Failed to initialize archive service:', error);
        }
    }
    async createCase(context, request) {
        // Validate input using Zod schema
        const validatedRequest = validation_1.ValidationHelpers.validateOrThrow(validation_1.CaseOpenRequestSchema, request, 'Case creation request');
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to create cases');
        }
        // Validate client case limits (5 active cases max per client)
        const caseLimitValidation = await this.validateClientCaseLimits(validatedRequest.clientId, validatedRequest.guildId);
        if (!caseLimitValidation.valid) {
            const errorMessage = caseLimitValidation.errors.join(', ');
            logger_1.logger.warn('Case creation blocked due to client case limit', {
                clientId: validatedRequest.clientId,
                guildId: validatedRequest.guildId,
                errors: caseLimitValidation.errors
            });
            throw new Error(errorMessage);
        }
        // Log warnings if client is approaching limit
        if (caseLimitValidation.warnings.length > 0) {
            logger_1.logger.warn('Client approaching case limit', {
                clientId: validatedRequest.clientId,
                warnings: caseLimitValidation.warnings
            });
        }
        logger_1.logger.info('Creating new case', {
            guildId: validatedRequest.guildId,
            clientId: validatedRequest.clientId,
            title: validatedRequest.title,
            clientCurrentCases: caseLimitValidation.currentCases || 0
        });
        // Generate sequential case number
        const caseCount = await this.caseCounterRepository.getNextCaseNumber(validatedRequest.guildId);
        const currentYear = new Date().getFullYear();
        const caseNumber = (0, case_1.generateCaseNumber)(currentYear, caseCount, validatedRequest.clientUsername);
        const caseData = {
            guildId: validatedRequest.guildId,
            caseNumber,
            clientId: validatedRequest.clientId,
            clientUsername: validatedRequest.clientUsername,
            title: validatedRequest.title,
            description: validatedRequest.description,
            status: case_1.CaseStatus.PENDING,
            priority: validatedRequest.priority || case_1.CasePriority.MEDIUM,
            assignedLawyerIds: [],
            documents: [],
            notes: []
        };
        const createdCase = await this.caseRepository.add(caseData);
        logger_1.logger.info('Case created successfully', {
            caseId: createdCase._id,
            caseNumber: createdCase.caseNumber,
            clientId: validatedRequest.clientId
        });
        return createdCase;
    }
    async assignLawyer(context, request) {
        // Validate input using Zod schema
        const validatedRequest = validation_1.ValidationHelpers.validateOrThrow(validation_1.CaseAssignRequestSchema, request, 'Case assignment request');
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to assign lawyers to cases');
        }
        // For now, we'll handle single lawyer assignment (first in array)
        const lawyerId = validatedRequest.lawyerIds[0];
        if (!lawyerId) {
            throw new Error('At least one lawyer must be specified');
        }
        // Validate that the lawyer being assigned has the required permissions
        const lawyerValidation = await this.validateLawyerPermissions(context.guildId, lawyerId, 'lawyer');
        if (!lawyerValidation.valid) {
            const errorMessage = `User cannot be assigned to case: ${lawyerValidation.errors.join(', ')}`;
            logger_1.logger.warn('Lawyer assignment blocked due to insufficient permissions', {
                caseId: validatedRequest.caseId,
                lawyerId: lawyerId,
                assignedBy: validatedRequest.assignedBy,
                errors: lawyerValidation.errors
            });
            throw new Error(errorMessage);
        }
        logger_1.logger.info('Assigning lawyer to case', {
            caseId: validatedRequest.caseId,
            lawyerId: lawyerId,
            assignedBy: validatedRequest.assignedBy
        });
        const updatedCase = await this.caseRepository.assignLawyer(validatedRequest.caseId, lawyerId);
        if (!updatedCase) {
            throw new Error('Case not found or assignment failed');
        }
        logger_1.logger.info('Lawyer assigned successfully', {
            caseId: validatedRequest.caseId,
            lawyerId: lawyerId,
            isLeadAttorney: updatedCase.leadAttorneyId === lawyerId
        });
        return updatedCase;
    }
    async unassignLawyer(context, caseId, lawyerId) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to unassign lawyers from cases');
        }
        logger_1.logger.info('Unassigning lawyer from case', { caseId, lawyerId });
        const updatedCase = await this.caseRepository.unassignLawyer(caseId, lawyerId);
        if (!updatedCase) {
            throw new Error('Case not found or unassignment failed');
        }
        logger_1.logger.info('Lawyer unassigned successfully', { caseId, lawyerId });
        return updatedCase;
    }
    async reassignLawyer(context, fromCaseId, toCaseId, lawyerId) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to reassign lawyers between cases');
        }
        logger_1.logger.info('Reassigning lawyer between cases', { fromCaseId, toCaseId, lawyerId });
        const result = await this.caseRepository.reassignLawyer(fromCaseId, toCaseId, lawyerId);
        if (!result.fromCase || !result.toCase) {
            throw new Error('One or both cases not found, or reassignment failed');
        }
        logger_1.logger.info('Lawyer reassigned successfully', { fromCaseId, toCaseId, lawyerId });
        return result;
    }
    async updateCaseStatus(context, caseId, status) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to update case status');
        }
        logger_1.logger.info('Updating case status', { caseId, status, updatedBy: context.userId });
        const updatedCase = await this.caseRepository.update(caseId, { status });
        if (!updatedCase) {
            throw new Error('Case not found or status update failed');
        }
        logger_1.logger.info('Case status updated successfully', { caseId, status });
        return updatedCase;
    }
    async closeCase(context, request) {
        // Validate input using Zod schema
        const validatedRequest = validation_1.ValidationHelpers.validateOrThrow(validation_1.CaseCloseRequestSchema, request, 'Case closure request');
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to close cases');
        }
        logger_1.logger.info('Closing case', {
            caseId: validatedRequest.caseId,
            result: validatedRequest.result,
            closedBy: validatedRequest.closedBy
        });
        // Use atomic conditional update to ensure only open/in-progress cases can be closed
        // This prevents race conditions by checking and updating in a single operation
        const updatedCase = await this.caseRepository.conditionalUpdate(validatedRequest.caseId, {
            status: case_1.CaseStatus.IN_PROGRESS
        }, // MongoDB query for "status is IN_PROGRESS"
        {
            status: case_1.CaseStatus.CLOSED,
            result: validatedRequest.result,
            resultNotes: validatedRequest.resultNotes,
            closedAt: new Date(),
            closedBy: validatedRequest.closedBy
        });
        if (!updatedCase) {
            // Check if case exists but is not in closable state
            const existingCase = await this.caseRepository.findById(validatedRequest.caseId);
            if (!existingCase) {
                throw new Error('Case not found');
            }
            else {
                throw new Error(`Case cannot be closed - current status: ${existingCase.status}`);
            }
        }
        logger_1.logger.info('Case closed successfully', {
            caseId: validatedRequest.caseId,
            result: validatedRequest.result
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
                            logger_1.logger.info('Case channel archived successfully after case closure', {
                                caseId: validatedRequest.caseId,
                                channelId: result.channelId,
                                archiveCategoryId: result.archiveCategoryId
                            });
                        }
                        else {
                            logger_1.logger.warn('Failed to archive case channel after closure', {
                                caseId: validatedRequest.caseId,
                                channelId: result.channelId,
                                error: result.error
                            });
                        }
                    })
                        .catch(error => {
                        logger_1.logger.error('Error archiving case channel after closure:', {
                            caseId: validatedRequest.caseId,
                            channelId: updatedCase.channelId,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    });
                }
            }
            catch (error) {
                logger_1.logger.warn('Failed to initiate case channel archiving after closure:', error);
            }
        }
        return updatedCase;
    }
    async setLeadAttorney(context, caseId, newLeadAttorneyId) {
        // Check lead-attorney permission (updated to use new permission system)
        const hasPermission = await this.permissionService.hasLeadAttorneyPermissionWithContext(context);
        if (!hasPermission) {
            throw new Error('You do not have permission to set lead attorney');
        }
        // Validate that the new lead attorney has the required permissions
        const leadAttorneyValidation = await this.validateLawyerPermissions(context.guildId, newLeadAttorneyId, 'lead-attorney');
        if (!leadAttorneyValidation.valid) {
            const errorMessage = `User cannot be assigned as lead attorney: ${leadAttorneyValidation.errors.join(', ')}`;
            logger_1.logger.warn('Lead attorney assignment blocked due to insufficient permissions', {
                caseId,
                newLeadAttorneyId,
                changedBy: context.userId,
                errors: leadAttorneyValidation.errors
            });
            throw new Error(errorMessage);
        }
        logger_1.logger.info('Setting lead attorney for case', {
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
                logger_1.logger.info('Case channel permissions updated for new lead attorney', {
                    caseId,
                    channelId: updatedCase.channelId,
                    newLeadAttorneyId
                });
            }
            catch (error) {
                logger_1.logger.warn('Failed to update case channel permissions', {
                    caseId,
                    channelId: updatedCase.channelId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        logger_1.logger.info('Lead attorney updated successfully', {
            caseId,
            previousLeadAttorney: existingCase.leadAttorneyId,
            newLeadAttorney: newLeadAttorneyId,
            changedBy: context.userId
        });
        return updatedCase;
    }
    async updateCaseChannelPermissions(caseData) {
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
        if (channel.type === discord_js_1.ChannelType.GuildText) {
            const textChannel = channel;
            // Update channel topic with new lead attorney
            const topic = `Case: ${caseData.title} | Client: ${caseData.clientUsername} | Lead: <@${caseData.leadAttorneyId || 'TBD'}>`;
            await textChannel.setTopic(topic);
            // Validate assigned lawyers have proper permissions before updating
            const validatedLawyers = [];
            for (const lawyerId of caseData.assignedLawyerIds) {
                try {
                    const validation = await this.validateLawyerPermissions(caseData.guildId, lawyerId, 'lawyer');
                    if (validation.valid) {
                        validatedLawyers.push(lawyerId);
                    }
                    else {
                        logger_1.logger.warn('Removing invalid lawyer from case channel permissions during update', {
                            caseId: caseData._id,
                            lawyerId,
                            errors: validation.errors
                        });
                        // Remove permissions for invalid lawyers
                        await textChannel.permissionOverwrites.delete(lawyerId);
                    }
                }
                catch (error) {
                    logger_1.logger.warn('Failed to validate lawyer permissions for channel update', {
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
            logger_1.logger.info('Case channel permissions updated with validation', {
                caseId: caseData._id,
                channelId: caseData.channelId,
                validatedLawyers: validatedLawyers.length,
                totalAssignedLawyers: caseData.assignedLawyerIds.length,
                staffRolesUpdated: staffRolePermissions.length
            });
        }
    }
    async updateCase(context, caseId, request) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to update cases');
        }
        const updates = {};
        if (request.title !== undefined)
            updates.title = request.title;
        if (request.description !== undefined)
            updates.description = request.description;
        if (request.priority !== undefined)
            updates.priority = request.priority;
        if (request.status !== undefined)
            updates.status = request.status;
        if (request.channelId !== undefined)
            updates.channelId = request.channelId;
        const updatedCase = await this.caseRepository.update(caseId, updates);
        if (!updatedCase) {
            throw new Error('Case not found or update failed');
        }
        return updatedCase;
    }
    async addDocument(context, caseId, title, content) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to add documents to cases');
        }
        const document = {
            id: (0, crypto_1.randomUUID)(),
            title,
            content,
            createdBy: context.userId,
            createdAt: new Date()
        };
        const updatedCase = await this.caseRepository.addDocument(caseId, document);
        if (!updatedCase) {
            throw new Error('Case not found or document addition failed');
        }
        logger_1.logger.info('Document added to case', { caseId, documentId: document.id, title });
        return updatedCase;
    }
    async addNote(context, caseId, content, isInternal = false) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to add notes to cases');
        }
        const note = {
            id: (0, crypto_1.randomUUID)(),
            content,
            createdBy: context.userId,
            createdAt: new Date(),
            isInternal
        };
        const updatedCase = await this.caseRepository.addNote(caseId, note);
        if (!updatedCase) {
            throw new Error('Case not found or note addition failed');
        }
        logger_1.logger.info('Note added to case', { caseId, noteId: note.id, isInternal });
        return updatedCase;
    }
    async searchCases(context, filters, sort, pagination) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to search cases');
        }
        return this.caseRepository.searchCases(filters, sort, pagination);
    }
    async getCaseById(context, caseId) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to view case details');
        }
        return this.caseRepository.findById(caseId);
    }
    async getCaseByCaseNumber(context, caseNumber) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to view case details');
        }
        return this.caseRepository.findByCaseNumber(caseNumber);
    }
    async getCasesByClient(context, clientId) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to view client cases');
        }
        return this.caseRepository.findByClient(clientId);
    }
    async getCasesByLawyer(context, lawyerId) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to view lawyer cases');
        }
        return this.caseRepository.findByLawyer(lawyerId);
    }
    async getActiveCases(context) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to view active cases');
        }
        return this.caseRepository.getActiveCases(context.guildId);
    }
    async getPendingCases(context) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to view pending cases');
        }
        return this.caseRepository.getPendingCases(context.guildId);
    }
    async getCaseStats(context) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to view case statistics');
        }
        return this.caseRepository.getCaseStats(context.guildId);
    }
    async getCaseReviewCategoryId(guildId) {
        const config = await this.guildConfigRepository.findByGuildId(guildId);
        return config?.caseReviewCategoryId || null;
    }
    async getCaseArchiveCategoryId(guildId) {
        const config = await this.guildConfigRepository.findByGuildId(guildId);
        return config?.caseArchiveCategoryId || null;
    }
    generateChannelName(caseNumber) {
        return (0, case_1.generateChannelName)(caseNumber);
    }
    async acceptCase(context, caseId) {
        // Check lead-attorney permission (since accepting a case makes you the lead attorney)
        const hasPermission = await this.permissionService.hasLeadAttorneyPermissionWithContext(context);
        if (!hasPermission) {
            throw new Error('You do not have permission to accept cases as lead attorney');
        }
        logger_1.logger.info('Accepting case', { caseId, acceptedBy: context.userId });
        // First, get the case to access its details for channel creation
        const existingCase = await this.caseRepository.findById(caseId);
        if (!existingCase) {
            throw new Error('Case not found');
        }
        if (existingCase.status !== case_1.CaseStatus.PENDING) {
            throw new Error(`Case cannot be accepted - current status: ${existingCase.status}`);
        }
        let channelId;
        // Create case channel if Discord client is available
        if (this.discordClient && existingCase.guildId) {
            try {
                channelId = await this.createCaseChannel(existingCase);
                logger_1.logger.info('Case channel created', { caseId, channelId });
            }
            catch (error) {
                logger_1.logger.warn('Failed to create case channel, proceeding without channel', {
                    caseId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        // Use atomic conditional update to ensure only pending cases can be accepted
        // This prevents race conditions by checking and updating in a single operation
        const updatedCase = await this.caseRepository.conditionalUpdate(caseId, { status: case_1.CaseStatus.PENDING }, // Only update if status is PENDING
        {
            status: case_1.CaseStatus.IN_PROGRESS,
            leadAttorneyId: context.userId,
            assignedLawyerIds: [context.userId],
            ...(channelId && { channelId })
        });
        if (!updatedCase) {
            // Check if case exists but is not pending (race condition)
            const recheckCase = await this.caseRepository.findById(caseId);
            if (!recheckCase) {
                throw new Error('Case not found');
            }
            else {
                throw new Error(`Case cannot be accepted - current status: ${recheckCase.status}`);
            }
        }
        logger_1.logger.info('Case accepted successfully', {
            caseId,
            acceptedBy: context.userId,
            leadAttorney: context.userId,
            channelId: updatedCase.channelId
        });
        return updatedCase;
    }
    async createCaseChannel(caseData) {
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
            discord_js_1.PermissionFlagsBits.ManageChannels,
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.SendMessages,
            discord_js_1.PermissionFlagsBits.ManageMessages
        ];
        const hasRequiredPermissions = botMember.permissions.has(requiredPermissions);
        if (!hasRequiredPermissions) {
            logger_1.logger.error('Bot lacks required permissions for channel creation', {
                guildId: caseData.guildId,
                caseId: caseData._id,
                requiredPermissions: requiredPermissions.map(p => p.toString())
            });
            throw new Error('Bot does not have required permissions to create case channels');
        }
        // Generate channel name from case number
        const channelName = (0, case_1.generateChannelName)(caseData.caseNumber);
        // Try to find the "Cases" category or create the channel in the first available category
        let parentCategory = null;
        const categories = guild.channels.cache.filter(channel => channel.type === discord_js_1.ChannelType.GuildCategory &&
            channel.name.toLowerCase().includes('case'));
        if (categories.size > 0) {
            parentCategory = categories.first();
        }
        // Validate assigned lawyers have proper permissions
        const validatedLawyers = [];
        for (const lawyerId of caseData.assignedLawyerIds) {
            try {
                const validation = await this.validateLawyerPermissions(caseData.guildId, lawyerId, 'lawyer');
                if (validation.valid) {
                    validatedLawyers.push(lawyerId);
                }
                else {
                    logger_1.logger.warn('Removing invalid lawyer from case channel permissions', {
                        caseId: caseData._id,
                        lawyerId,
                        errors: validation.errors
                    });
                }
            }
            catch (error) {
                logger_1.logger.warn('Failed to validate lawyer permissions for channel creation', {
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
            type: discord_js_1.ChannelType.GuildText,
            parent: parentCategory?.id,
            topic: `Case: ${caseData.title} | Client: ${caseData.clientUsername} | Lead: <@${caseData.leadAttorneyId || 'TBD'}>`,
            permissionOverwrites: [
                // Deny everyone by default
                {
                    id: guild.roles.everyone.id,
                    deny: [discord_js_1.PermissionFlagsBits.ViewChannel],
                },
                // Allow client access
                {
                    id: caseData.clientId,
                    allow: [
                        discord_js_1.PermissionFlagsBits.ViewChannel,
                        discord_js_1.PermissionFlagsBits.SendMessages,
                        discord_js_1.PermissionFlagsBits.ReadMessageHistory
                    ],
                },
                // Add permissions for validated lawyers only
                ...validatedLawyers.map(lawyerId => ({
                    id: lawyerId,
                    allow: [
                        discord_js_1.PermissionFlagsBits.ViewChannel,
                        discord_js_1.PermissionFlagsBits.SendMessages,
                        discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                        discord_js_1.PermissionFlagsBits.ManageMessages
                    ],
                })),
                // Add staff role permissions
                ...staffRolePermissions
            ],
        });
        logger_1.logger.info('Case channel created successfully with enhanced permissions', {
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
    async declineCase(context, caseId, reason) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to decline cases');
        }
        logger_1.logger.info('Declining case', { caseId, declinedBy: context.userId, reason });
        // For now, we'll set status to closed with a specific result
        // In a more complex system, you might want a separate "declined" status
        const updatedCase = await this.caseRepository.update(caseId, {
            status: case_1.CaseStatus.CLOSED,
            result: case_1.CaseResult.DISMISSED,
            resultNotes: reason || 'Case declined by staff',
            closedAt: new Date(),
            closedBy: context.userId
        });
        if (!updatedCase) {
            throw new Error('Case not found or decline failed');
        }
        logger_1.logger.info('Case declined successfully', { caseId, declinedBy: context.userId });
        return updatedCase;
    }
    /**
     * Helper method to validate that a user has the required permissions to be assigned to a case
     */
    async validateLawyerPermissions(guildId, userId, requiredPermission) {
        try {
            const userContext = {
                guildId,
                userId,
                userRoles: [], // Will be populated by the validation service
                isGuildOwner: false // Will be checked by the validation service
            };
            const validation = await this.validationAdapter.validatePermission(userContext, requiredPermission);
            return {
                valid: validation.valid,
                errors: validation.errors
            };
        }
        catch (error) {
            logger_1.logger.error('Error validating lawyer permissions:', error);
            return {
                valid: false,
                errors: ['Failed to validate lawyer permissions']
            };
        }
    }
    /**
     * Helper method to validate client case limits
     */
    async validateClientCaseLimits(clientId, guildId) {
        try {
            const context = {
                guildId,
                userId: clientId,
                userRoles: [],
                isGuildOwner: false
            };
            const validation = await this.validationAdapter.validateClientCaseLimit(context, clientId);
            return {
                valid: validation.valid,
                errors: validation.errors,
                warnings: validation.warnings,
                currentCases: validation.currentCases || 0
            };
        }
        catch (error) {
            logger_1.logger.error('Error validating client case limits:', error);
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
    async getStaffRolePermissions(guild) {
        try {
            const staffRolePermissions = [];
            // Define staff roles that should have access to case channels
            const staffRoleNames = [
                'Managing Partner',
                'Senior Partner',
                'Junior Partner'
            ];
            // Find staff roles in the guild
            for (const roleName of staffRoleNames) {
                const role = guild.roles.cache.find((r) => r.name === roleName);
                if (role) {
                    staffRolePermissions.push({
                        id: role.id,
                        allow: [
                            discord_js_1.PermissionFlagsBits.ViewChannel,
                            discord_js_1.PermissionFlagsBits.SendMessages,
                            discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                            discord_js_1.PermissionFlagsBits.ManageMessages,
                            discord_js_1.PermissionFlagsBits.ManageThreads
                        ]
                    });
                }
            }
            logger_1.logger.debug('Added staff role permissions to case channel', {
                guildId: guild.id,
                staffRolesFound: staffRolePermissions.length,
                staffRoleIds: staffRolePermissions.map(p => p.id)
            });
            return staffRolePermissions;
        }
        catch (error) {
            logger_1.logger.error('Error getting staff role permissions:', error);
            return [];
        }
    }
    /**
     * Archive a specific case channel
     */
    async archiveCaseChannel(context, caseId) {
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
        }
        catch (error) {
            logger_1.logger.error('Error in archiveCaseChannel:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    /**
     * Archive all closed case channels in a guild
     */
    async archiveAllClosedCaseChannels(context) {
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
        }
        catch (error) {
            logger_1.logger.error('Error in archiveAllClosedCaseChannels:', error);
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
    async findOrphanedCaseChannels(context) {
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
        }
        catch (error) {
            logger_1.logger.error('Error in findOrphanedCaseChannels:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error occurred',
                orphanedChannels: []
            };
        }
    }
}
exports.CaseService = CaseService;
//# sourceMappingURL=case-service.js.map