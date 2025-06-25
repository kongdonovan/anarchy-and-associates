"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseService = void 0;
const case_1 = require("../../domain/entities/case");
const logger_1 = require("../../infrastructure/logger");
const crypto_1 = require("crypto");
const discord_js_1 = require("discord.js");
class CaseService {
    constructor(caseRepository, caseCounterRepository, guildConfigRepository, permissionService, discordClient) {
        this.caseRepository = caseRepository;
        this.caseCounterRepository = caseCounterRepository;
        this.guildConfigRepository = guildConfigRepository;
        this.permissionService = permissionService;
        this.discordClient = discordClient;
    }
    async createCase(context, request) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to create cases');
        }
        logger_1.logger.info('Creating new case', {
            guildId: request.guildId,
            clientId: request.clientId,
            title: request.title
        });
        // Generate sequential case number
        const caseCount = await this.caseCounterRepository.getNextCaseNumber(request.guildId);
        const currentYear = new Date().getFullYear();
        const caseNumber = (0, case_1.generateCaseNumber)(currentYear, caseCount, request.clientUsername);
        const caseData = {
            guildId: request.guildId,
            caseNumber,
            clientId: request.clientId,
            clientUsername: request.clientUsername,
            title: request.title,
            description: request.description,
            status: case_1.CaseStatus.PENDING,
            priority: request.priority || case_1.CasePriority.MEDIUM,
            assignedLawyerIds: [],
            documents: [],
            notes: []
        };
        const createdCase = await this.caseRepository.add(caseData);
        logger_1.logger.info('Case created successfully', {
            caseId: createdCase._id,
            caseNumber: createdCase.caseNumber,
            clientId: request.clientId
        });
        return createdCase;
    }
    async assignLawyer(context, request) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to assign lawyers to cases');
        }
        logger_1.logger.info('Assigning lawyer to case', {
            caseId: request.caseId,
            lawyerId: request.lawyerId,
            assignedBy: request.assignedBy
        });
        const updatedCase = await this.caseRepository.assignLawyer(request.caseId, request.lawyerId);
        if (!updatedCase) {
            throw new Error('Case not found or assignment failed');
        }
        logger_1.logger.info('Lawyer assigned successfully', {
            caseId: request.caseId,
            lawyerId: request.lawyerId,
            isLeadAttorney: updatedCase.leadAttorneyId === request.lawyerId
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
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to close cases');
        }
        logger_1.logger.info('Closing case', {
            caseId: request.caseId,
            result: request.result,
            closedBy: request.closedBy
        });
        // Use atomic conditional update to ensure only open/in-progress cases can be closed
        // This prevents race conditions by checking and updating in a single operation
        const updatedCase = await this.caseRepository.conditionalUpdate(request.caseId, {
            status: case_1.CaseStatus.IN_PROGRESS
        }, // MongoDB query for "status is IN_PROGRESS"
        {
            status: case_1.CaseStatus.CLOSED,
            result: request.result,
            resultNotes: request.resultNotes,
            closedAt: new Date(),
            closedBy: request.closedBy
        });
        if (!updatedCase) {
            // Check if case exists but is not in closable state
            const existingCase = await this.caseRepository.findById(request.caseId);
            if (!existingCase) {
                throw new Error('Case not found');
            }
            else {
                throw new Error(`Case cannot be closed - current status: ${existingCase.status}`);
            }
        }
        logger_1.logger.info('Case closed successfully', {
            caseId: request.caseId,
            result: request.result
        });
        return updatedCase;
    }
    async setLeadAttorney(context, caseId, newLeadAttorneyId) {
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to set lead attorney');
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
    async updateCase(context, request) {
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
        const updatedCase = await this.caseRepository.update(request.caseId, updates);
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
        // Check case permission
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            throw new Error('You do not have permission to accept cases');
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
        // Generate channel name from case number
        const channelName = (0, case_1.generateChannelName)(caseData.caseNumber);
        // Try to find the "Cases" category or create the channel in the first available category
        let parentCategory = null;
        const categories = guild.channels.cache.filter(channel => channel.type === discord_js_1.ChannelType.GuildCategory &&
            channel.name.toLowerCase().includes('case'));
        if (categories.size > 0) {
            parentCategory = categories.first();
        }
        // Create the case channel
        const channel = await guild.channels.create({
            name: channelName,
            type: discord_js_1.ChannelType.GuildText,
            parent: parentCategory?.id,
            topic: `Case: ${caseData.title} | Client: ${caseData.clientUsername} | Lead: <@${caseData.leadAttorneyId || 'TBD'}>`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [discord_js_1.PermissionFlagsBits.ViewChannel],
                },
                {
                    id: caseData.clientId,
                    allow: [
                        discord_js_1.PermissionFlagsBits.ViewChannel,
                        discord_js_1.PermissionFlagsBits.SendMessages,
                        discord_js_1.PermissionFlagsBits.ReadMessageHistory
                    ],
                },
                // Add permissions for assigned lawyers
                ...caseData.assignedLawyerIds.map(lawyerId => ({
                    id: lawyerId,
                    allow: [
                        discord_js_1.PermissionFlagsBits.ViewChannel,
                        discord_js_1.PermissionFlagsBits.SendMessages,
                        discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                        discord_js_1.PermissionFlagsBits.ManageMessages
                    ],
                }))
            ],
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
}
exports.CaseService = CaseService;
//# sourceMappingURL=case-service.js.map