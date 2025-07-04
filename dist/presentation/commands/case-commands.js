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
var CaseCommands_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseCommands = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const case_service_1 = require("../../application/services/case-service");
const permission_service_1 = require("../../application/services/permission-service");
const validation_service_factory_1 = require("../../application/validation/validation-service-factory");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const application_repository_1 = require("../../infrastructure/repositories/application-repository");
const job_repository_1 = require("../../infrastructure/repositories/job-repository");
// import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
const feedback_repository_1 = require("../../infrastructure/repositories/feedback-repository");
// import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const logger_1 = require("../../infrastructure/logger");
const base_command_1 = require("./base-command");
const validation_decorators_1 = require("../decorators/validation-decorators");
const audit_decorators_1 = require("../decorators/audit-decorators");
const audit_log_1 = require("../../domain/entities/audit-log");
const case_1 = require("../../domain/entities/case");
const validation_1 = require("../../validation");
let CaseCommands = CaseCommands_1 = class CaseCommands extends base_command_1.BaseCommand {
    constructor() {
        super();
        const caseRepository = new case_repository_1.CaseRepository();
        const caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const staffRepository = new staff_repository_1.StaffRepository();
        const auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        const applicationRepository = new application_repository_1.ApplicationRepository();
        const jobRepository = new job_repository_1.JobRepository();
        // const retainerRepository = new RetainerRepository();
        const feedbackRepository = new feedback_repository_1.FeedbackRepository();
        // const reminderRepository = new ReminderRepository();
        this.caseRepository = caseRepository;
        this.auditLogRepository = auditLogRepository;
        this.feedbackRepository = feedbackRepository;
        // Initialize services
        this.permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        // Create unified validation service
        const validationService = validation_service_factory_1.ValidationServiceFactory.createValidationService({
            staffRepository,
            caseRepository,
            guildConfigRepository,
            jobRepository,
            applicationRepository
        }, {
            permissionService: this.permissionService
        });
        this.caseService = new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository, this.permissionService, validationService);
    }
    getCaseServiceWithClient(client) {
        const caseRepository = new case_repository_1.CaseRepository();
        const caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const staffRepository = new staff_repository_1.StaffRepository();
        const jobRepository = new job_repository_1.JobRepository();
        const applicationRepository = new application_repository_1.ApplicationRepository();
        // Create unified validation service
        const validationService = validation_service_factory_1.ValidationServiceFactory.createValidationService({
            staffRepository,
            caseRepository,
            guildConfigRepository,
            jobRepository,
            applicationRepository
        }, {
            permissionService: this.permissionService
        });
        return new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository, this.permissionService, validationService, client);
    }
    async reviewCase(details, interaction) {
        try {
            await this.deferReply(interaction, true);
            // Validate guild context
            if (!interaction.guildId) {
                await this.safeReply(interaction, {
                    embeds: [this.createErrorEmbed('Invalid Server', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            // Validate command inputs using Zod schema
            const commandData = {
                title: 'Legal consultation request',
                description: details,
                priority: 'medium',
                interaction
            };
            const validatedData = validation_1.ValidationHelpers.validateOrThrow(validation_1.CaseOpenCommandSchema, commandData, 'Case review command');
            const guildId = interaction.guildId;
            const clientId = interaction.user.id;
            const clientUsername = interaction.user.username;
            // Check if case review category is configured
            const caseReviewCategoryId = await this.caseService.getCaseReviewCategoryId(guildId);
            if (!caseReviewCategoryId) {
                const embed = this.createErrorEmbed('Configuration Required', 'Case review category must be configured before requesting case reviews. Please contact an administrator.');
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
                return;
            }
            // Create the case
            const caseRequest = {
                guildId,
                clientId,
                clientUsername,
                title: validatedData.title,
                description: validatedData.description,
                priority: validatedData.priority
            };
            const context = await this.getPermissionContext(interaction);
            const newCase = await this.caseService.createCase(context, caseRequest);
            // Create case channel
            await this.createCaseChannel(newCase, interaction);
            // Log the action
            this.logCommandExecution(interaction, 'case_review_requested', {
                caseNumber: newCase.caseNumber,
                clientId,
                priority: newCase.priority
            });
            // Confirm to client
            const confirmationEmbed = this.createSuccessEmbed('Case Review Requested', `Your case review request has been submitted successfully!\n\n` +
                `**Case Number:** \`${newCase.caseNumber}\`\n` +
                `**Description:** ${details}\n\n` +
                `A private case channel has been created where our legal team will review your request. You'll be notified once a lawyer accepts your case.`);
            await this.safeReply(interaction, { embeds: [confirmationEmbed], ephemeral: true });
        }
        catch (error) {
            this.logCommandError(interaction, 'case_review_failed', error);
            // Handle Zod validation errors with user-friendly messages
            if (error instanceof Error && error.message.includes('Validation failed')) {
                const embed = this.createErrorEmbed('Validation Error', `${error.message}\n\nPlease contact the bot developer if this issue persists.`);
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
            }
            else {
                let errorMessage = 'An unexpected error occurred while submitting your case review request.';
                if (error instanceof Error) {
                    errorMessage = error.message;
                }
                const embed = this.createErrorEmbed('Case Review Failed', errorMessage);
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
            }
        }
    }
    async assignCase(lawyer, interaction) {
        try {
            await this.deferReply(interaction);
            // Validate guild context
            if (!interaction.guildId) {
                await this.safeReply(interaction, {
                    embeds: [this.createErrorEmbed('Invalid Server', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            // This command only works within case channels
            const caseData = await this.getCaseFromChannel(interaction.channelId);
            if (!caseData) {
                const embed = this.createErrorEmbed('Invalid Channel', 'This command can only be used within case channels.');
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
                return;
            }
            // Validate command inputs using Zod schema
            const commandData = {
                caseNumber: caseData.caseNumber,
                lawyer,
                leadAttorney: false, // Default value for assign command
                interaction
            };
            const validatedData = validation_1.ValidationHelpers.validateOrThrow(validation_1.CaseAssignCommandSchema, commandData, 'Case assign command');
            const assignmentRequest = {
                caseId: caseData._id.toString(),
                lawyerIds: [validatedData.lawyer.id],
                assignedBy: interaction.user.id
            };
            const context = await this.getPermissionContext(interaction);
            const updatedCase = await this.caseService.assignLawyer(context, assignmentRequest);
            const embed = this.createSuccessEmbed('Lawyer Assigned', `${lawyer.displayName} has been assigned to case **${updatedCase.caseNumber}**.\n\n` +
                `${updatedCase.leadAttorneyId === lawyer.id ? '**Lead Attorney:** Yes' : '**Lead Attorney:** No'}\n` +
                `**Total Assigned Lawyers:** ${updatedCase.assignedLawyerIds.length}`);
            await this.safeReply(interaction, { embeds: [embed] });
            this.logCommandExecution(interaction, 'lawyer_assigned', {
                caseNumber: updatedCase.caseNumber,
                lawyerId: lawyer.id,
                isLeadAttorney: updatedCase.leadAttorneyId === lawyer.id
            });
        }
        catch (error) {
            this.logCommandError(interaction, 'assign_lawyer_failed', error);
            // Handle Zod validation errors with user-friendly messages
            if (error instanceof Error && error.message.includes('Validation failed')) {
                const embed = this.createErrorEmbed('Validation Error', `${error.message}\n\nPlease contact the bot developer if this issue persists.`);
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
            }
            else {
                const embed = this.createErrorEmbed('Assignment Failed', error instanceof Error ? error.message : 'Failed to assign lawyer to case.');
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
            }
        }
    }
    async transferCase(caseNumber, fromLawyer, toLawyer, reason, interaction) {
        try {
            await this.deferReply(interaction);
            // Get the case
            const context = await this.getPermissionContext(interaction);
            const caseData = await this.caseService.getCaseByCaseNumber(context, caseNumber);
            if (!caseData) {
                const embed = this.createErrorEmbed('Case Not Found', `Case ${caseNumber} not found.`);
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
                return;
            }
            // Verify the source lawyer is assigned to the case
            if (!caseData.assignedLawyerIds.includes(fromLawyer.id)) {
                const embed = this.createErrorEmbed('Invalid Transfer', `${fromLawyer.displayName} is not assigned to case ${caseNumber}.`);
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
                return;
            }
            // Check if target lawyer is already assigned
            if (caseData.assignedLawyerIds.includes(toLawyer.id)) {
                const embed = this.createErrorEmbed('Already Assigned', `${toLawyer.displayName} is already assigned to case ${caseNumber}.`);
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
                return;
            }
            // Validate case limits for target lawyer
            const targetCases = await this.caseRepository.findByLawyer(toLawyer.id);
            const activeCases = targetCases.filter(c => c.status === case_1.CaseStatus.IN_PROGRESS);
            if (activeCases.length >= 10) { // Configurable limit
                const embed = this.createWarningEmbed('Case Limit Warning', `${toLawyer.displayName} already has ${activeCases.length} active cases. Consider their workload before transferring.`);
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            }
            // Perform the transfer
            await this.caseService.reassignLawyer(context, caseData._id.toString(), caseData._id.toString(), // Same case, just changing lawyers
            toLawyer.id);
            // Remove the original lawyer
            await this.caseService.unassignLawyer(context, caseData._id.toString(), fromLawyer.id);
            // Channel permissions will be updated automatically by the case service
            // Send notifications
            const notificationEmbed = this.createInfoEmbed('Case Transfer Notification', `Case **${caseNumber}** has been transferred.\n\n` +
                `**From:** ${fromLawyer.displayName}\n` +
                `**To:** ${toLawyer.displayName}\n` +
                `**Transferred by:** ${interaction.user.displayName}\n` +
                `${reason ? `**Reason:** ${reason}` : ''}`);
            // Try to send DMs to both lawyers
            try {
                await fromLawyer.send({ embeds: [notificationEmbed] });
            }
            catch (e) {
                logger_1.logger.warn('Could not send DM to source lawyer', { userId: fromLawyer.id });
            }
            try {
                await toLawyer.send({ embeds: [notificationEmbed] });
            }
            catch (e) {
                logger_1.logger.warn('Could not send DM to target lawyer', { userId: toLawyer.id });
            }
            // Log audit
            await this.auditLogRepository.add({
                guildId: interaction.guildId,
                action: audit_log_1.AuditAction.CASE_ASSIGNED,
                actorId: interaction.user.id,
                targetId: caseData._id.toString(),
                timestamp: new Date(),
                details: {
                    metadata: {
                        fromLawyer: fromLawyer.id,
                        toLawyer: toLawyer.id
                    },
                    reason
                }
            });
            const successEmbed = this.createSuccessEmbed('Case Transferred', `Case **${caseNumber}** has been successfully transferred from ${fromLawyer.displayName} to ${toLawyer.displayName}.`);
            await this.safeReply(interaction, { embeds: [successEmbed] });
        }
        catch (error) {
            this.logCommandError(interaction, 'case_transfer_failed', error);
            const embed = this.createErrorEmbed('Transfer Failed', error instanceof Error ? error.message : 'Failed to transfer case.');
            await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
    }
    async bulkCloseCases(result, interaction) {
        try {
            // Validate result
            const validResults = ['win', 'loss', 'settlement', 'dismissed', 'withdrawn'];
            if (!validResults.includes(result.toLowerCase())) {
                const embed = this.createErrorEmbed('Invalid Result', `Please enter one of: ${validResults.join(', ')}`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            await this.deferReply(interaction);
            // Get open cases for the guild
            const openCases = await this.caseRepository.findByFilters({
                guildId: interaction.guildId,
                status: case_1.CaseStatus.IN_PROGRESS
            });
            if (openCases.length === 0) {
                const embed = this.createInfoEmbed('No Open Cases', 'There are no open cases to close.');
                await this.safeReply(interaction, { embeds: [embed] });
                return;
            }
            // Create select menu for case selection
            const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId('bulk_close_select')
                .setPlaceholder('Select cases to close')
                .setMinValues(1)
                .setMaxValues(Math.min(openCases.length, 25)); // Discord limit
            openCases.slice(0, 25).forEach(caseData => {
                selectMenu.addOptions({
                    label: `${caseData.caseNumber} - ${caseData.title}`,
                    description: `Client: ${caseData.clientUsername}`,
                    value: caseData._id.toString()
                });
            });
            const row = new discord_js_1.ActionRowBuilder()
                .addComponents(selectMenu);
            const embed = this.createInfoEmbed('Select Cases to Close', `Found ${openCases.length} open cases. Select the ones you want to close with result: **${result}**`);
            // Store result in custom ID for later use
            interaction.client.caseClosureResult = result;
            await interaction.reply({ embeds: [embed], components: [row] });
        }
        catch (error) {
            this.logCommandError(interaction, 'bulk_close_failed', error);
            const embed = this.createErrorEmbed('Bulk Close Failed', error instanceof Error ? error.message : 'Failed to initiate bulk close.');
            await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
    }
    async handleBulkCloseSelection(interaction) {
        try {
            await interaction.deferUpdate();
            const selectedCaseIds = interaction.values;
            const result = interaction.client.caseClosureResult || 'dismissed';
            const closedBy = interaction.user.id;
            let successCount = 0;
            let failedCount = 0;
            const closureDetails = [];
            // Process each selected case
            const context = await this.getPermissionContext(interaction);
            for (const caseId of selectedCaseIds) {
                try {
                    const caseData = await this.caseService.getCaseById(context, caseId);
                    if (!caseData) {
                        failedCount++;
                        continue;
                    }
                    const closureRequest = {
                        caseId,
                        result: result,
                        resultNotes: 'Bulk closure',
                        closedBy
                    };
                    const closedCase = await this.caseService.closeCase(context, closureRequest);
                    successCount++;
                    closureDetails.push(`✅ ${closedCase.caseNumber}`);
                    // Archive channel if exists
                    if (closedCase.channelId) {
                        await this.archiveCaseChannel(closedCase, interaction);
                    }
                }
                catch (error) {
                    failedCount++;
                    closureDetails.push(`❌ Case ${caseId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            // Clean up stored result
            delete interaction.client.caseClosureResult;
            // Create summary report
            const embed = this.createInfoEmbed('Bulk Close Summary', `Processed ${selectedCaseIds.length} cases:\n` +
                `✅ Successfully closed: ${successCount}\n` +
                `❌ Failed: ${failedCount}\n\n` +
                `**Details:**\n${closureDetails.join('\n')}`);
            await interaction.editReply({ embeds: [embed], components: [] });
            // Log audit
            await this.auditLogRepository.add({
                guildId: interaction.guildId,
                action: audit_log_1.AuditAction.CASE_CLOSED,
                actorId: closedBy,
                timestamp: new Date(),
                details: {
                    metadata: {
                        totalCases: selectedCaseIds.length,
                        successCount,
                        failedCount,
                        result,
                        bulkOperation: true
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error handling bulk close selection:', error);
            const embed = this.createErrorEmbed('Processing Failed', 'An error occurred while processing the bulk closure.');
            await interaction.editReply({ embeds: [embed], components: [] });
        }
    }
    async caseAnalytics(period = 30, interaction) {
        try {
            await this.deferReply(interaction);
            const guildId = interaction.guildId;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);
            // Get all cases
            const allCases = await this.caseRepository.findByFilters({ guildId });
            const recentCases = allCases.filter((c) => c.createdAt && c.createdAt >= startDate);
            // Calculate statistics
            const stats = {
                total: allCases.length,
                recent: recentCases.length,
                byStatus: {
                    pending: allCases.filter((c) => c.status === case_1.CaseStatus.PENDING).length,
                    inProgress: allCases.filter((c) => c.status === case_1.CaseStatus.IN_PROGRESS).length,
                    closed: allCases.filter((c) => c.status === case_1.CaseStatus.CLOSED).length
                },
                byResult: {
                    win: allCases.filter((c) => c.result === case_1.CaseResult.WIN).length,
                    loss: allCases.filter((c) => c.result === case_1.CaseResult.LOSS).length,
                    settlement: allCases.filter((c) => c.result === case_1.CaseResult.SETTLEMENT).length,
                    dismissed: allCases.filter((c) => c.result === case_1.CaseResult.DISMISSED).length,
                    withdrawn: allCases.filter((c) => c.result === case_1.CaseResult.WITHDRAWN).length
                }
            };
            // Calculate lawyer workload
            const lawyerWorkload = new Map();
            const activeCases = allCases.filter((c) => c.status === case_1.CaseStatus.IN_PROGRESS);
            activeCases.forEach((caseData) => {
                caseData.assignedLawyerIds.forEach((lawyerId) => {
                    lawyerWorkload.set(lawyerId, (lawyerWorkload.get(lawyerId) || 0) + 1);
                });
            });
            // Get top lawyers by workload
            const topLawyers = Array.from(lawyerWorkload.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            // Calculate average case duration
            const closedCases = allCases.filter((c) => c.status === case_1.CaseStatus.CLOSED && c.closedAt && c.createdAt);
            let avgDuration = 0;
            if (closedCases.length > 0) {
                const totalDuration = closedCases.reduce((sum, c) => {
                    const duration = (c.closedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                    return sum + duration;
                }, 0);
                avgDuration = totalDuration / closedCases.length;
            }
            // Get client satisfaction (from feedback)
            const feedbacks = await this.feedbackRepository.findByFilters({ guildId });
            const avgRating = feedbacks.length > 0
                ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
                : 0;
            // Create analytics embed
            const embed = this.createInfoEmbed('📊 Case Analytics', `Analytics for the last ${period} days`, [
                {
                    name: '📈 Overview',
                    value: `**Total Cases:** ${stats.total}\n` +
                        `**Recent Cases (${period} days):** ${stats.recent}\n` +
                        `**Average Case Duration:** ${avgDuration.toFixed(1)} days\n` +
                        `**Client Satisfaction:** ${avgRating.toFixed(1)}/5 ⭐`,
                    inline: false
                },
                {
                    name: '📋 Status Distribution',
                    value: `⏳ Pending: ${stats.byStatus.pending}\n` +
                        `🔄 In Progress: ${stats.byStatus.inProgress}\n` +
                        `✅ Closed: ${stats.byStatus.closed}`,
                    inline: true
                },
                {
                    name: '🏆 Case Results',
                    value: `🏆 Wins: ${stats.byResult.win}\n` +
                        `❌ Losses: ${stats.byResult.loss}\n` +
                        `🤝 Settlements: ${stats.byResult.settlement}\n` +
                        `🚫 Dismissed: ${stats.byResult.dismissed}\n` +
                        `↩️ Withdrawn: ${stats.byResult.withdrawn}`,
                    inline: true
                },
                {
                    name: '👥 Top Lawyers by Active Cases',
                    value: topLawyers.length > 0
                        ? topLawyers.map(([id, count]) => `<@${id}>: ${count} cases`).join('\n')
                        : 'No active cases',
                    inline: false
                }
            ]);
            // Add trend analysis
            const trendAnalysis = this.analyzeTrends(allCases, period);
            if (trendAnalysis) {
                embed.addFields({
                    name: '📈 Trends',
                    value: trendAnalysis,
                    inline: false
                });
            }
            await this.safeReply(interaction, { embeds: [embed] });
        }
        catch (error) {
            this.logCommandError(interaction, 'case_analytics_failed', error);
            const embed = this.createErrorEmbed('Analytics Failed', error instanceof Error ? error.message : 'Failed to generate analytics.');
            await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
    }
    async createTemplate(name, description, priority, defaultTitle, interaction) {
        try {
            const guildId = interaction.guildId;
            const validPriorities = ['low', 'medium', 'high', 'urgent'];
            if (!validPriorities.includes(priority.toLowerCase())) {
                const embed = this.createErrorEmbed('Invalid Priority', `Priority must be one of: ${validPriorities.join(', ')}`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Create template
            const template = {
                id: `template_${Date.now()}`,
                name,
                description,
                priority: priority.toLowerCase(),
                defaultTitle
            };
            // Store template
            if (!CaseCommands_1.caseTemplates.has(guildId)) {
                CaseCommands_1.caseTemplates.set(guildId, new Map());
            }
            CaseCommands_1.caseTemplates.get(guildId).set(template.id, template);
            const embed = this.createSuccessEmbed('Template Created', `Case template **${name}** has been created successfully.\n\n` +
                `**Description:** ${description}\n` +
                `**Default Priority:** ${priority}\n` +
                `${defaultTitle ? `**Default Title:** ${defaultTitle}` : ''}`);
            await interaction.reply({ embeds: [embed] });
            this.logCommandExecution(interaction, 'case_template_created', {
                templateId: template.id,
                name,
                priority
            });
        }
        catch (error) {
            this.logCommandError(interaction, 'create_template_failed', error);
            const embed = this.createErrorEmbed('Template Creation Failed', error instanceof Error ? error.message : 'Failed to create template.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async useTemplate(details, interaction) {
        try {
            const guildId = interaction.guildId;
            const templates = CaseCommands_1.caseTemplates.get(guildId);
            if (!templates || templates.size === 0) {
                const embed = this.createErrorEmbed('No Templates', 'No case templates have been created yet. Ask an administrator to create templates.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Create select menu for template selection
            const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId('template_select')
                .setPlaceholder('Select a case template');
            Array.from(templates.values()).forEach(template => {
                selectMenu.addOptions({
                    label: template.name,
                    description: template.description,
                    value: template.id
                });
            });
            const row = new discord_js_1.ActionRowBuilder()
                .addComponents(selectMenu);
            const embed = this.createInfoEmbed('Select Template', 'Choose a case template to use for your new case.');
            // Store details for later use
            interaction.client.templateCaseDetails = {
                userId: interaction.user.id,
                details
            };
            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
        catch (error) {
            this.logCommandError(interaction, 'use_template_failed', error);
            const embed = this.createErrorEmbed('Template Usage Failed', error instanceof Error ? error.message : 'Failed to use template.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async handleTemplateSelection(interaction) {
        try {
            await interaction.deferUpdate();
            const guildId = interaction.guildId;
            const templateId = interaction.values[0];
            const template = templateId ? CaseCommands_1.caseTemplates.get(guildId)?.get(templateId) : undefined;
            if (!template) {
                const embed = this.createErrorEmbed('Template Not Found', 'The selected template no longer exists.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }
            const storedDetails = interaction.client.templateCaseDetails;
            if (!storedDetails || storedDetails.userId !== interaction.user.id) {
                const embed = this.createErrorEmbed('Session Expired', 'Please try the command again.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }
            // Create case from template
            const caseRequest = {
                guildId,
                clientId: interaction.user.id,
                clientUsername: interaction.user.username,
                title: template.defaultTitle || `${template.name} Case`,
                description: storedDetails.details,
                priority: template.priority
            };
            const context = await this.getPermissionContext(interaction);
            const newCase = await this.caseService.createCase(context, caseRequest);
            // Create case channel
            await this.createCaseChannel(newCase, interaction);
            // Clean up stored data
            delete interaction.client.templateCaseDetails;
            const embed = this.createSuccessEmbed('Case Created from Template', `Your case has been created using the **${template.name}** template.\n\n` +
                `**Case Number:** \`${newCase.caseNumber}\`\n` +
                `**Priority:** ${template.priority}\n` +
                `**Description:** ${storedDetails.details}`);
            await interaction.editReply({ embeds: [embed], components: [] });
        }
        catch (error) {
            logger_1.logger.error('Error handling template selection:', error);
            const embed = this.createErrorEmbed('Creation Failed', 'An error occurred while creating the case from template.');
            await interaction.editReply({ embeds: [embed], components: [] });
        }
    }
    async debugPermissions(caseNumber, user, interaction) {
        try {
            await this.deferReply(interaction, true);
            const context = await this.getPermissionContext(interaction);
            const caseData = await this.caseService.getCaseByCaseNumber(context, caseNumber);
            if (!caseData) {
                const embed = this.createErrorEmbed('Case Not Found', `Case ${caseNumber} not found.`);
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
                return;
            }
            // Get user's permission context
            const member = await interaction.guild?.members.fetch(user.id);
            if (!member) {
                const embed = this.createErrorEmbed('Member Not Found', 'Could not find member in guild.');
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
                return;
            }
            const permissionContext = {
                guildId: interaction.guildId,
                userId: user.id,
                userRoles: member.roles.cache.map(role => role.id),
                isGuildOwner: interaction.guild?.ownerId === user.id
            };
            // Check various permissions
            const permissions = {
                case: await this.permissionService.hasActionPermission(permissionContext, 'case'),
                lawyer: await this.permissionService.hasActionPermission(permissionContext, 'lawyer'),
                admin: await this.permissionService.hasActionPermission(permissionContext, 'admin'),
                leadAttorney: caseData.leadAttorneyId === user.id,
                assignedLawyer: caseData.assignedLawyerIds.includes(user.id),
                client: caseData.clientId === user.id
            };
            // Determine what actions they can perform
            const canPerform = {
                viewCase: permissions.client || permissions.assignedLawyer || permissions.case,
                closeCase: permissions.client || permissions.leadAttorney,
                assignLawyer: permissions.case,
                setLeadAttorney: permissions.case || permissions.leadAttorney,
                addNotes: permissions.assignedLawyer || permissions.case,
                addDocuments: permissions.assignedLawyer || permissions.case
            };
            // Build debug embed
            const embed = this.createInfoEmbed('Permission Debug Report', `Permission analysis for ${user.displayName} on case ${caseNumber}`, [
                {
                    name: '🔑 Permission Flags',
                    value: Object.entries(permissions)
                        .map(([key, value]) => `${value ? '✅' : '❌'} ${key}`)
                        .join('\n'),
                    inline: true
                },
                {
                    name: '⚡ Available Actions',
                    value: Object.entries(canPerform)
                        .map(([key, value]) => `${value ? '✅' : '❌'} ${key}`)
                        .join('\n'),
                    inline: true
                },
                {
                    name: '📋 Case Context',
                    value: `**Status:** ${caseData.status}\n` +
                        `**Client:** <@${caseData.clientId}>\n` +
                        `**Lead Attorney:** ${caseData.leadAttorneyId ? `<@${caseData.leadAttorneyId}>` : 'None'}\n` +
                        `**Assigned Lawyers:** ${caseData.assignedLawyerIds.length}`,
                    inline: false
                },
                {
                    name: '🛡️ Permission Inheritance',
                    value: `**Guild Owner:** ${permissionContext.isGuildOwner ? 'Yes (bypasses all checks)' : 'No'}\n` +
                        `**Admin Permission:** ${permissions.admin ? 'Yes' : 'No'}\n` +
                        `**Case Permission:** ${permissions.case ? 'Yes' : 'No'}\n` +
                        `**Roles:** ${member.roles.cache.size - 1} custom roles`,
                    inline: false
                }
            ]);
            await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
        catch (error) {
            this.logCommandError(interaction, 'debug_permissions_failed', error);
            const embed = this.createErrorEmbed('Debug Failed', error instanceof Error ? error.message : 'Failed to debug permissions.');
            await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
    }
    async closeCase(result, notes, interaction) {
        try {
            // Validate guild context
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Server', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            // This command works within case channels or staff can specify case ID
            const caseData = await this.getCaseFromChannel(interaction.channelId);
            if (!caseData) {
                const embed = this.createErrorEmbed('Invalid Channel', 'This command can only be used within case channels.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Validate command inputs using Zod schema
            const commandData = {
                caseNumber: caseData.caseNumber,
                result,
                notes,
                interaction
            };
            const validatedData = validation_1.ValidationHelpers.validateOrThrow(validation_1.CaseCloseCommandSchema, commandData, 'Case close command');
            // Check permissions: only client or lead counsel can close cases
            const isClient = caseData.clientId === interaction.user.id;
            const isLeadCounsel = caseData.leadAttorneyId === interaction.user.id;
            if (!isClient && !isLeadCounsel) {
                const embed = this.createErrorEmbed('Permission Denied', 'Only the client or lead counsel can close cases.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const closureRequest = {
                caseId: caseData._id.toString(),
                result: validatedData.result,
                resultNotes: validatedData.notes || undefined,
                closedBy: interaction.user.id
            };
            const context = await this.getPermissionContext(interaction);
            const closedCase = await this.caseService.closeCase(context, closureRequest);
            // Archive the channel
            await this.archiveCaseChannel(closedCase, interaction);
            const embed = this.createSuccessEmbed('Case Closed', `Case **${closedCase.caseNumber}** has been closed successfully.\n\n` +
                `**Result:** ${result.charAt(0).toUpperCase() + result.slice(1)}\n` +
                `**Closed by:** ${interaction.user.displayName}\n` +
                `${notes ? `**Notes:** ${notes}` : ''}\n\n` +
                `The case channel will be moved to the archive category.`);
            await interaction.reply({ embeds: [embed] });
            // Update the original message containing the case overview to remove the close button
            await this.updateCaseOverviewMessage(closedCase, interaction.guildId, interaction);
            this.logCommandExecution(interaction, 'case_closed', {
                caseNumber: closedCase.caseNumber,
                result,
                closedBy: interaction.user.id
            });
        }
        catch (error) {
            this.logCommandError(interaction, 'close_case_failed', error);
            // Handle Zod validation errors with user-friendly messages
            if (error instanceof Error && error.message.includes('Validation failed')) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Validation Error', `${error.message}\n\nPlease contact the bot developer if this issue persists.`)],
                    ephemeral: true,
                });
            }
            else {
                const embed = this.createErrorEmbed('Case Closure Failed', error instanceof Error ? error.message : 'Failed to close case.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
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
            const context = await this.getPermissionContext(interaction);
            const cases = await this.caseService.searchCases(context, filters, { field: 'createdAt', direction: 'desc' }, { limit: pageSize, skip });
            // Get total count for pagination info
            const allCases = await this.caseService.searchCases(context, filters);
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
            this.logCommandError(interaction, 'list_cases_failed', error);
            const embed = this.createErrorEmbed('List Failed', 'An error occurred while retrieving the case list.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async reassignStaff(staff, newCaseChannel, interaction) {
        try {
            // Validate the new case channel
            if (newCaseChannel.type !== discord_js_1.ChannelType.GuildText) {
                const embed = this.createErrorEmbed('Invalid Channel Type', 'The new case channel must be a text channel.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Get the case from the new channel
            const newCase = await this.getCaseFromChannel(newCaseChannel.id);
            if (!newCase) {
                const embed = this.createErrorEmbed('Invalid Case Channel', 'The specified channel is not associated with a case.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Find the staff member's current case assignment using repository method
            const assignedCases = await this.caseRepository.findByLawyer(staff.id);
            const activeCases = assignedCases.filter(c => c.guildId === interaction.guildId &&
                c.status === case_1.CaseStatus.IN_PROGRESS);
            if (activeCases.length === 0) {
                const embed = this.createErrorEmbed('No Current Assignment', `${staff.displayName} is not currently assigned to any active cases.`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // If staff is assigned to multiple cases, we'll reassign from the first active one
            const currentCase = activeCases[0];
            if (!currentCase) {
                const embed = this.createErrorEmbed('No Current Assignment', `${staff.displayName} is not currently assigned to any active cases.`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check if they're already assigned to the target case
            if (newCase.assignedLawyerIds.includes(staff.id)) {
                const embed = this.createErrorEmbed('Already Assigned', `${staff.displayName} is already assigned to case ${newCase.caseNumber}.`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Get context first
            const context = await this.getPermissionContext(interaction);
            // Use the existing reassignLawyer method from the service
            await this.caseService.reassignLawyer(context, currentCase._id.toString(), newCase._id.toString(), staff.id);
            const updatedNewCase = await this.caseService.getCaseById(context, newCase._id.toString());
            const embed = this.createSuccessEmbed('Staff Reassigned', `${staff.displayName} has been reassigned from case **${currentCase.caseNumber}** to case **${newCase.caseNumber}**.\n\n` +
                `**New Case:** ${newCase.title}\n` +
                `**New Case Channel:** <#${newCaseChannel.id}>\n` +
                `${updatedNewCase?.leadAttorneyId === staff.id ? '**Lead Attorney:** Yes' : '**Lead Attorney:** No'}\n` +
                `**Total Assigned Lawyers:** ${updatedNewCase?.assignedLawyerIds.length || 0}`);
            await interaction.reply({ embeds: [embed] });
            this.logCommandExecution(interaction, 'staff_reassigned', {
                staffId: staff.id,
                fromCase: currentCase.caseNumber,
                toCase: newCase.caseNumber
            });
        }
        catch (error) {
            this.logCommandError(interaction, 'reassign_staff_failed', error);
            const embed = this.createErrorEmbed('Reassignment Failed', error instanceof Error ? error.message : 'Failed to reassign staff member.');
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
                const embed = this.createErrorEmbed('No Current Assignment', `${staff.displayName} is not currently assigned to any active cases.`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Unassign from all active cases
            const context = await this.getPermissionContext(interaction);
            const unassignedCases = [];
            for (const caseData of assignedCases) {
                try {
                    await this.caseService.unassignLawyer(context, caseData._id.toString(), staff.id);
                    unassignedCases.push(caseData.caseNumber);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to unassign from case ${caseData.caseNumber}:`, error);
                }
            }
            if (unassignedCases.length === 0) {
                const embed = this.createErrorEmbed('Unassignment Failed', 'Failed to unassign staff member from any cases.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const embed = this.createSuccessEmbed('Staff Unassigned', `${staff.displayName} has been unassigned from the following case${unassignedCases.length > 1 ? 's' : ''}:\n\n` +
                `**Cases:** ${unassignedCases.map(cn => `\`${cn}\``).join(', ')}\n\n` +
                `${unassignedCases.length > 1 ? 'These cases' : 'This case'} ${unassignedCases.length > 1 ? 'are' : 'is'} now available for reassignment.`);
            await interaction.reply({ embeds: [embed] });
            this.logCommandExecution(interaction, 'staff_unassigned', {
                staffId: staff.id,
                casesCount: unassignedCases.length,
                cases: unassignedCases
            });
        }
        catch (error) {
            this.logCommandError(interaction, 'unassign_staff_failed', error);
            const embed = this.createErrorEmbed('Unassignment Failed', error instanceof Error ? error.message : 'Failed to unassign staff member.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async caseInfo(caseNumber, interaction) {
        try {
            let caseData = null;
            const context = await this.getPermissionContext(interaction);
            if (caseNumber) {
                // Find case by case number
                caseData = await this.caseService.getCaseByCaseNumber(context, caseNumber);
            }
            else {
                // Try to get case from current channel
                caseData = await this.getCaseFromChannel(interaction.channelId);
            }
            if (!caseData) {
                const embed = this.createErrorEmbed('Case Not Found', caseNumber
                    ? `Case **${caseNumber}** not found.`
                    : 'No case found. Please specify a case number or use this command in a case channel.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Show overview tab by default
            await this.showCaseInfoTab(interaction, caseData, 'overview');
        }
        catch (error) {
            this.logCommandError(interaction, 'case_info_failed', error);
            const embed = this.createErrorEmbed('Info Failed', 'An error occurred while retrieving case information.');
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
                const embed = this.createErrorEmbed('Invalid Request', 'Unable to parse case information from button interaction.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const caseData = await this.caseService.getCaseById(context, caseId);
            if (!caseData) {
                const embed = this.createErrorEmbed('Case Not Found', 'The case information could not be retrieved.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            await this.showCaseInfoTab(interaction, caseData, tab);
        }
        catch (error) {
            logger_1.logger.error('Error handling tab navigation:', error);
            const embed = this.createErrorEmbed('Navigation Failed', 'An error occurred while switching tabs.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async setLeadAttorney(attorney, interaction) {
        try {
            // This command works within case channels or requires case permission
            const caseData = await this.getCaseFromChannel(interaction.channelId);
            if (!caseData) {
                const embed = this.createErrorEmbed('Invalid Channel', 'This command can only be used within case channels.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check permissions: only current lead attorney or users with case permissions
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
            const isCurrentLeadAttorney = caseData.leadAttorneyId === interaction.user.id;
            if (!hasPermission && !isCurrentLeadAttorney) {
                const embed = this.createErrorEmbed('Permission Denied', 'You must have case management permissions or be the current lead attorney to change the lead attorney.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            await this.deferReply(interaction);
            const caseServiceWithClient = this.getCaseServiceWithClient(interaction.client);
            const updatedCase = await caseServiceWithClient.setLeadAttorney(context, caseData._id.toString(), attorney.id);
            const embed = this.createSuccessEmbed('Lead Attorney Updated', `**Case:** ${updatedCase.caseNumber}\n` +
                `**New Lead Attorney:** <@${attorney.id}>\n` +
                `**Previous Lead Attorney:** ${caseData.leadAttorneyId ? `<@${caseData.leadAttorneyId}>` : 'None'}\n\n` +
                `The lead attorney has been successfully updated. Channel permissions have been updated accordingly.`);
            await this.safeReply(interaction, { embeds: [embed] });
            // Log the action
            this.logCommandExecution(interaction, 'lead_attorney_updated', {
                caseId: updatedCase._id,
                caseNumber: updatedCase.caseNumber,
                newLeadAttorney: attorney.id,
                previousLeadAttorney: caseData.leadAttorneyId,
                changedBy: interaction.user.id
            });
        }
        catch (error) {
            this.logCommandError(interaction, 'set_lead_attorney_failed', error);
            const embed = this.createErrorEmbed('Error', error instanceof Error ? error.message : 'Failed to set lead attorney');
            await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
    }
    async createCaseChannel(caseData, interaction) {
        const context = await this.getPermissionContext(interaction);
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
            await this.caseService.updateCase(context, caseData._id.toString(), {
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
            const context = await this.getPermissionContext(interaction);
            const acceptedCase = await caseServiceWithClient.acceptCase(context, caseId);
            // Update the original message
            const embed = this.createSuccessEmbed('✅ Case Accepted', `This case has been accepted by ${interaction.user.displayName}.\n\n` +
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
            const embed = this.createErrorEmbed('Accept Failed', error instanceof Error ? error.message : 'Failed to accept case.');
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
            const embed = this.createErrorEmbed('Close Failed', 'An error occurred while preparing the case closure form.');
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
            const embed = this.createErrorEmbed('Decline Failed', 'An error occurred while declining the case.');
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
                const embed = this.createErrorEmbed('Invalid Result', `Please enter one of: ${validResults.join(', ')}`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check permissions - only client and lead counsel
            const context = await this.getPermissionContext(interaction);
            const caseData = await this.caseService.getCaseById(context, caseId);
            if (!caseData) {
                const embed = this.createErrorEmbed('Case Not Found', 'The case could not be found.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const isClient = interaction.user.id === caseData.clientId;
            const isLeadCounsel = interaction.user.id === caseData.leadAttorneyId;
            if (!isClient && !isLeadCounsel) {
                const embed = this.createErrorEmbed('Permission Denied', 'Only the client or lead counsel can close this case.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const closureRequest = {
                caseId: caseId,
                result: result,
                resultNotes: notes,
                closedBy: interaction.user.id
            };
            const closedCase = await this.caseService.closeCase(context, closureRequest);
            // Archive the channel
            await this.archiveCaseChannel(closedCase, interaction);
            const embed = this.createSuccessEmbed('Case Closed', `Case **${closedCase.caseNumber}** has been closed successfully.\n\n` +
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
            const embed = this.createErrorEmbed('Close Failed', error instanceof Error ? error.message : 'Failed to close case.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async handleDeclineReason(interaction) {
        try {
            const caseId = interaction.customId.replace('case_decline_reason_', '');
            const reason = interaction.fields.getTextInputValue('decline_reason') || 'No reason provided';
            // Decline the case
            const context = await this.getPermissionContext(interaction);
            const declinedCase = await this.caseService.declineCase(context, caseId, reason);
            const embed = this.createErrorEmbed('❌ Case Declined', `This case has been declined by ${interaction.user.displayName}.\n\n` +
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
            const embed = this.createErrorEmbed('Decline Failed', error instanceof Error ? error.message : 'Failed to decline case.');
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
    async searchCases(searchQuery, status, priority, lawyer, client, daysAgo, interaction) {
        try {
            await this.deferReply(interaction);
            // Get all cases
            let cases = await this.caseRepository.findByFilters({ guildId: interaction.guildId });
            // Apply search query
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                cases = cases.filter((c) => c.caseNumber.toLowerCase().includes(query) ||
                    c.title.toLowerCase().includes(query) ||
                    c.description.toLowerCase().includes(query) ||
                    c.clientUsername.toLowerCase().includes(query));
            }
            // Apply status filter
            if (status && status !== 'all') {
                cases = cases.filter((c) => c.status === status);
            }
            // Apply priority filter
            if (priority && priority !== 'all') {
                cases = cases.filter((c) => c.priority === priority);
            }
            // Apply lawyer filter
            if (lawyer) {
                cases = cases.filter((c) => c.assignedLawyerIds.includes(lawyer.id));
            }
            // Apply client filter
            if (client) {
                cases = cases.filter((c) => c.clientId === client.id);
            }
            // Apply date filter
            if (daysAgo) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
                cases = cases.filter((c) => new Date(c.createdAt) >= cutoffDate);
            }
            // Sort by creation date (newest first)
            cases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            if (cases.length === 0) {
                const embed = this.createInfoEmbed('🔍 Search Results', 'No cases found matching your search criteria.');
                await this.safeReply(interaction, { embeds: [embed] });
                return;
            }
            // Create search results embed
            const embed = this.createInfoEmbed(`🔍 Search Results (${cases.length} case${cases.length === 1 ? '' : 's'})`, cases.length > 10
                ? `Showing first 10 of ${cases.length} results. Refine your search for more specific results.`
                : `Found ${cases.length} case${cases.length === 1 ? '' : 's'} matching your criteria.`);
            // Add case results (limit to 10)
            const displayCases = cases.slice(0, 10);
            for (const caseItem of displayCases) {
                const statusEmoji = this.getCaseStatusEmoji(caseItem.status);
                const priorityEmoji = this.getCasePriorityEmoji(caseItem.priority);
                embed.addFields({
                    name: `${statusEmoji} ${caseItem.caseNumber} - ${caseItem.title}`,
                    value: [
                        `**Client:** <@${caseItem.clientId}> (${caseItem.clientUsername})`,
                        `**Status:** ${caseItem.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`,
                        `**Priority:** ${priorityEmoji} ${caseItem.priority.toUpperCase()}`,
                        `**Lawyers:** ${caseItem.assignedLawyerIds.length > 0 ? caseItem.assignedLawyerIds.map((id) => `<@${id}>`).join(', ') : 'None assigned'}`,
                        `**Created:** <t:${Math.floor(new Date(caseItem.createdAt).getTime() / 1000)}:R>`
                    ].join('\n'),
                    inline: false
                });
            }
            // Add search criteria summary
            const criteria = [];
            if (searchQuery)
                criteria.push(`Query: "${searchQuery}"`);
            if (status && status !== 'all')
                criteria.push(`Status: ${status}`);
            if (priority && priority !== 'all')
                criteria.push(`Priority: ${priority}`);
            if (lawyer)
                criteria.push(`Lawyer: ${lawyer.displayName}`);
            if (client)
                criteria.push(`Client: ${client.displayName}`);
            if (daysAgo)
                criteria.push(`Last ${daysAgo} days`);
            if (criteria.length > 0) {
                embed.addFields({
                    name: '🔎 Search Criteria',
                    value: criteria.join(' | '),
                    inline: false
                });
            }
            await this.safeReply(interaction, { embeds: [embed] });
            // Log search operation
            this.logCommandExecution(interaction, 'case_search', {
                resultsCount: cases.length,
                searchCriteria: {
                    query: searchQuery,
                    status,
                    priority,
                    lawyerId: lawyer?.id,
                    clientId: client?.id,
                    daysAgo
                }
            });
        }
        catch (error) {
            this.logCommandError(interaction, 'case_search_failed', error);
            const embed = this.createErrorEmbed('Search Failed', 'An error occurred while searching cases.');
            await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
    }
    async exportCases(format = 'csv', interaction) {
        try {
            await this.deferReply(interaction, true);
            const cases = await this.caseRepository.findByFilters({ guildId: interaction.guildId });
            if (cases.length === 0) {
                const embed = this.createErrorEmbed('No Data', 'There are no cases to export.');
                await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
                return;
            }
            if (format === 'csv') {
                // Generate CSV
                const csv = this.generateCaseCSV(cases);
                const buffer = Buffer.from(csv, 'utf-8');
                const attachment = new discord_js_1.AttachmentBuilder(buffer, {
                    name: `cases_export_${new Date().toISOString().split('T')[0]}.csv`
                });
                const embed = this.createSuccessEmbed('Export Complete', `Successfully exported ${cases.length} cases to CSV format.`);
                await interaction.reply({
                    embeds: [embed],
                    files: [attachment],
                    ephemeral: true
                });
            }
            else {
                // Generate summary report
                const report = this.generateCaseSummaryReport(cases);
                const buffer = Buffer.from(report, 'utf-8');
                const attachment = new discord_js_1.AttachmentBuilder(buffer, {
                    name: `case_summary_${new Date().toISOString().split('T')[0]}.txt`
                });
                const embed = this.createSuccessEmbed('Report Generated', `Successfully generated summary report for ${cases.length} cases.`);
                await interaction.reply({
                    embeds: [embed],
                    files: [attachment],
                    ephemeral: true
                });
            }
            // Log export operation
            this.logCommandExecution(interaction, 'case_export', {
                format,
                caseCount: cases.length
            });
        }
        catch (error) {
            this.logCommandError(interaction, 'case_export_failed', error);
            const embed = this.createErrorEmbed('Export Failed', 'An error occurred while exporting case data.');
            await this.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
    }
    async addCaseNote(content, clientVisible = false, interaction) {
        try {
            // This command only works within case channels
            const caseData = await this.getCaseFromChannel(interaction.channelId);
            if (!caseData) {
                const embed = this.createErrorEmbed('Invalid Channel', 'This command can only be used within case channels.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Add note to case
            const note = {
                id: new Date().getTime().toString(),
                content,
                createdBy: interaction.user.id,
                createdAt: new Date(),
                isInternal: !clientVisible
            };
            // Update case with new note
            caseData.notes.push(note);
            await this.caseRepository.update(caseData._id.toString(), {
                notes: caseData.notes
            });
            const embed = this.createSuccessEmbed('Note Added', `Successfully added ${clientVisible ? 'client-visible' : 'internal'} note to case **${caseData.caseNumber}**.`);
            await interaction.reply({ embeds: [embed] });
            // If client-visible, notify client
            if (clientVisible && caseData.clientId !== interaction.user.id) {
                try {
                    const guild = interaction.guild;
                    const client = await guild.members.fetch(caseData.clientId);
                    const clientEmbed = this.createInfoEmbed('New Case Note', `A new note has been added to your case **${caseData.caseNumber}**:\n\n${content}\n\n*- ${interaction.user.displayName}*`);
                    await client.send({ embeds: [clientEmbed] });
                }
                catch (error) {
                    logger_1.logger.warn('Failed to notify client of new note', {
                        caseId: caseData._id,
                        clientId: caseData.clientId,
                        error
                    });
                }
            }
            // Log note addition
            this.logCommandExecution(interaction, 'case_note_added', {
                caseNumber: caseData.caseNumber,
                clientVisible,
                noteLength: content.length
            });
        }
        catch (error) {
            this.logCommandError(interaction, 'add_case_note_failed', error);
            const embed = this.createErrorEmbed('Note Addition Failed', 'An error occurred while adding the note to the case.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    /**
     * Generate CSV from cases
     */
    generateCaseCSV(cases) {
        const headers = [
            'Case Number',
            'Title',
            'Client ID',
            'Client Username',
            'Status',
            'Priority',
            'Lead Attorney ID',
            'Assigned Lawyers',
            'Created At',
            'Closed At',
            'Result',
            'Channel ID'
        ];
        const rows = cases.map(c => [
            c.caseNumber,
            `"${c.title.replace(/"/g, '""')}"`,
            c.clientId,
            c.clientUsername,
            c.status,
            c.priority,
            c.leadAttorneyId || '',
            c.assignedLawyerIds.join(';'),
            new Date(c.createdAt).toISOString(),
            c.closedAt ? new Date(c.closedAt).toISOString() : '',
            c.result || '',
            c.channelId || ''
        ]);
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
    /**
     * Generate summary report from cases
     */
    generateCaseSummaryReport(cases) {
        const totalCases = cases.length;
        const statusCounts = cases.reduce((acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
        }, {});
        const priorityCounts = cases.reduce((acc, c) => {
            acc[c.priority] = (acc[c.priority] || 0) + 1;
            return acc;
        }, {});
        const resultCounts = cases
            .filter(c => c.result)
            .reduce((acc, c) => {
            acc[c.result] = (acc[c.result] || 0) + 1;
            return acc;
        }, {});
        const avgCaseDuration = cases
            .filter(c => c.closedAt)
            .reduce((sum, c) => {
            const duration = new Date(c.closedAt).getTime() - new Date(c.createdAt).getTime();
            return sum + duration;
        }, 0) / cases.filter(c => c.closedAt).length || 0;
        const report = [
            'ANARCHY & ASSOCIATES - CASE SUMMARY REPORT',
            '='.repeat(50),
            `Generated: ${new Date().toISOString()}`,
            '',
            'OVERVIEW',
            '-'.repeat(20),
            `Total Cases: ${totalCases}`,
            '',
            'STATUS BREAKDOWN',
            '-'.repeat(20),
            ...Object.entries(statusCounts).map(([status, count]) => `${status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}: ${count} (${((count / totalCases) * 100).toFixed(1)}%)`),
            '',
            'PRIORITY BREAKDOWN',
            '-'.repeat(20),
            ...Object.entries(priorityCounts).map(([priority, count]) => `${priority.toUpperCase()}: ${count} (${((count / totalCases) * 100).toFixed(1)}%)`),
            '',
            'CASE RESULTS (Closed Cases)',
            '-'.repeat(20),
            ...Object.entries(resultCounts).map(([result, count]) => `${result.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}: ${count}`),
            '',
            'PERFORMANCE METRICS',
            '-'.repeat(20),
            `Average Case Duration: ${Math.floor(avgCaseDuration / (1000 * 60 * 60 * 24))} days`,
            `Active Cases: ${statusCounts['in_progress'] || 0}`,
            `Pending Cases: ${statusCounts['pending'] || 0}`,
            `Completion Rate: ${((statusCounts['closed'] || 0) / totalCases * 100).toFixed(1)}%`,
            '',
            '='.repeat(50),
            'END OF REPORT'
        ];
        return report.join('\n');
    }
    /**
     * Get case status emoji
     */
    getCaseStatusEmoji(status) {
        switch (status) {
            case case_1.CaseStatus.PENDING: return '🟡';
            case case_1.CaseStatus.IN_PROGRESS: return '🟢';
            case case_1.CaseStatus.CLOSED: return '🔴';
            default: return '⚪';
        }
    }
    /**
     * Get case priority emoji
     */
    getCasePriorityEmoji(priority) {
        switch (priority) {
            case case_1.CasePriority.LOW: return '🟢';
            case case_1.CasePriority.MEDIUM: return '🟡';
            case case_1.CasePriority.HIGH: return '🟠';
            case case_1.CasePriority.URGENT: return '🔴';
            default: return '⚪';
        }
    }
    analyzeTrends(cases, periodDays) {
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);
        const recentCases = cases.filter(c => c.createdAt && c.createdAt >= periodStart);
        const previousPeriodStart = new Date();
        previousPeriodStart.setDate(previousPeriodStart.getDate() - (periodDays * 2));
        const previousCases = cases.filter(c => c.createdAt &&
            c.createdAt >= previousPeriodStart &&
            c.createdAt < periodStart);
        if (previousCases.length === 0) {
            return null;
        }
        const growth = ((recentCases.length - previousCases.length) / previousCases.length) * 100;
        const trend = growth > 0 ? '📈 Increasing' : growth < 0 ? '📉 Decreasing' : '➡️ Stable';
        return `${trend} (${growth > 0 ? '+' : ''}${growth.toFixed(1)}% compared to previous period)`;
    }
};
exports.CaseCommands = CaseCommands;
// Store case templates in memory (in production, this should be in a database)
CaseCommands.caseTemplates = new Map();
__decorate([
    (0, discordx_1.Slash)({
        description: 'Request a case review (client-facing)',
        name: 'review'
    }),
    (0, validation_decorators_1.ValidateBusinessRules)('client_case_limit'),
    (0, validation_decorators_1.ValidateEntity)('case', 'create'),
    audit_decorators_1.AuditDecorators.CaseCreated(),
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
    (0, validation_decorators_1.ValidatePermissions)('case'),
    (0, validation_decorators_1.ValidateBusinessRules)('staff_member'),
    (0, validation_decorators_1.ValidateEntity)('case', 'update'),
    audit_decorators_1.AuditDecorators.CaseAssigned(),
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
        description: 'Transfer a case between lawyers',
        name: 'transfer'
    }),
    (0, validation_decorators_1.ValidatePermissions)('case'),
    (0, validation_decorators_1.ValidateBusinessRules)('staff_member'),
    (0, validation_decorators_1.ValidateEntity)('case', 'update'),
    audit_decorators_1.AuditDecorators.CaseAssigned(),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Case number to transfer',
        name: 'casenumber',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'Current lawyer assigned to the case',
        name: 'from',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true
    })),
    __param(2, (0, discordx_1.SlashOption)({
        description: 'New lawyer to assign the case to',
        name: 'to',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true
    })),
    __param(3, (0, discordx_1.SlashOption)({
        description: 'Reason for transfer',
        name: 'reason',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.User,
        discord_js_1.User, Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "transferCase", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Close multiple cases at once',
        name: 'bulk-close'
    }),
    (0, validation_decorators_1.ValidatePermissions)('case'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.CASE_CLOSED, 'medium'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Result for all cases being closed',
        name: 'result',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "bulkCloseCases", null);
__decorate([
    (0, discordx_1.SelectMenuComponent)({ id: 'bulk_close_select' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.StringSelectMenuInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "handleBulkCloseSelection", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'View comprehensive case analytics',
        name: 'analytics'
    }),
    (0, validation_decorators_1.ValidatePermissions)('case'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.STAFF_LIST_VIEWED, 'low'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Time period for analytics (days)',
        name: 'period',
        type: discord_js_1.ApplicationCommandOptionType.Integer,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "caseAnalytics", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Create a case template',
        name: 'template-create'
    }),
    (0, validation_decorators_1.ValidatePermissions)('admin'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.CASE_ASSIGNED, 'medium'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Template name',
        name: 'name',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'Template description',
        name: 'description',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __param(2, (0, discordx_1.SlashOption)({
        description: 'Default priority for cases',
        name: 'priority',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __param(3, (0, discordx_1.SlashOption)({
        description: 'Default title for cases (optional)',
        name: 'title',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "createTemplate", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Create a case from a template',
        name: 'template-use'
    }),
    (0, validation_decorators_1.ValidateBusinessRules)('client_case_limit'),
    (0, validation_decorators_1.ValidateEntity)('case', 'create'),
    audit_decorators_1.AuditDecorators.CaseCreated(),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Additional details for the case',
        name: 'details',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "useTemplate", null);
__decorate([
    (0, discordx_1.SelectMenuComponent)({ id: 'template_select' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.StringSelectMenuInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "handleTemplateSelection", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Debug permission issues for a case',
        name: 'debug-permissions'
    }),
    (0, validation_decorators_1.ValidatePermissions)('admin'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.STAFF_LIST_VIEWED, 'low'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Case number to debug',
        name: 'casenumber',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'User to check permissions for',
        name: 'user',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.User,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "debugPermissions", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Close a case with outcome',
        name: 'close'
    }),
    (0, validation_decorators_1.ValidatePermissions)('case'),
    (0, validation_decorators_1.ValidateEntity)('case', 'update'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.CASE_CLOSED, 'medium'),
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
    (0, validation_decorators_1.ValidatePermissions)('case', false),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.STAFF_LIST_VIEWED, 'low'),
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
    (0, validation_decorators_1.ValidatePermissions)('case'),
    (0, validation_decorators_1.ValidateBusinessRules)('staff_member'),
    (0, validation_decorators_1.ValidateEntity)('case', 'update'),
    audit_decorators_1.AuditDecorators.CaseAssigned(),
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
    (0, validation_decorators_1.ValidatePermissions)('case'),
    (0, validation_decorators_1.ValidateBusinessRules)('staff_member'),
    (0, validation_decorators_1.ValidateEntity)('case', 'update'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.CASE_ASSIGNED, 'medium'),
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
    (0, validation_decorators_1.ValidatePermissions)('case', false),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.STAFF_LIST_VIEWED, 'low'),
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
    (0, discordx_1.Slash)({
        description: 'Set the lead attorney for a case',
        name: 'set-lead-attorney'
    }),
    (0, validation_decorators_1.ValidatePermissions)('case'),
    (0, validation_decorators_1.ValidateBusinessRules)('staff_member'),
    (0, validation_decorators_1.ValidateEntity)('case', 'update'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.LEAD_ATTORNEY_CHANGED, 'medium'),
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
        description: 'Search cases with advanced filtering options',
        name: 'search'
    }),
    (0, validation_decorators_1.ValidatePermissions)('case'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.STAFF_LIST_VIEWED, 'low'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Search term (title, description, client name, or case number)',
        name: 'query',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'Filter by case status',
        name: 'status',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __param(2, (0, discordx_1.SlashOption)({
        description: 'Filter by priority level',
        name: 'priority',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __param(3, (0, discordx_1.SlashOption)({
        description: 'Filter by assigned lawyer',
        name: 'lawyer',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: false
    })),
    __param(4, (0, discordx_1.SlashOption)({
        description: 'Filter by client',
        name: 'client',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: false
    })),
    __param(5, (0, discordx_1.SlashOption)({
        description: 'Show cases created in the last N days',
        name: 'days',
        type: discord_js_1.ApplicationCommandOptionType.Integer,
        required: false,
        minValue: 1,
        maxValue: 365
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "searchCases", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Export case data to CSV format',
        name: 'export'
    }),
    (0, validation_decorators_1.ValidatePermissions)('admin'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.STAFF_LIST_VIEWED, 'low'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Export format',
        name: 'format',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "exportCases", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Add a note to a case',
        name: 'add-note'
    }),
    (0, validation_decorators_1.ValidatePermissions)('case'),
    (0, validation_decorators_1.ValidateEntity)('case', 'update'),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.CASE_ASSIGNED, 'medium'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Note content',
        name: 'content',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'Make note visible to client',
        name: 'client-visible',
        type: discord_js_1.ApplicationCommandOptionType.Boolean,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], CaseCommands.prototype, "addCaseNote", null);
exports.CaseCommands = CaseCommands = CaseCommands_1 = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ description: 'Case management commands', name: 'case' }),
    (0, discordx_1.SlashGroup)('case'),
    __metadata("design:paramtypes", [])
], CaseCommands);
//# sourceMappingURL=case-commands.js.map