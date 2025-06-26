"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleSynchronizationEnhancementService = exports.ConflictSeverity = void 0;
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
const logger_1 = require("../../infrastructure/logger");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
var ConflictSeverity;
(function (ConflictSeverity) {
    ConflictSeverity["LOW"] = "low";
    ConflictSeverity["MEDIUM"] = "medium";
    ConflictSeverity["HIGH"] = "high";
    ConflictSeverity["CRITICAL"] = "critical";
})(ConflictSeverity || (exports.ConflictSeverity = ConflictSeverity = {}));
class RoleSynchronizationEnhancementService {
    constructor() {
        // Map Discord role names to staff roles (same as RoleTrackingService)
        this.STAFF_ROLE_MAPPING = {
            'Managing Partner': staff_role_1.StaffRole.MANAGING_PARTNER,
            'Senior Partner': staff_role_1.StaffRole.SENIOR_PARTNER,
            'Partner': staff_role_1.StaffRole.SENIOR_PARTNER,
            'Senior Associate': staff_role_1.StaffRole.SENIOR_ASSOCIATE,
            'Associate': staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            'Paralegal': staff_role_1.StaffRole.PARALEGAL,
        };
        // Staff roles in hierarchy order (highest first)
        this.STAFF_ROLES_HIERARCHY = [
            'Managing Partner',
            'Senior Partner',
            'Partner',
            'Senior Associate',
            'Associate',
            'Paralegal'
        ];
        // Track conflict history for reporting
        this.conflictHistory = new Map();
        /**
         * Get last sync timestamp for a guild
         */
        this.lastSyncTimestamps = new Map();
        this.staffRepository = new staff_repository_1.StaffRepository();
        this.auditLogRepository = new audit_log_repository_1.AuditLogRepository();
    }
    /**
     * Detect role conflicts for a specific guild member
     */
    async detectMemberConflicts(member) {
        try {
            const staffRoles = this.getStaffRolesFromMember(member);
            if (staffRoles.length <= 1) {
                return null; // No conflict if 0 or 1 staff roles
            }
            // Sort roles by hierarchy level (highest first)
            const sortedRoles = staffRoles.sort((a, b) => b.level - a.level);
            const highestRole = sortedRoles[0];
            // Determine severity based on role difference
            const severity = this.calculateConflictSeverity(sortedRoles);
            const conflict = {
                userId: member.user.id,
                username: member.user.tag,
                guildId: member.guild.id,
                conflictingRoles: sortedRoles,
                highestRole,
                severity,
                detectedAt: new Date()
            };
            logger_1.logger.warn(`Role conflict detected for ${member.user.tag}:`, {
                roles: sortedRoles.map(r => r.roleName),
                severity
            });
            return conflict;
        }
        catch (error) {
            logger_1.logger.error('Error detecting member conflicts:', error);
            return null;
        }
    }
    /**
     * Scan entire guild for role conflicts
     */
    async scanGuildForConflicts(guild, progressCallback) {
        try {
            const members = await guild.members.fetch();
            const conflicts = [];
            const progress = {
                total: members.size,
                processed: 0,
                conflictsFound: 0,
                conflictsResolved: 0,
                errors: 0
            };
            for (const [, member] of members) {
                progress.processed++;
                progress.currentUser = member.user.tag;
                const conflict = await this.detectMemberConflicts(member);
                if (conflict) {
                    conflicts.push(conflict);
                    progress.conflictsFound++;
                }
                // Call progress callback every 10 members to avoid spam
                if (progress.processed % 10 === 0 && progressCallback) {
                    progressCallback(progress);
                }
                // Rate limit handling - pause every 50 members
                if (progress.processed % 50 === 0) {
                    await this.delay(1000); // 1 second delay
                }
            }
            // Final progress callback
            if (progressCallback) {
                progressCallback(progress);
            }
            logger_1.logger.info(`Guild scan complete. Found ${conflicts.length} conflicts out of ${members.size} members`);
            return conflicts;
        }
        catch (error) {
            logger_1.logger.error('Error scanning guild for conflicts:', error);
            throw error;
        }
    }
    /**
     * Resolve a role conflict by removing lower-precedence roles
     */
    async resolveConflict(member, conflict, notify = true) {
        const result = {
            userId: member.user.id,
            resolved: false,
            removedRoles: [],
            keptRole: conflict.highestRole.roleName
        };
        try {
            // Remove all roles except the highest one
            const rolesToRemove = conflict.conflictingRoles
                .filter(r => r.roleId !== conflict.highestRole.roleId)
                .map(r => r.roleId);
            for (const roleId of rolesToRemove) {
                try {
                    await member.roles.remove(roleId, 'Resolving role conflict - keeping highest role only');
                    const removedRole = conflict.conflictingRoles.find(r => r.roleId === roleId);
                    if (removedRole) {
                        result.removedRoles.push(removedRole.roleName);
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Failed to remove role ${roleId} from ${member.user.tag}:`, error);
                    result.error = `Failed to remove some roles: ${error}`;
                }
            }
            result.resolved = result.removedRoles.length === rolesToRemove.length;
            // Create audit log entry
            await this.createConflictResolutionAuditLog(member, conflict, result);
            // Send DM notification if requested
            if (notify && result.resolved) {
                await this.sendConflictResolutionNotification(member, result);
            }
            // Track in history
            this.addToConflictHistory(member.guild.id, result);
            logger_1.logger.info(`Resolved conflict for ${member.user.tag}: removed ${result.removedRoles.join(', ')}, kept ${result.keptRole}`);
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error resolving conflict:', error);
            result.error = `Error resolving conflict: ${error}`;
            return result;
        }
    }
    /**
     * Bulk resolve all conflicts in a guild
     */
    async bulkResolveConflicts(guild, conflicts, progressCallback) {
        const results = [];
        const progress = {
            total: conflicts.length,
            processed: 0,
            conflictsFound: conflicts.length,
            conflictsResolved: 0,
            errors: 0
        };
        for (const conflict of conflicts) {
            try {
                const member = await guild.members.fetch(conflict.userId);
                if (member) {
                    const result = await this.resolveConflict(member, conflict, true);
                    results.push(result);
                    if (result.resolved) {
                        progress.conflictsResolved++;
                    }
                    else {
                        progress.errors++;
                    }
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to resolve conflict for user ${conflict.userId}:`, error);
                progress.errors++;
            }
            progress.processed++;
            // Call progress callback
            if (progressCallback) {
                progressCallback(progress);
            }
            // Rate limit handling
            if (progress.processed % 10 === 0) {
                await this.delay(500); // 500ms delay every 10 resolutions
            }
        }
        logger_1.logger.info(`Bulk resolution complete: ${progress.conflictsResolved} resolved, ${progress.errors} errors`);
        return results;
    }
    /**
     * Validate a role assignment before it happens
     */
    async validateRoleAssignment(member, newRoleName) {
        try {
            // Check if the new role is a staff role
            if (!this.STAFF_ROLES_HIERARCHY.includes(newRoleName)) {
                return { isValid: true }; // Not a staff role, no validation needed
            }
            const currentStaffRoles = this.getStaffRolesFromMember(member);
            // If member has no staff roles, assignment is valid
            if (currentStaffRoles.length === 0) {
                return { isValid: true };
            }
            // Check for conflicts
            const conflicts = currentStaffRoles.map(r => r.roleName);
            return {
                isValid: false,
                conflicts,
                preventionReason: `Member already has staff role(s): ${conflicts.join(', ')}. Only one staff role is allowed at a time.`
            };
        }
        catch (error) {
            logger_1.logger.error('Error validating role assignment:', error);
            return {
                isValid: false,
                preventionReason: 'Error validating role assignment'
            };
        }
    }
    /**
     * Generate a detailed conflict report for a guild
     */
    async generateConflictReport(guild) {
        try {
            const members = await guild.members.fetch();
            const conflicts = await this.scanGuildForConflicts(guild);
            const membersWithRoles = Array.from(members.values()).filter(member => this.getStaffRolesFromMember(member).length > 0).length;
            const conflictsByRole = {};
            const conflictsBySeverity = {
                [ConflictSeverity.LOW]: 0,
                [ConflictSeverity.MEDIUM]: 0,
                [ConflictSeverity.HIGH]: 0,
                [ConflictSeverity.CRITICAL]: 0
            };
            // Analyze conflicts
            for (const conflict of conflicts) {
                conflictsBySeverity[conflict.severity]++;
                for (const role of conflict.conflictingRoles) {
                    conflictsByRole[role.roleName] = (conflictsByRole[role.roleName] || 0) + 1;
                }
            }
            // Get resolution history for this guild
            const resolutionHistory = this.conflictHistory.get(guild.id) || [];
            const report = {
                guildId: guild.id,
                generatedAt: new Date(),
                totalMembers: members.size,
                membersWithRoles,
                conflictsFound: conflicts.length,
                conflictsByRole,
                conflictsBySeverity,
                resolutionHistory: resolutionHistory.map(r => ({
                    userId: r.userId,
                    username: members.get(r.userId)?.user.tag || 'Unknown',
                    resolvedAt: new Date(),
                    removedRoles: r.removedRoles,
                    keptRole: r.keptRole
                }))
            };
            return report;
        }
        catch (error) {
            logger_1.logger.error('Error generating conflict report:', error);
            throw error;
        }
    }
    /**
     * Get staff roles from a guild member
     */
    getStaffRolesFromMember(member) {
        const staffRoles = [];
        for (const [roleId, role] of member.roles.cache) {
            if (this.STAFF_ROLES_HIERARCHY.includes(role.name)) {
                const staffRole = this.STAFF_ROLE_MAPPING[role.name];
                if (staffRole) {
                    staffRoles.push({
                        roleName: role.name,
                        roleId,
                        staffRole,
                        level: staff_role_1.RoleUtils.getRoleLevel(staffRole)
                    });
                }
            }
        }
        return staffRoles;
    }
    /**
     * Calculate conflict severity based on role differences
     */
    calculateConflictSeverity(roles) {
        if (roles.length === 0)
            return ConflictSeverity.LOW;
        const highestLevel = roles[0].level;
        const lowestLevel = roles[roles.length - 1].level;
        const levelDifference = highestLevel - lowestLevel;
        // Multiple high-level roles is critical
        const highLevelRoles = roles.filter(r => r.level >= 5).length;
        if (highLevelRoles > 1) {
            return ConflictSeverity.CRITICAL;
        }
        // Large level differences are high severity
        if (levelDifference >= 3) {
            return ConflictSeverity.HIGH;
        }
        // Medium level differences
        if (levelDifference >= 2) {
            return ConflictSeverity.MEDIUM;
        }
        return ConflictSeverity.LOW;
    }
    /**
     * Create audit log entry for conflict resolution
     */
    async createConflictResolutionAuditLog(member, conflict, result) {
        try {
            await this.auditLogRepository.add({
                guildId: member.guild.id,
                action: audit_log_1.AuditAction.ROLE_SYNC_PERFORMED,
                actorId: 'System-RoleSync',
                targetId: member.user.id,
                details: {
                    before: {
                        roles: conflict.conflictingRoles.map(r => r.roleName)
                    },
                    after: {
                        role: result.keptRole
                    },
                    reason: 'Automatic role conflict resolution',
                    metadata: {
                        conflictSeverity: conflict.severity,
                        removedRoles: result.removedRoles,
                        resolved: result.resolved,
                        error: result.error
                    }
                },
                timestamp: new Date(),
                severity: conflict.severity
            });
        }
        catch (error) {
            logger_1.logger.error('Error creating conflict resolution audit log:', error);
        }
    }
    /**
     * Send DM notification about conflict resolution
     */
    async sendConflictResolutionNotification(member, result) {
        try {
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: '⚠️ Staff Role Conflict Resolved',
                description: 'Multiple staff roles were detected on your account. The system has automatically resolved this conflict.'
            });
            embed.addFields({
                name: 'Roles Removed',
                value: result.removedRoles.join('\n') || 'None',
                inline: true
            }, {
                name: 'Role Kept',
                value: result.keptRole,
                inline: true
            }, {
                name: 'Why did this happen?',
                value: 'Staff members can only hold one role at a time. The system keeps your highest-ranking role automatically.',
                inline: false
            });
            embed.setFooter({
                text: 'If you believe this was an error, please contact an administrator.'
            });
            await member.send({ embeds: [embed] });
        }
        catch (error) {
            // User might have DMs disabled
            logger_1.logger.warn(`Could not send DM to ${member.user.tag}:`, error);
        }
    }
    /**
     * Add to conflict resolution history
     */
    addToConflictHistory(guildId, result) {
        const history = this.conflictHistory.get(guildId) || [];
        history.push(result);
        // Keep only last 100 resolutions per guild
        if (history.length > 100) {
            history.shift();
        }
        this.conflictHistory.set(guildId, history);
    }
    /**
     * Utility delay function for rate limiting
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Clear conflict history for a guild
     */
    clearConflictHistory(guildId) {
        this.conflictHistory.delete(guildId);
    }
    /**
     * Get conflict statistics for a guild
     */
    getConflictStatistics(guildId) {
        const history = this.conflictHistory.get(guildId) || [];
        const stats = {
            totalResolutions: history.length,
            successfulResolutions: history.filter(r => r.resolved).length,
            failedResolutions: history.filter(r => !r.resolved).length,
            mostCommonConflicts: {}
        };
        // Count most common role removals
        for (const resolution of history) {
            for (const role of resolution.removedRoles) {
                stats.mostCommonConflicts[role] = (stats.mostCommonConflicts[role] || 0) + 1;
            }
        }
        return stats;
    }
    /**
     * Perform incremental sync for specific members or changes since last sync
     */
    async incrementalSync(guild, options = {}) {
        const result = {
            conflicts: [],
            resolved: [],
            errors: []
        };
        try {
            let membersToCheck = [];
            if (options.memberIds && options.memberIds.length > 0) {
                // Sync specific members
                for (const memberId of options.memberIds) {
                    try {
                        const member = await guild.members.fetch(memberId);
                        if (member) {
                            membersToCheck.push(member);
                        }
                    }
                    catch (error) {
                        result.errors.push(`Failed to fetch member ${memberId}: ${error}`);
                    }
                }
            }
            else if (options.sinceTimestamp) {
                // Get members who joined or had role changes since timestamp
                const allMembers = await guild.members.fetch();
                membersToCheck = Array.from(allMembers.values()).filter(member => {
                    // Check if member joined after timestamp
                    if (member.joinedAt && member.joinedAt > options.sinceTimestamp) {
                        return true;
                    }
                    // For role changes, we'd need to check audit logs
                    // For now, we'll check all members with staff roles
                    const staffRoles = this.getStaffRolesFromMember(member);
                    return staffRoles.length > 0;
                });
            }
            else {
                // Default: check all members with staff roles
                const allMembers = await guild.members.fetch();
                membersToCheck = Array.from(allMembers.values()).filter(member => {
                    const staffRoles = this.getStaffRolesFromMember(member);
                    return staffRoles.length > 0;
                });
            }
            // Check for conflicts in selected members
            for (const member of membersToCheck) {
                const conflict = await this.detectMemberConflicts(member);
                if (conflict) {
                    result.conflicts.push(conflict);
                    // Auto-resolve if requested
                    if (options.autoResolve) {
                        const resolution = await this.resolveConflict(member, conflict, true);
                        result.resolved.push(resolution);
                    }
                }
            }
            logger_1.logger.info(`Incremental sync completed: ${result.conflicts.length} conflicts found, ${result.resolved.length} resolved`);
        }
        catch (error) {
            logger_1.logger.error('Error in incremental sync:', error);
            result.errors.push(`Incremental sync error: ${error}`);
        }
        return result;
    }
    /**
     * Create interactive modal for manual conflict resolution
     */
    createConflictResolutionModal(conflict) {
        const modalCustomId = `resolve_conflict_${conflict.userId}_${Date.now()}`;
        const modal = {
            customId: modalCustomId,
            title: 'Resolve Role Conflict',
            components: [
                {
                    type: 1, // Action row
                    components: [{
                            type: 4, // Text input
                            customId: 'selected_role',
                            label: 'Select which role to keep:',
                            style: 2, // Paragraph
                            required: true,
                            value: conflict.highestRole.roleName,
                            placeholder: `Current roles: ${conflict.conflictingRoles.map(r => r.roleName).join(', ')}`
                        }]
                },
                {
                    type: 1, // Action row
                    components: [{
                            type: 4, // Text input
                            customId: 'resolution_reason',
                            label: 'Reason for resolution:',
                            style: 2, // Paragraph
                            required: false,
                            placeholder: 'Optional: Explain why this resolution was chosen'
                        }]
                },
                {
                    type: 1, // Action row
                    components: [{
                            type: 4, // Text input
                            customId: 'notify_user',
                            label: 'Notify user? (yes/no)',
                            style: 1, // Short
                            required: true,
                            value: 'yes',
                            max_length: 3
                        }]
                }
            ]
        };
        return modal;
    }
    /**
     * Handle manual conflict resolution from modal submission
     */
    async handleManualConflictResolution(interaction, // ModalSubmitInteraction
    conflict) {
        const selectedRoleName = interaction.fields.getTextInputValue('selected_role');
        const reason = interaction.fields.getTextInputValue('resolution_reason') || 'Manual resolution via modal';
        const notifyUser = interaction.fields.getTextInputValue('notify_user').toLowerCase() === 'yes';
        try {
            const guild = interaction.guild;
            const member = await guild.members.fetch(conflict.userId);
            if (!member) {
                throw new Error('Member not found');
            }
            // Find the selected role in the conflict
            const selectedRole = conflict.conflictingRoles.find(r => r.roleName === selectedRoleName);
            if (!selectedRole) {
                throw new Error(`Invalid role selection: ${selectedRoleName}`);
            }
            // Create modified conflict with selected role as highest
            const modifiedConflict = {
                ...conflict,
                highestRole: selectedRole
            };
            // Resolve the conflict
            const result = await this.resolveConflict(member, modifiedConflict, notifyUser);
            // Add resolution reason to audit log
            await this.auditLogRepository.add({
                guildId: guild.id,
                action: audit_log_1.AuditAction.ROLE_SYNC_PERFORMED,
                actorId: interaction.user.id,
                targetId: member.user.id,
                details: {
                    before: {
                        roles: conflict.conflictingRoles.map(r => r.roleName)
                    },
                    after: {
                        role: selectedRoleName
                    },
                    reason: `Manual resolution: ${reason}`,
                    metadata: {
                        conflictSeverity: conflict.severity,
                        removedRoles: result.removedRoles,
                        resolved: result.resolved,
                        manualResolution: true,
                        resolvedBy: interaction.user.tag
                    }
                },
                timestamp: new Date(),
                severity: 'high'
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error in manual conflict resolution:', error);
            return {
                userId: conflict.userId,
                resolved: false,
                removedRoles: [],
                keptRole: '',
                error: `Manual resolution failed: ${error}`
            };
        }
    }
    /**
     * Check for conflicts when a role change occurs (for RoleTrackingService integration)
     */
    async checkRoleChangeForConflicts(member, oldRoles, newRoles) {
        try {
            // Get staff roles from old and new states
            const oldStaffRoles = oldRoles.filter(role => this.STAFF_ROLES_HIERARCHY.includes(role));
            const newStaffRoles = newRoles.filter(role => this.STAFF_ROLES_HIERARCHY.includes(role));
            // Check if adding a new staff role
            const addedRoles = newStaffRoles.filter(role => !oldStaffRoles.includes(role));
            if (addedRoles.length > 0 && oldStaffRoles.length > 0) {
                // Trying to add a staff role when user already has one
                const conflict = await this.detectMemberConflicts(member);
                return {
                    hasConflict: true,
                    conflict: conflict || undefined,
                    shouldPrevent: true,
                    preventionReason: `Cannot assign multiple staff roles. User already has: ${oldStaffRoles.join(', ')}`
                };
            }
            // Check for existing conflicts
            const conflict = await this.detectMemberConflicts(member);
            return {
                hasConflict: conflict !== null,
                conflict: conflict || undefined,
                shouldPrevent: false
            };
        }
        catch (error) {
            logger_1.logger.error('Error checking role change for conflicts:', error);
            return {
                hasConflict: false,
                shouldPrevent: false
            };
        }
    }
    getLastSyncTimestamp(guildId) {
        return this.lastSyncTimestamps.get(guildId) || null;
    }
    updateLastSyncTimestamp(guildId) {
        this.lastSyncTimestamps.set(guildId, new Date());
    }
}
exports.RoleSynchronizationEnhancementService = RoleSynchronizationEnhancementService;
//# sourceMappingURL=role-synchronization-enhancement-service.js.map