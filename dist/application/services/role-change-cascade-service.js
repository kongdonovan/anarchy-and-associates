"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleChangeCascadeService = void 0;
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const case_service_1 = require("./case-service");
const channel_permission_manager_1 = require("./channel-permission-manager");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
const logger_1 = require("../../infrastructure/logger");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const permission_service_1 = require("./permission-service");
const business_rule_validation_service_1 = require("./business-rule-validation-service");
class RoleChangeCascadeService {
    constructor() {
        // Define which roles have lawyer permissions (can be assigned to cases)
        this.LAWYER_ROLES = [
            staff_role_1.StaffRole.MANAGING_PARTNER,
            staff_role_1.StaffRole.SENIOR_PARTNER,
            staff_role_1.StaffRole.JUNIOR_PARTNER,
            staff_role_1.StaffRole.SENIOR_ASSOCIATE,
            staff_role_1.StaffRole.JUNIOR_ASSOCIATE
        ];
        // Define which roles have lead attorney permissions
        this.LEAD_ATTORNEY_ROLES = [
            staff_role_1.StaffRole.MANAGING_PARTNER,
            staff_role_1.StaffRole.SENIOR_PARTNER,
            staff_role_1.StaffRole.JUNIOR_PARTNER,
            staff_role_1.StaffRole.SENIOR_ASSOCIATE
        ];
        this.caseRepository = new case_repository_1.CaseRepository();
        this.auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        this.staffRepository = new staff_repository_1.StaffRepository();
        // Initialize dependencies for services
        const caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        const businessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(guildConfigRepository, this.staffRepository, this.caseRepository, permissionService);
        this.channelPermissionManager = new channel_permission_manager_1.ChannelPermissionManager(this.caseRepository, this.staffRepository, this.auditLogRepository, businessRuleValidationService);
        this.caseService = new case_service_1.CaseService(this.caseRepository, caseCounterRepository, guildConfigRepository, permissionService, businessRuleValidationService);
    }
    /**
     * Initialize the cascade service with Discord client
     */
    initialize(_client) {
        logger_1.logger.info('Role change cascade service initialized');
    }
    /**
     * Handle cascading effects of role changes
     */
    async handleRoleChange(event) {
        const { member, oldRole, newRole, changeType } = event;
        try {
            logger_1.logger.info(`Handling cascading effects for ${changeType} of ${member.displayName}`, {
                userId: member.user.id,
                guildId: member.guild.id,
                oldRole,
                newRole,
                changeType
            });
            // Determine if permissions were lost
            const hadLawyerPermissions = oldRole ? this.hasLawyerPermissions(oldRole) : false;
            const hasLawyerPermissions = newRole ? this.hasLawyerPermissions(newRole) : false;
            const hadLeadAttorneyPermissions = oldRole ? this.hasLeadAttorneyPermissions(oldRole) : false;
            const hasLeadAttorneyPermissions = newRole ? this.hasLeadAttorneyPermissions(newRole) : false;
            // Handle loss of lawyer permissions (fired or demoted below Junior Associate)
            if (hadLawyerPermissions && !hasLawyerPermissions) {
                await this.handleLossOfLawyerPermissions(member, oldRole, newRole);
            }
            // Handle loss of lead attorney permissions (demoted below Senior Associate)
            else if (hadLeadAttorneyPermissions && !hasLeadAttorneyPermissions && hasLawyerPermissions) {
                await this.handleLossOfLeadAttorneyPermissions(member, oldRole, newRole);
            }
            // Update channel permissions through existing channel permission manager
            if (oldRole || newRole) {
                await this.channelPermissionManager.handleRoleChange(member.guild, member, oldRole, newRole, changeType);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error handling cascading effects for ${changeType}:`, error);
        }
    }
    /**
     * Handle when a staff member loses all lawyer permissions
     */
    async handleLossOfLawyerPermissions(member, oldRole, newRole) {
        const userId = member.user.id;
        const guildId = member.guild.id;
        const changeType = newRole ? 'demotion' : 'termination';
        logger_1.logger.info(`Staff member ${member.displayName} lost lawyer permissions`, {
            userId,
            guildId,
            oldRole,
            newRole,
            changeType
        });
        // Find all cases where this user is assigned
        const assignedCases = await this.caseRepository.findByLawyer(userId);
        const leadCases = assignedCases.filter(c => c.leadAttorneyId === userId);
        const regularCases = assignedCases.filter(c => c.leadAttorneyId !== userId);
        if (assignedCases.length === 0) {
            logger_1.logger.info(`No cases to unassign for ${member.displayName}`);
            return;
        }
        logger_1.logger.info(`Unassigning ${member.displayName} from ${assignedCases.length} cases`, {
            leadCases: leadCases.length,
            regularCases: regularCases.length
        });
        // Notify the user about case removal
        await this.notifyUserOfCaseRemoval(member, assignedCases, changeType);
        // Process each case
        for (const caseData of assignedCases) {
            try {
                await this.processCase(caseData, member, changeType);
            }
            catch (error) {
                logger_1.logger.error(`Error processing case ${caseData.caseNumber}:`, error);
            }
        }
        // Log audit event
        await this.logCascadeAuditEvent(member, oldRole, newRole, assignedCases.length, changeType);
    }
    /**
     * Handle when a staff member loses lead attorney permissions but retains lawyer permissions
     */
    async handleLossOfLeadAttorneyPermissions(member, oldRole, newRole) {
        const userId = member.user.id;
        const guildId = member.guild.id;
        logger_1.logger.info(`Staff member ${member.displayName} lost lead attorney permissions`, {
            userId,
            guildId,
            oldRole,
            newRole
        });
        // Find cases where this user is lead attorney
        const leadCases = await this.caseRepository.findByLeadAttorney(userId);
        if (leadCases.length === 0) {
            logger_1.logger.info(`No lead attorney cases to update for ${member.displayName}`);
            return;
        }
        logger_1.logger.info(`Removing lead attorney status from ${leadCases.length} cases for ${member.displayName}`);
        // Notify user about lead attorney removal
        await this.notifyUserOfLeadAttorneyRemoval(member, leadCases);
        // Remove lead attorney status from each case
        for (const caseData of leadCases) {
            try {
                await this.removeLeadAttorneyStatus(caseData, member);
            }
            catch (error) {
                logger_1.logger.error(`Error removing lead attorney status from case ${caseData.caseNumber}:`, error);
            }
        }
        // Log audit event
        await this.logLeadAttorneyRemovalAuditEvent(member, oldRole, newRole, leadCases.length);
    }
    /**
     * Process a single case for unassignment
     */
    async processCase(caseData, member, changeType) {
        const systemContext = {
            guildId: member.guild.id,
            userId: 'system',
            userRoles: [],
            isGuildOwner: false
        };
        // Unassign the lawyer from the case
        await this.caseService.unassignLawyer(systemContext, caseData._id.toString(), member.user.id);
        // Update case channel to notify about the change
        await this.notifyCaseChannel(caseData, member, changeType);
        // Check if case has no lawyers left
        const updatedCase = await this.caseRepository.findById(caseData._id.toString());
        if (updatedCase && updatedCase.assignedLawyerIds.length === 0) {
            await this.handleCaseWithNoLawyers(updatedCase, member.guild);
        }
    }
    /**
     * Remove lead attorney status from a case
     */
    async removeLeadAttorneyStatus(caseData, member) {
        // Update the case to remove lead attorney
        await this.caseRepository.update(caseData._id.toString(), {
            leadAttorneyId: undefined
        });
        // Notify case channel about lead attorney removal
        await this.notifyCaseChannelLeadAttorneyRemoval(caseData, member);
    }
    /**
     * Handle cases that have no lawyers assigned
     */
    async handleCaseWithNoLawyers(caseData, guild) {
        logger_1.logger.warn(`Case ${caseData.caseNumber} has no lawyers assigned!`, {
            caseId: caseData._id,
            guildId: guild.id
        });
        // Find senior staff to notify
        const managingPartners = await this.staffRepository.findByFilters({
            guildId: guild.id,
            role: staff_role_1.StaffRole.MANAGING_PARTNER,
            status: 'active'
        });
        const seniorPartners = await this.staffRepository.findByFilters({
            guildId: guild.id,
            role: staff_role_1.StaffRole.SENIOR_PARTNER,
            status: 'active'
        });
        const seniorStaff = [...managingPartners, ...seniorPartners];
        // Create urgent notification embed
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: '⚠️ Urgent: Case Requires Lawyer Assignment',
            description: `Case **${caseData.caseNumber}** currently has no lawyers assigned and requires immediate attention.`,
            color: 'error'
        })
            .addFields({ name: 'Case Title', value: caseData.title, inline: false }, { name: 'Client', value: `<@${caseData.clientId}>`, inline: true }, { name: 'Status', value: caseData.status, inline: true }, { name: 'Priority', value: caseData.priority, inline: true })
            .setFooter({ text: 'Please assign a lawyer to this case immediately' });
        // Notify in case channel with pings
        if (caseData.channelId) {
            try {
                const channel = await guild.channels.fetch(caseData.channelId);
                if (channel) {
                    const mentions = seniorStaff.map(staff => `<@${staff.userId}>`).join(' ');
                    await channel.send({
                        content: `${mentions} **URGENT: This case has no lawyers assigned!**`,
                        embeds: [embed]
                    });
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to notify case channel ${caseData.channelId}:`, error);
            }
        }
        // DM senior staff
        for (const staff of seniorStaff) {
            try {
                const member = await guild.members.fetch(staff.userId);
                await member.send({ embeds: [embed] });
            }
            catch (error) {
                logger_1.logger.error(`Failed to DM senior staff ${staff.userId}:`, error);
            }
        }
    }
    /**
     * Notify user via DM about case removal
     */
    async notifyUserOfCaseRemoval(member, cases, changeType) {
        const reason = changeType === 'termination'
            ? 'your termination from the firm'
            : 'your demotion to a non-lawyer position';
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: 'Case Assignment Update',
            description: `Due to ${reason}, you have been unassigned from the following cases:`,
            color: 'warning'
        });
        // Add case list
        const caseList = cases.map(c => `• **${c.caseNumber}** - ${c.title} ${c.leadAttorneyId === member.user.id ? '*(Lead Attorney)*' : ''}`).join('\n');
        embed.addFields({
            name: 'Affected Cases',
            value: caseList.substring(0, 1024) // Discord field limit
        });
        if (changeType === 'demotion') {
            embed.addFields({
                name: 'Next Steps',
                value: 'Please coordinate with your supervisor for case handover procedures.'
            });
        }
        embed.setFooter({ text: 'Anarchy & Associates Legal Firm' });
        try {
            await member.send({ embeds: [embed] });
            logger_1.logger.info(`Notified ${member.displayName} about case removal via DM`);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to DM ${member.displayName} about case removal:`, error);
        }
    }
    /**
     * Notify user via DM about lead attorney removal
     */
    async notifyUserOfLeadAttorneyRemoval(member, cases) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: 'Lead Attorney Status Update',
            description: 'Due to your role change, you have been removed as lead attorney from the following cases:',
            color: 'warning'
        });
        const caseList = cases.map(c => `• **${c.caseNumber}** - ${c.title}`).join('\n');
        embed.addFields({
            name: 'Affected Cases',
            value: caseList.substring(0, 1024)
        }, {
            name: 'Note',
            value: 'You remain assigned to these cases as a regular attorney.'
        });
        embed.setFooter({ text: 'Anarchy & Associates Legal Firm' });
        try {
            await member.send({ embeds: [embed] });
            logger_1.logger.info(`Notified ${member.displayName} about lead attorney removal via DM`);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to DM ${member.displayName} about lead attorney removal:`, error);
        }
    }
    /**
     * Notify case channel about staffing changes
     */
    async notifyCaseChannel(caseData, member, changeType) {
        if (!caseData.channelId)
            return;
        try {
            const channel = await member.guild.channels.fetch(caseData.channelId);
            if (!channel)
                return;
            const reason = changeType === 'termination' ? 'termination' : 'role change';
            const wasLead = caseData.leadAttorneyId === member.user.id;
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: 'Case Staffing Update',
                description: `${member.displayName} has been unassigned from this case due to ${reason}.`,
                color: 'warning'
            });
            if (wasLead) {
                embed.addFields({
                    name: 'Lead Attorney Status',
                    value: 'This case no longer has a lead attorney. Please assign a new lead attorney.'
                });
            }
            const remainingLawyers = caseData.assignedLawyerIds
                .filter(id => id !== member.user.id)
                .length;
            embed.addFields({
                name: 'Remaining Lawyers',
                value: remainingLawyers > 0
                    ? `${remainingLawyers} lawyer(s) remain assigned to this case.`
                    : '⚠️ **No lawyers are currently assigned to this case!**'
            });
            embed.setFooter({ text: `Case ${caseData.caseNumber}` });
            await channel.send({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error(`Failed to notify case channel ${caseData.channelId}:`, error);
        }
    }
    /**
     * Notify case channel about lead attorney removal
     */
    async notifyCaseChannelLeadAttorneyRemoval(caseData, member) {
        if (!caseData.channelId)
            return;
        try {
            const channel = await member.guild.channels.fetch(caseData.channelId);
            if (!channel)
                return;
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: 'Lead Attorney Update',
                description: `${member.displayName} is no longer the lead attorney for this case due to role change.`,
                color: 'warning'
            })
                .addFields({
                name: 'Status',
                value: `${member.displayName} remains assigned to this case as a regular attorney.`
            }, {
                name: 'Action Required',
                value: 'Please assign a new lead attorney to this case.'
            })
                .setFooter({ text: `Case ${caseData.caseNumber}` });
            await channel.send({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error(`Failed to notify case channel ${caseData.channelId} about lead attorney removal:`, error);
        }
    }
    /**
     * Check if a role has lawyer permissions
     */
    hasLawyerPermissions(role) {
        return this.LAWYER_ROLES.includes(role);
    }
    /**
     * Check if a role has lead attorney permissions
     */
    hasLeadAttorneyPermissions(role) {
        return this.LEAD_ATTORNEY_ROLES.includes(role);
    }
    /**
     * Log audit event for cascading changes
     */
    async logCascadeAuditEvent(member, oldRole, newRole, casesAffected, changeType) {
        try {
            const action = changeType === 'termination'
                ? audit_log_1.AuditAction.STAFF_FIRED
                : audit_log_1.AuditAction.STAFF_DEMOTED;
            await this.auditLogRepository.add({
                guildId: member.guild.id,
                action,
                actorId: 'system-cascade',
                targetId: member.user.id,
                details: {
                    before: { role: oldRole },
                    after: newRole ? { role: newRole } : undefined,
                    reason: `Cascading effects: Unassigned from ${casesAffected} cases due to ${changeType}`,
                    metadata: {
                        source: 'role-change-cascade-service',
                        casesAffected,
                        changeType
                    }
                },
                timestamp: new Date()
            });
        }
        catch (error) {
            logger_1.logger.error('Error logging cascade audit event:', error);
        }
    }
    /**
     * Log audit event for lead attorney removal
     */
    async logLeadAttorneyRemovalAuditEvent(member, oldRole, newRole, casesAffected) {
        try {
            await this.auditLogRepository.add({
                guildId: member.guild.id,
                action: audit_log_1.AuditAction.STAFF_DEMOTED,
                actorId: 'system-cascade',
                targetId: member.user.id,
                details: {
                    before: { role: oldRole, leadAttorney: true },
                    after: { role: newRole, leadAttorney: false },
                    reason: `Cascading effects: Removed as lead attorney from ${casesAffected} cases due to demotion`,
                    metadata: {
                        source: 'role-change-cascade-service',
                        leadCasesAffected: casesAffected,
                        changeType: 'lead-attorney-removal'
                    }
                },
                timestamp: new Date()
            });
        }
        catch (error) {
            logger_1.logger.error('Error logging lead attorney removal audit event:', error);
        }
    }
}
exports.RoleChangeCascadeService = RoleChangeCascadeService;
//# sourceMappingURL=role-change-cascade-service.js.map