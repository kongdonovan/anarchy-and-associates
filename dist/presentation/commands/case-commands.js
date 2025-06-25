"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseCommands = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const case_service_1 = require("../../application/services/case-service");
const permission_service_1 = require("../../application/services/permission-service");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const permission_utils_1 = require("../../infrastructure/utils/permission-utils");
const case_1 = require("../../domain/entities/case");
const logger_1 = require("../../infrastructure/logger");
let CaseCommands = class CaseCommands {
    constructor() {
        const caseRepository = new case_repository_1.CaseRepository();
        const caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        this.caseService = new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository);
        this.caseRepository = caseRepository;
    }
    getCaseServiceWithClient(client) {
        const caseRepository = new case_repository_1.CaseRepository();
        const caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        return new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository, client);
    }
    async reviewCase(details, interaction) {
        try {
            const guildId = interaction.guildId;
            const clientId = interaction.user.id;
            const clientUsername = interaction.user.username;
            // Check if case review category is configured
            const caseReviewCategoryId = await this.caseService.getCaseReviewCategoryId(guildId);
            if (!caseReviewCategoryId) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Configuration Required', 'Case review category must be configured before requesting case reviews. Please contact an administrator.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Create the case
            const caseRequest = {
                guildId,
                clientId,
                clientUsername,
                title: `Legal consultation request`,
                description: details,
                priority: case_1.CasePriority.MEDIUM
            };
            const newCase = await this.caseService.createCase(caseRequest);
            // Create case channel
            await this.createCaseChannel(newCase, interaction);
            // Confirm to client
            const confirmationEmbed = embed_utils_1.EmbedUtils.createSuccessEmbed('Case Review Requested', `Your case review request has been submitted successfully!\n\n` +
                `**Case Number:** \`${newCase.caseNumber}\`\n` +
                `**Description:** ${details}\n\n` +
                `A private case channel has been created where our legal team will review your request. You'll be notified once a lawyer accepts your case.`);
            await interaction.reply({ embeds: [confirmationEmbed], ephemeral: true });
        }
        catch (error) {
            logger_1.logger.error('Error creating case review:', error);
            let errorMessage = 'An unexpected error occurred while submitting your case review request.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Case Review Failed', errorMessage);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async assignCase(lawyer, interaction) {
        try {
            // This command only works within case channels
            const caseData = await this.getCaseFromChannel(interaction.channelId);
            if (!caseData) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Channel', 'This command can only be used within case channels.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const assignmentRequest = {
                caseId: caseData._id.toString(),
                lawyerId: lawyer.id,
                assignedBy: interaction.user.id
            };
            const updatedCase = await this.caseService.assignLawyer(assignmentRequest);
            const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('Lawyer Assigned', `${lawyer.displayName} has been assigned to case **${updatedCase.caseNumber}**.\n\n` +
                `${updatedCase.leadAttorneyId === lawyer.id ? '**Lead Attorney:** Yes' : '**Lead Attorney:** No'}\n` +
                `**Total Assigned Lawyers:** ${updatedCase.assignedLawyerIds.length}`);
            await interaction.reply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error assigning lawyer to case:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Assignment Failed', error instanceof Error ? error.message : 'Failed to assign lawyer to case.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async closeCase(result, notes, interaction) {
        try {
            // This command works within case channels or staff can specify case ID
            const caseData = await this.getCaseFromChannel(interaction.channelId);
            if (!caseData) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Channel', 'This command can only be used within case channels.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check permissions: only client or lead counsel can close cases
            const isClient = caseData.clientId === interaction.user.id;
            const isLeadCounsel = caseData.leadAttorneyId === interaction.user.id;
            if (!isClient && !isLeadCounsel) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'Only the client or lead counsel can close cases.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const closureRequest = {
                caseId: caseData._id.toString(),
                result: result,
                resultNotes: notes,
                closedBy: interaction.user.id
            };
            const closedCase = await this.caseService.closeCase(closureRequest);
            // Archive the channel
            await this.archiveCaseChannel(closedCase, interaction);
            const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('Case Closed', `Case **${closedCase.caseNumber}** has been closed successfully.\n\n` +
                `**Result:** ${result.charAt(0).toUpperCase() + result.slice(1)}\n` +
                `**Closed by:** ${interaction.user.displayName}\n` +
                `${notes ? `**Notes:** ${notes}` : ''}\n\n` +
                `The case channel will be moved to the archive category.`);
            await interaction.reply({ embeds: [embed] });
            // Update the original message containing the case overview to remove the close button
            await this.updateCaseOverviewMessage(closedCase, interaction.guildId, interaction);
        }
        catch (error) {
            logger_1.logger.error('Error closing case:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Case Closure Failed', error instanceof Error ? error.message : 'Failed to close case.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async listCases(status, lawyer, search, page, interaction) {
        try {
            const guildId = interaction.guildId;
            const pageSize = 5;
            const currentPage = Math.max(1, page || 1);
            const skip = (currentPage - 1) * pageSize;
            // Build filters
            const filters = { guildId };
            if (status)
                filters.status = status;
            if (lawyer)
                filters.assignedLawyerId = lawyer.id;
            if (search)
                filters.title = search;
            // Get cases with pagination
            const cases = await this.caseService.searchCases(filters, { field: 'createdAt', direction: 'desc' }, { limit: pageSize, skip });
            // Get total count for pagination info
            const allCases = await this.caseService.searchCases(filters);
            const totalPages = Math.ceil(allCases.length / pageSize);
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: '📋 Case List',
                color: 'info'
            });
            embed.addFields({
                name: '📊 Summary',
                value: `**Total Cases:** ${allCases.length}\n**Page:** ${currentPage}/${totalPages || 1}`,
                inline: true
            });
            if (cases.length > 0) {
                const caseList = cases.map(c => {
                    const statusEmoji = {
                        [case_1.CaseStatus.PENDING]: '⏳',
                        // [CaseStatus.OPEN]: '🟢', // Legacy - removed status
                        [case_1.CaseStatus.IN_PROGRESS]: '🔄',
                        [case_1.CaseStatus.CLOSED]: '✅'
                    }[c.status];
                    const leadAttorney = c.leadAttorneyId ? `<@${c.leadAttorneyId}>` : 'Unassigned';
                    return `${statusEmoji} **${c.caseNumber}**\n` +
                        `**Client:** <@${c.clientId}>\n` +
                        `**Lead Attorney:** ${leadAttorney}\n` +
                        `**Title:** ${c.title}\n` +
                        `**Created:** ${c.createdAt?.toDateString() || 'Unknown'}`;
                }).join('\n\n');
                embed_utils_1.EmbedUtils.addFieldSafe(embed, '🗂️ Cases', caseList);
            }
            else {
                embed.addFields({
                    name: 'No Cases Found',
                    value: 'No cases match the specified criteria.',
                    inline: false
                });
            }
            await interaction.reply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error listing cases:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('List Failed', 'An error occurred while retrieving the case list.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async reassignStaff(staff, newCaseChannel, interaction) {
        try {
            // Validate the new case channel
            if (newCaseChannel.type !== discord_js_1.ChannelType.GuildText) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Channel Type', 'The new case channel must be a text channel.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Get the case from the new channel
            const newCase = await this.getCaseFromChannel(newCaseChannel.id);
            if (!newCase) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Case Channel', 'The specified channel is not associated with a case.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Find the staff member's current case assignment using repository method
            const assignedCases = await this.caseRepository.findByLawyer(staff.id);
            const activeCases = assignedCases.filter(c => c.guildId === interaction.guildId &&
                c.status === case_1.CaseStatus.IN_PROGRESS);
            if (activeCases.length === 0) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('No Current Assignment', `${staff.displayName} is not currently assigned to any active cases.`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // If staff is assigned to multiple cases, we'll reassign from the first active one
            const currentCase = activeCases[0];
            if (!currentCase) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('No Current Assignment', `${staff.displayName} is not currently assigned to any active cases.`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check if they're already assigned to the target case
            if (newCase.assignedLawyerIds.includes(staff.id)) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Already Assigned', `${staff.displayName} is already assigned to case ${newCase.caseNumber}.`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Use the existing reassignLawyer method from the service
            await this.caseService.reassignLawyer(currentCase._id.toString(), newCase._id.toString(), staff.id);
            // Get updated case data
            const updatedNewCase = await this.caseService.getCaseById(newCase._id.toString());
            const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('Staff Reassigned', `${staff.displayName} has been reassigned from case **${currentCase.caseNumber}** to case **${newCase.caseNumber}**.\n\n` +
                `**New Case:** ${newCase.title}\n` +
                `**New Case Channel:** <#${newCaseChannel.id}>\n` +
                `${updatedNewCase?.leadAttorneyId === staff.id ? '**Lead Attorney:** Yes' : '**Lead Attorney:** No'}\n` +
                `**Total Assigned Lawyers:** ${updatedNewCase?.assignedLawyerIds.length || 0}`);
            await interaction.reply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error reassigning staff member:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Reassignment Failed', error instanceof Error ? error.message : 'Failed to reassign staff member.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async unassignStaff(staff, interaction) {
        try {
            // Find all cases where this staff member is assigned using repository method
            const allAssignedCases = await this.caseRepository.findByLawyer(staff.id);
            const assignedCases = allAssignedCases.filter(c => c.guildId === interaction.guildId &&
                c.status === case_1.CaseStatus.IN_PROGRESS);
            if (assignedCases.length === 0) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('No Current Assignment', `${staff.displayName} is not currently assigned to any active cases.`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Unassign from all active cases
            const unassignedCases = [];
            for (const caseData of assignedCases) {
                try {
                    await this.caseService.unassignLawyer(caseData._id.toString(), staff.id);
                    unassignedCases.push(caseData.caseNumber);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to unassign from case ${caseData.caseNumber}:`, error);
                }
            }
            if (unassignedCases.length === 0) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Unassignment Failed', 'Failed to unassign staff member from any cases.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('Staff Unassigned', `${staff.displayName} has been unassigned from the following case${unassignedCases.length > 1 ? 's' : ''}:\n\n` +
                `**Cases:** ${unassignedCases.map(cn => `\`${cn}\``).join(', ')}\n\n` +
                `${unassignedCases.length > 1 ? 'These cases' : 'This case'} ${unassignedCases.length > 1 ? 'are' : 'is'} now available for reassignment.`);
            await interaction.reply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error unassigning staff member:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Unassignment Failed', error instanceof Error ? error.message : 'Failed to unassign staff member.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async caseInfo(caseNumber, interaction) {
        try {
            let caseData = null;
            if (caseNumber) {
                // Find case by case number
                caseData = await this.caseService.getCaseByCaseNumber(caseNumber);
            }
            else {
                // Try to get case from current channel
                caseData = await this.getCaseFromChannel(interaction.channelId);
            }
            if (!caseData) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Case Not Found', caseNumber
                    ? `Case **${caseNumber}** not found.`
                    : 'No case found. Please specify a case number or use this command in a case channel.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Show overview tab by default
            await this.showCaseInfoTab(interaction, caseData, 'overview');
        }
        catch (error) {
            logger_1.logger.error('Error displaying case info:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Info Failed', 'An error occurred while retrieving case information.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async showCaseInfoTab(interaction, caseData, tab) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: `📋 Case Information - ${caseData.caseNumber}`,
            color: 'info'
        });
        // Create tab buttons
        const overviewButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`case_tab_overview_${caseData._id}`)
            .setLabel('Overview')
            .setStyle(tab === 'overview' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
            .setEmoji('📋');
        const documentsButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`case_tab_documents_${caseData._id}`)
            .setLabel('Documents')
            .setStyle(tab === 'documents' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
            .setEmoji('📄');
        const notesButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`case_tab_notes_${caseData._id}`)
            .setLabel('Notes')
            .setStyle(tab === 'notes' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
            .setEmoji('📝');
        const timelineButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`case_tab_timeline_${caseData._id}`)
            .setLabel('Timeline')
            .setStyle(tab === 'timeline' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
            .setEmoji('⏰');
        const tabRow = new discord_js_1.ActionRowBuilder()
            .addComponents(overviewButton, documentsButton, notesButton, timelineButton);
        // Build content based on selected tab
        switch (tab) {
            case 'overview':
                this.buildOverviewTab(embed, caseData);
                break;
            case 'documents':
                this.buildDocumentsTab(embed, caseData);
                break;
            case 'notes':
                this.buildNotesTab(embed, caseData);
                break;
            case 'timeline':
                this.buildTimelineTab(embed, caseData);
                break;
        }
        const components = [tabRow];
        if (interaction instanceof discord_js_1.CommandInteraction) {
            await interaction.reply({ embeds: [embed], components });
        }
        else {
            await interaction.update({ embeds: [embed], components });
        }
    }
    buildOverviewTab(embed, caseData) {
        const statusEmoji = {
            [case_1.CaseStatus.PENDING]: '⏳',
            // [CaseStatus.OPEN]: '🟢', // Legacy - removed status
            [case_1.CaseStatus.IN_PROGRESS]: '🔄',
            [case_1.CaseStatus.CLOSED]: '✅'
        }[caseData.status];
        const priorityEmoji = {
            [case_1.CasePriority.LOW]: '🟢',
            [case_1.CasePriority.MEDIUM]: '🟡',
            [case_1.CasePriority.HIGH]: '🟠',
            [case_1.CasePriority.URGENT]: '🔴'
        }[caseData.priority];
        embed.addFields({ name: '🆔 Case Number', value: caseData.caseNumber, inline: true }, { name: '👤 Client', value: `<@${caseData.clientId}>`, inline: true }, { name: `${statusEmoji} Status`, value: caseData.status.charAt(0).toUpperCase() + caseData.status.slice(1), inline: true }, { name: `${priorityEmoji} Priority`, value: caseData.priority.charAt(0).toUpperCase() + caseData.priority.slice(1), inline: true }, { name: '📅 Created', value: caseData.createdAt?.toDateString() || 'Unknown', inline: true }, { name: '⚖️ Lead Attorney', value: caseData.leadAttorneyId ? `<@${caseData.leadAttorneyId}>` : 'Unassigned', inline: true });
        if (caseData.assignedLawyerIds.length > 0) {
            const assignedLawyers = caseData.assignedLawyerIds.map(id => `<@${id}>`).join(', ');
            embed.addFields({ name: '👥 Assigned Lawyers', value: assignedLawyers, inline: false });
        }
        embed.addFields({ name: '📝 Description', value: caseData.description, inline: false });
        if (caseData.status === case_1.CaseStatus.CLOSED && caseData.result) {
            const resultEmoji = {
                [case_1.CaseResult.WIN]: '🏆',
                [case_1.CaseResult.LOSS]: '❌',
                [case_1.CaseResult.SETTLEMENT]: '🤝',
                [case_1.CaseResult.DISMISSED]: '🚫',
                [case_1.CaseResult.WITHDRAWN]: '↩️'
            }[caseData.result];
            embed.addFields({ name: `${resultEmoji} Result`, value: caseData.result.charAt(0).toUpperCase() + caseData.result.slice(1), inline: true }, { name: '📅 Closed', value: caseData.closedAt?.toDateString() || 'Unknown', inline: true }, { name: '👨‍⚖️ Closed By', value: caseData.closedBy ? `<@${caseData.closedBy}>` : 'Unknown', inline: true });
            if (caseData.resultNotes) {
                embed_utils_1.EmbedUtils.addFieldSafe(embed, '📄 Closure Notes', caseData.resultNotes);
            }
        }
    }
    buildDocumentsTab(embed, caseData) {
        embed.addFields({ name: '📄 Documents', value: `Case: ${caseData.caseNumber}`, inline: false });
        if (caseData.documents.length > 0) {
            const documentsList = caseData.documents
                .slice(0, 10) // Limit to 10 documents
                .map(doc => `**${doc.title}**\n` +
                `Created by: <@${doc.createdBy}>\n` +
                `Date: ${doc.createdAt.toDateString()}\n` +
                `Content: ${doc.content.length > 100 ? doc.content.substring(0, 97) + '...' : doc.content}`)
                .join('\n\n');
            embed_utils_1.EmbedUtils.addFieldSafe(embed, '📋 Document List', documentsList);
            if (caseData.documents.length > 10) {
                embed.addFields({
                    name: 'Note',
                    value: `Showing first 10 of ${caseData.documents.length} documents.`,
                    inline: false
                });
            }
        }
        else {
            embed.addFields({ name: 'No Documents', value: 'No documents have been added to this case yet.', inline: false });
        }
    }
    buildNotesTab(embed, caseData) {
        embed.addFields({ name: '📝 Notes', value: `Case: ${caseData.caseNumber}`, inline: false });
        if (caseData.notes.length > 0) {
            const notesList = caseData.notes
                .slice(0, 10) // Limit to 10 notes
                .map(note => {
                const typeEmoji = note.isInternal ? '🔒' : '📝';
                return `${typeEmoji} **${note.isInternal ? 'Internal' : 'General'} Note**\n` +
                    `By: <@${note.createdBy}>\n` +
                    `Date: ${note.createdAt.toDateString()}\n` +
                    `Content: ${note.content.length > 150 ? note.content.substring(0, 147) + '...' : note.content}`;
            })
                .join('\n\n');
            embed_utils_1.EmbedUtils.addFieldSafe(embed, '📋 Notes List', notesList);
            if (caseData.notes.length > 10) {
                embed.addFields({
                    name: 'Note',
                    value: `Showing first 10 of ${caseData.notes.length} notes.`,
                    inline: false
                });
            }
        }
        else {
            embed.addFields({ name: 'No Notes', value: 'No notes have been added to this case yet.', inline: false });
        }
    }
    buildTimelineTab(embed, caseData) {
        embed.addFields({ name: '⏰ Timeline', value: `Case: ${caseData.caseNumber}`, inline: false });
        const timelineEvents = [];
        // Add case creation
        if (caseData.createdAt) {
            timelineEvents.push({
                date: caseData.createdAt,
                event: `📋 Case created by <@${caseData.clientId}>`
            });
        }
        // Add lead attorney assignment
        if (caseData.leadAttorneyId && caseData.status !== case_1.CaseStatus.PENDING) {
            timelineEvents.push({
                date: caseData.updatedAt || caseData.createdAt || new Date(),
                event: `⚖️ Lead attorney assigned: <@${caseData.leadAttorneyId}>`
            });
        }
        // Add document additions
        caseData.documents.forEach(doc => {
            timelineEvents.push({
                date: doc.createdAt,
                event: `📄 Document added: "${doc.title}" by <@${doc.createdBy}>`
            });
        });
        // Add notes (non-internal only for timeline)
        caseData.notes.filter(note => !note.isInternal).forEach(note => {
            timelineEvents.push({
                date: note.createdAt,
                event: `📝 Note added by <@${note.createdBy}>`
            });
        });
        // Add case closure
        if (caseData.status === case_1.CaseStatus.CLOSED && caseData.closedAt) {
            const resultEmoji = caseData.result ? {
                [case_1.CaseResult.WIN]: '🏆',
                [case_1.CaseResult.LOSS]: '❌',
                [case_1.CaseResult.SETTLEMENT]: '🤝',
                [case_1.CaseResult.DISMISSED]: '🚫',
                [case_1.CaseResult.WITHDRAWN]: '↩️'
            }[caseData.result] : '✅';
            timelineEvents.push({
                date: caseData.closedAt,
                event: `${resultEmoji} Case closed${caseData.result ? ` (${caseData.result})` : ''} by <@${caseData.closedBy}>`
            });
        }
        // Sort by date and display
        timelineEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
        if (timelineEvents.length > 0) {
            const timelineText = timelineEvents
                .slice(0, 15) // Limit to 15 events
                .map(event => `**${event.date.toDateString()}** - ${event.event}`)
                .join('\n');
            embed_utils_1.EmbedUtils.addFieldSafe(embed, '📅 Events', timelineText);
            if (timelineEvents.length > 15) {
                embed.addFields({
                    name: 'Note',
                    value: `Showing first 15 of ${timelineEvents.length} timeline events.`,
                    inline: false
                });
            }
        }
        else {
            embed.addFields({ name: 'No Events', value: 'No timeline events found for this case.', inline: false });
        }
    }
    async handleTabNavigation(interaction) {
        try {
            // Parse the button custom ID: case_tab_{tab}_{caseId}
            const parts = interaction.customId.split('_');
            const tab = parts[2];
            const caseId = parts[3];
            if (!caseId) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Request', 'Unable to parse case information from button interaction.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const caseData = await this.caseService.getCaseById(caseId);
            if (!caseData) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Case Not Found', 'The case information could not be retrieved.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            await this.showCaseInfoTab(interaction, caseData, tab);
        }
        catch (error) {
            logger_1.logger.error('Error handling tab navigation:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Navigation Failed', 'An error occurred while switching tabs.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async createCaseChannel(caseData, interaction) {
        try {
            const guild = await interaction.client.guilds.fetch(caseData.guildId);
            const caseReviewCategoryId = await this.caseService.getCaseReviewCategoryId(caseData.guildId);
            if (!caseReviewCategoryId) {
                throw new Error('Case review category not configured');
            }
            const category = await guild.channels.fetch(caseReviewCategoryId);
            if (!category) {
                throw new Error('Case review category not found');
            }
            const channelName = this.caseService.generateChannelName(caseData.caseNumber);
            // Create channel with proper permissions
            const channel = await guild.channels.create({
                name: channelName,
                type: discord_js_1.ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [discord_js_1.PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: caseData.clientId,
                        allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory]
                    }
                    // Staff permissions would be added here based on role configuration
                ]
            });
            // Update case with channel ID
            await this.caseService.updateCase({
                caseId: caseData._id.toString(),
                status: case_1.CaseStatus.PENDING,
                channelId: channel.id
            });
            // Send case overview with accept/decline buttons
            await this.sendCaseOverview(caseData, channel);
            logger_1.logger.info('Case channel created', {
                caseId: caseData._id,
                channelId: channel.id,
                channelName
            });
        }
        catch (error) {
            logger_1.logger.error('Error creating case channel:', error);
            throw error;
        }
    }
    async sendCaseOverview(caseData, channel) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: '📋 New Case Review Request',
            color: 'info'
        });
        embed.addFields({ name: '📋 Case Number', value: caseData.caseNumber, inline: true }, { name: '👤 Client', value: `<@${caseData.clientId}>`, inline: true }, { name: '📅 Requested', value: caseData.createdAt?.toDateString() || 'Unknown', inline: true }, { name: '📝 Description', value: caseData.description, inline: false }, { name: '⚖️ Status', value: 'Pending Review', inline: true }, { name: '🏷️ Priority', value: caseData.priority.charAt(0).toUpperCase() + caseData.priority.slice(1), inline: true });
        // Create accept/decline buttons
        const acceptButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`case_accept_${caseData._id}`)
            .setLabel('Accept Case')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('✅');
        const declineButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`case_decline_${caseData._id}`)
            .setLabel('Decline Case')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('❌');
        const row = new discord_js_1.ActionRowBuilder()
            .addComponents(acceptButton, declineButton);
        await channel.send({
            embeds: [embed],
            components: [row]
        });
    }
    async handleCaseAccept(interaction) {
        try {
            const caseId = interaction.customId.replace('case_accept_', '');
            // Accept the case and assign the accepting user as lead attorney
            const caseServiceWithClient = this.getCaseServiceWithClient(interaction.client);
            const acceptedCase = await caseServiceWithClient.acceptCase(caseId, interaction.user.id);
            // Update the original message
            const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('✅ Case Accepted', `This case has been accepted by ${interaction.user.displayName}.\n\n` +
                `**Case Number:** ${acceptedCase.caseNumber}\n` +
                `**Lead Attorney:** <@${acceptedCase.leadAttorneyId}>\n` +
                `**Status:** Open\n\n` +
                `The case is now active and ready for legal work.`);
            // Replace with close case button
            const closeButton = new discord_js_1.ButtonBuilder()
                .setCustomId(`case_close_${acceptedCase._id}`)
                .setLabel('Close Case')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setEmoji('🔒');
            const closeRow = new discord_js_1.ActionRowBuilder()
                .addComponents(closeButton);
            await interaction.update({
                embeds: [embed],
                components: [closeRow]
            });
        }
        catch (error) {
            logger_1.logger.error('Error accepting case:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Accept Failed', error instanceof Error ? error.message : 'Failed to accept case.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async handleCaseClose(interaction) {
        try {
            const caseId = interaction.customId.replace('case_close_', '');
            // Show modal for case closure
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`case_close_modal_${caseId}`)
                .setTitle('Close Case');
            const resultInput = new discord_js_1.TextInputBuilder()
                .setCustomId('case_result')
                .setLabel('Case Result')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('win, loss, settlement, dismissed, withdrawn')
                .setRequired(true)
                .setMaxLength(20);
            const notesInput = new discord_js_1.TextInputBuilder()
                .setCustomId('case_notes')
                .setLabel('Closure Notes (Optional)')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setPlaceholder('Any additional notes about the case outcome...')
                .setRequired(false)
                .setMaxLength(1000);
            const resultRow = new discord_js_1.ActionRowBuilder()
                .addComponents(resultInput);
            const notesRow = new discord_js_1.ActionRowBuilder()
                .addComponents(notesInput);
            modal.addComponents(resultRow, notesRow);
            await interaction.showModal(modal);
        }
        catch (error) {
            logger_1.logger.error('Error showing case close modal:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Close Failed', 'An error occurred while preparing the case closure form.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async handleCaseDecline(interaction) {
        try {
            const caseId = interaction.customId.replace('case_decline_', '');
            // Show modal for decline reason
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`case_decline_reason_${caseId}`)
                .setTitle('Decline Case');
            const reasonInput = new discord_js_1.TextInputBuilder()
                .setCustomId('decline_reason')
                .setLabel('Reason for declining (optional)')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setPlaceholder('Provide feedback for the client...')
                .setRequired(false)
                .setMaxLength(1000);
            const row = new discord_js_1.ActionRowBuilder()
                .addComponents(reasonInput);
            modal.addComponents(row);
            await interaction.showModal(modal);
        }
        catch (error) {
            logger_1.logger.error('Error showing decline modal:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Decline Failed', 'An error occurred while declining the case.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async handleCaseCloseModal(interaction) {
        try {
            const caseId = interaction.customId.replace('case_close_modal_', '');
            const result = interaction.fields.getTextInputValue('case_result').toLowerCase();
            const notes = interaction.fields.getTextInputValue('case_notes') || undefined;
            // Validate result
            const validResults = ['win', 'loss', 'settlement', 'dismissed', 'withdrawn'];
            if (!validResults.includes(result)) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Result', `Please enter one of: ${validResults.join(', ')}`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check permissions - only client and lead counsel
            const caseData = await this.caseService.getCaseById(caseId);
            if (!caseData) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Case Not Found', 'The case could not be found.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const isClient = interaction.user.id === caseData.clientId;
            const isLeadCounsel = interaction.user.id === caseData.leadAttorneyId;
            if (!isClient && !isLeadCounsel) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'Only the client or lead counsel can close this case.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const closureRequest = {
                caseId: caseId,
                result: result,
                resultNotes: notes,
                closedBy: interaction.user.id
            };
            const closedCase = await this.caseService.closeCase(closureRequest);
            // Archive the channel
            await this.archiveCaseChannel(closedCase, interaction);
            const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('Case Closed', `Case **${closedCase.caseNumber}** has been closed successfully.\n\n` +
                `**Result:** ${result.charAt(0).toUpperCase() + result.slice(1)}\n` +
                `**Closed by:** ${interaction.user.displayName}\n` +
                `${notes ? `**Notes:** ${notes}` : ''}\n\n` +
                `The case channel will be moved to the archive category.`);
            await interaction.reply({ embeds: [embed] });
            // Update the original message containing the case overview to remove the close button
            await this.updateCaseOverviewMessage(closedCase, interaction.guildId, interaction);
        }
        catch (error) {
            logger_1.logger.error('Error processing case close modal:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Close Failed', error instanceof Error ? error.message : 'Failed to close case.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async handleDeclineReason(interaction) {
        try {
            const caseId = interaction.customId.replace('case_decline_reason_', '');
            const reason = interaction.fields.getTextInputValue('decline_reason') || 'No reason provided';
            // Decline the case
            const declinedCase = await this.caseService.declineCase(caseId, interaction.user.id, reason);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('❌ Case Declined', `This case has been declined by ${interaction.user.displayName}.\n\n` +
                `**Case Number:** ${declinedCase.caseNumber}\n` +
                `**Reason:** ${reason}\n\n` +
                `The client has been notified of the decision.`);
            // Disable buttons
            const disabledAccept = new discord_js_1.ButtonBuilder()
                .setCustomId('disabled_accept')
                .setLabel('Accept')
                .setStyle(discord_js_1.ButtonStyle.Secondary)
                .setDisabled(true);
            const disabledDecline = new discord_js_1.ButtonBuilder()
                .setCustomId('disabled_decline')
                .setLabel('Declined')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setDisabled(true);
            const disabledRow = new discord_js_1.ActionRowBuilder()
                .addComponents(disabledAccept, disabledDecline);
            await interaction.reply({
                embeds: [embed],
                components: [disabledRow]
            });
            // Archive the channel since case is declined
            await this.archiveCaseChannel(declinedCase, interaction);
        }
        catch (error) {
            logger_1.logger.error('Error processing case decline:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Decline Failed', error instanceof Error ? error.message : 'Failed to decline case.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async archiveCaseChannel(caseData, interaction) {
        try {
            const guild = await interaction.client.guilds.fetch(caseData.guildId);
            const archiveCategoryId = await this.caseService.getCaseArchiveCategoryId(caseData.guildId);
            if (!archiveCategoryId) {
                logger_1.logger.warn('Archive category not configured, channel will remain in current category', {
                    caseId: caseData._id,
                    guildId: caseData.guildId
                });
                return;
            }
            const archiveCategory = await guild.channels.fetch(archiveCategoryId);
            if (!archiveCategory) {
                logger_1.logger.warn('Archive category not found', {
                    archiveCategoryId,
                    guildId: caseData.guildId
                });
                return;
            }
            const channel = await guild.channels.fetch(interaction.channelId);
            if (channel) {
                await channel.setParent(archiveCategory, { reason: `Case ${caseData.caseNumber} closed` });
                logger_1.logger.info('Case channel archived', {
                    caseId: caseData._id,
                    channelId: channel.id,
                    archiveCategoryId
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error archiving case channel:', error);
            // Don't throw error as this shouldn't block case closure
        }
    }
    async getCaseFromChannel(channelId) {
        // This would typically involve parsing the channel name or maintaining a mapping
        // For now, we'll implement a simple approach by checking all cases for this channel
        // In production, you might want to maintain a channel -> case mapping
        try {
            // Find case by channel ID
            const cases = await this.caseRepository.findByFilters({ channelId });
            return cases.length > 0 ? (cases[0] || null) : null;
        }
        catch {
            return null;
        }
    }
    async updateCaseOverviewMessage(closedCase, guildId, interaction) {
        try {
            const guild = await interaction.client.guilds.fetch(guildId);
            const channel = await guild.channels.fetch(closedCase.channelId);
            if (!channel) {
                logger_1.logger.warn('Could not find case channel to update overview message', {
                    caseId: closedCase._id,
                    channelId: closedCase.channelId
                });
                return;
            }
            // Fetch recent messages to find the one with the close button
            const messages = await channel.messages.fetch({ limit: 50 });
            const caseOverviewMessage = messages.find(msg => msg.author.id === interaction.client.user?.id &&
                msg.components.length > 0 &&
                msg.components[0] &&
                'components' in msg.components[0] &&
                msg.components[0].components.some((component) => component.customId?.startsWith('case_close_')));
            if (!caseOverviewMessage) {
                logger_1.logger.warn('Could not find case overview message to update', {
                    caseId: closedCase._id,
                    channelId: closedCase.channelId
                });
                return;
            }
            // Create updated embed showing the case is closed
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: `🔒 Case Closed: ${closedCase.caseNumber}`,
                description: `**Client:** <@${closedCase.clientId}>\n` +
                    `**Lead Attorney:** <@${closedCase.leadAttorneyId}>\n` +
                    `**Status:** Closed\n` +
                    `**Result:** ${closedCase.result ? closedCase.result.charAt(0).toUpperCase() + closedCase.result.slice(1) : 'Unknown'}\n` +
                    `**Closed Date:** ${closedCase.closedAt ? new Date(closedCase.closedAt).toLocaleDateString() : 'Unknown'}\n` +
                    `**Closed By:** <@${closedCase.closedBy}>\n\n` +
                    `${closedCase.resultNotes ? `**Notes:** ${closedCase.resultNotes}\n\n` : ''}` +
                    `This case has been completed and archived.`
            });
            // Update the message without any buttons
            await caseOverviewMessage.edit({
                embeds: [embed],
                components: []
            });
            logger_1.logger.info('Case overview message updated successfully', {
                caseId: closedCase._id,
                messageId: caseOverviewMessage.id
            });
        }
        catch (error) {
            logger_1.logger.error('Error updating case overview message:', error);
            // Don't throw error as this shouldn't block case closure
        }
    }
    async setLeadAttorney(attorney, interaction) {
        try {
            // This command works within case channels or requires case permission
            const caseData = await this.getCaseFromChannel(interaction.channelId);
            if (!caseData) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Channel', 'This command can only be used within case channels.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check permissions: only current lead attorney or users with case permissions
            const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
            const permissionService = new permission_service_1.PermissionService(guildConfigRepository);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            const isCurrentLeadAttorney = caseData.leadAttorneyId === interaction.user.id;
            if (!hasPermission && !isCurrentLeadAttorney) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'You must have case management permissions or be the current lead attorney to change the lead attorney.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            await interaction.deferReply();
            const caseServiceWithClient = this.getCaseServiceWithClient(interaction.client);
            const updatedCase = await caseServiceWithClient.setLeadAttorney(caseData._id.toHexString(), attorney.id, interaction.user.id);
            const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('Lead Attorney Updated', `**Case:** ${updatedCase.caseNumber}\n` +
                `**New Lead Attorney:** <@${attorney.id}>\n` +
                `**Previous Lead Attorney:** ${caseData.leadAttorneyId ? `<@${caseData.leadAttorneyId}>` : 'None'}\n\n` +
                `The lead attorney has been successfully updated. Channel permissions have been updated accordingly.`);
            await interaction.editReply({ embeds: [embed] });
            // Log the action
            logger_1.logger.info('Lead attorney updated via command', {
                caseId: updatedCase._id,
                caseNumber: updatedCase.caseNumber,
                newLeadAttorney: attorney.id,
                previousLeadAttorney: caseData.leadAttorneyId,
                changedBy: interaction.user.id,
                guildId: interaction.guildId
            });
        }
        catch (error) {
            logger_1.logger.error('Error setting lead attorney:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Error', error instanceof Error ? error.message : 'Failed to set lead attorney');
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [embed] });
            }
            else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    }
};
exports.CaseCommands = CaseCommands;
__decorate([
    (0, discordx_1.Slash)({
        description: 'Request a case review (client-facing)',
        name: 'review'
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Brief description of your legal matter',
        name: 'details',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "reviewCase", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Assign a lawyer to a case (staff only)',
        name: 'assign'
    }),
    (0, discordx_1.Guard)(async (interaction, _client, next) => {
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
        const hasPermission = await permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            await interaction.reply({
                content: '❌ You do not have permission to manage cases. Case permission required.',
                ephemeral: true,
            });
            return;
        }
        await next();
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'The lawyer to assign to the case',
        name: 'lawyer',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "assignCase", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Close a case with outcome',
        name: 'close'
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Case result',
        name: 'result',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'Additional notes about the case outcome',
        name: 'notes',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "closeCase", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'List cases with filtering options',
        name: 'list'
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Filter by case status',
        name: 'status',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'Filter by assigned lawyer',
        name: 'lawyer',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: false
    })),
    __param(2, (0, discordx_1.SlashOption)({
        description: 'Search in case titles',
        name: 'search',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __param(3, (0, discordx_1.SlashOption)({
        description: 'Page number (default: 1)',
        name: 'page',
        type: discord_js_1.ApplicationCommandOptionType.Integer,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "listCases", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Reassign a staff member from their current case to a new case',
        name: 'reassign'
    }),
    (0, discordx_1.Guard)(async (interaction, _client, next) => {
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
        const hasPermission = await permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            await interaction.reply({
                content: '❌ You do not have permission to manage cases. Case permission required.',
                ephemeral: true,
            });
            return;
        }
        await next();
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'The staff member to reassign',
        name: 'staff',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'The new case channel to assign them to',
        name: 'newcasechannel',
        type: discord_js_1.ApplicationCommandOptionType.Channel,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User, Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "reassignStaff", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Unassign a staff member from their current case',
        name: 'unassign'
    }),
    (0, discordx_1.Guard)(async (interaction, _client, next) => {
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
        const hasPermission = await permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            await interaction.reply({
                content: '❌ You do not have permission to manage cases. Case permission required.',
                ephemeral: true,
            });
            return;
        }
        await next();
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'The staff member to unassign',
        name: 'staff',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "unassignStaff", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'View detailed case information with tabbed interface',
        name: 'info'
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Case number (optional if used in case channel)',
        name: 'casenumber',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "caseInfo", null);
__decorate([
    (0, discordx_1.ButtonComponent)({ id: /^case_tab_/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ButtonInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "handleTabNavigation", null);
__decorate([
    (0, discordx_1.ButtonComponent)({ id: /^case_accept_/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ButtonInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "handleCaseAccept", null);
__decorate([
    (0, discordx_1.ButtonComponent)({ id: /^case_close_/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ButtonInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "handleCaseClose", null);
__decorate([
    (0, discordx_1.ButtonComponent)({ id: /^case_decline_/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ButtonInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "handleCaseDecline", null);
__decorate([
    (0, discordx_1.ModalComponent)({ id: /^case_close_modal_/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ModalSubmitInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "handleCaseCloseModal", null);
__decorate([
    (0, discordx_1.ModalComponent)({ id: /^case_decline_reason_/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ModalSubmitInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "handleDeclineReason", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Set the lead attorney for a case',
        name: 'set-lead-attorney'
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'The new lead attorney',
        name: 'attorney',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "setLeadAttorney", null);
exports.CaseCommands = CaseCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ description: 'Case management commands', name: 'case' }),
    (0, discordx_1.SlashGroup)('case'),
    __metadata("design:paramtypes", [])
], CaseCommands);
//# sourceMappingURL=case-commands.js.map