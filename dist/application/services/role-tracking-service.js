"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleTrackingService = void 0;
const discord_js_1 = require("discord.js");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
const permission_service_1 = require("./permission-service");
const business_rule_validation_service_1 = require("./business-rule-validation-service");
const channel_permission_manager_1 = require("./channel-permission-manager");
const role_change_cascade_service_1 = require("./role-change-cascade-service");
const role_synchronization_enhancement_service_1 = require("./role-synchronization-enhancement-service");
const logger_1 = require("../../infrastructure/logger");
class RoleTrackingService {
    constructor() {
        // Map Discord role names to staff roles based on Anarchy config
        this.STAFF_ROLE_MAPPING = {
            'Managing Partner': staff_role_1.StaffRole.MANAGING_PARTNER,
            'Senior Partner': staff_role_1.StaffRole.SENIOR_PARTNER,
            'Partner': staff_role_1.StaffRole.SENIOR_PARTNER, // Map to Senior Partner since no Junior Partner in new config
            'Senior Associate': staff_role_1.StaffRole.SENIOR_ASSOCIATE,
            'Associate': staff_role_1.StaffRole.JUNIOR_ASSOCIATE, // Map to Junior Associate
            'Paralegal': staff_role_1.StaffRole.PARALEGAL,
        };
        // Get staff roles from Discord roles in hierarchy order (highest first)
        this.STAFF_ROLES_HIERARCHY = [
            'Managing Partner',
            'Senior Partner',
            'Partner',
            'Senior Associate',
            'Associate',
            'Paralegal'
        ];
        this.staffRepository = new staff_repository_1.StaffRepository();
        this.auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        // Initialize channel permission manager with required dependencies
        const caseRepository = new case_repository_1.CaseRepository();
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        const businessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(guildConfigRepository, this.staffRepository, caseRepository, permissionService);
        this.channelPermissionManager = new channel_permission_manager_1.ChannelPermissionManager(caseRepository, this.staffRepository, this.auditLogRepository, guildConfigRepository, permissionService, businessRuleValidationService);
        // Initialize the cascade service
        this.roleChangeCascadeService = new role_change_cascade_service_1.RoleChangeCascadeService();
        // Initialize the role synchronization enhancement service
        this.roleSynchronizationEnhancementService = new role_synchronization_enhancement_service_1.RoleSynchronizationEnhancementService();
    }
    /**
     * Initialize role tracking for a Discord client
     */
    initializeTracking(client) {
        client.on(discord_js_1.Events.GuildMemberUpdate, async (oldMember, newMember) => {
            try {
                await this.handleRoleChange(oldMember, newMember);
            }
            catch (error) {
                logger_1.logger.error('Error handling role change:', error);
            }
        });
        // Initialize the cascade service with the Discord client
        this.roleChangeCascadeService.initialize(client);
        logger_1.logger.info('Role tracking service initialized');
    }
    /**
     * Handle role changes for a guild member
     */
    async handleRoleChange(oldMember, newMember) {
        const oldStaffRoles = this.getStaffRoles(oldMember.roles.cache.map(r => r.name));
        const newStaffRoles = this.getStaffRoles(newMember.roles.cache.map(r => r.name));
        // If no staff roles involved, ignore
        if (oldStaffRoles.length === 0 && newStaffRoles.length === 0) {
            return;
        }
        const guildId = newMember.guild.id;
        const userId = newMember.user.id;
        // Check for role conflicts before processing
        const conflictCheck = await this.roleSynchronizationEnhancementService.checkRoleChangeForConflicts(newMember, oldMember.roles.cache.map(r => r.name), newMember.roles.cache.map(r => r.name));
        if (conflictCheck.shouldPrevent) {
            logger_1.logger.warn(`Preventing role change for ${newMember.displayName}: ${conflictCheck.preventionReason}`);
            // In a real implementation, we might want to revert the role change here
            // For now, we'll just log and return
            return;
        }
        // If there's a conflict but it shouldn't be prevented, handle it
        if (conflictCheck.hasConflict && conflictCheck.conflict) {
            logger_1.logger.info(`Role conflict detected for ${newMember.displayName}, auto-resolving...`);
            await this.roleSynchronizationEnhancementService.resolveConflict(newMember, conflictCheck.conflict, true // notify user
            );
            // After resolution, re-evaluate the roles
            const updatedMember = await newMember.guild.members.fetch(userId);
            const updatedStaffRoles = this.getStaffRoles(updatedMember.roles.cache.map(r => r.name));
            // Update newStaffRoles to reflect the resolved state
            newStaffRoles.length = 0;
            newStaffRoles.push(...updatedStaffRoles);
        }
        // Determine the highest role (most senior) in each state
        const oldHighestRole = this.getHighestStaffRole(oldStaffRoles);
        const newHighestRole = this.getHighestStaffRole(newStaffRoles);
        // Log role change for debugging
        logger_1.logger.info(`Role change detected for ${newMember.displayName} in guild ${guildId}:`, {
            oldRoles: oldStaffRoles,
            newRoles: newStaffRoles,
            oldHighest: oldHighestRole,
            newHighest: newHighestRole
        });
        // Determine action type and handle accordingly
        if (!oldHighestRole && newHighestRole) {
            // HIRING: No staff role -> Staff role
            await this.handleHiring(userId, guildId, newHighestRole, newMember);
        }
        else if (oldHighestRole && !newHighestRole) {
            // FIRING: Staff role -> No staff role  
            await this.handleFiring(userId, guildId, oldHighestRole, newMember);
        }
        else if (oldHighestRole && newHighestRole) {
            // PROMOTION/DEMOTION: Staff role -> Different staff role
            const oldLevel = this.getRoleLevel(oldHighestRole);
            const newLevel = this.getRoleLevel(newHighestRole);
            if (newLevel > oldLevel) {
                // PROMOTION: Higher level role
                await this.handlePromotion(userId, guildId, oldHighestRole, newHighestRole, newMember);
            }
            else if (newLevel < oldLevel) {
                // DEMOTION: Lower level role
                await this.handleDemotion(userId, guildId, oldHighestRole, newHighestRole, newMember);
            }
            // If same level, could be lateral move - log but don't process
            else if (oldHighestRole !== newHighestRole) {
                logger_1.logger.info(`Lateral role change for ${userId}: ${oldHighestRole} -> ${newHighestRole}`);
            }
        }
    }
    /**
     * Handle hiring a new staff member
     */
    async handleHiring(userId, guildId, role, member) {
        try {
            // Check if staff record already exists (might be rehiring)
            const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
            const staffRole = this.mapDiscordRoleToStaffRole(role);
            if (!staffRole) {
                logger_1.logger.warn(`Could not map Discord role ${role} to staff role`);
                return;
            }
            if (existingStaff) {
                // Reactivate existing staff member
                await this.staffRepository.update(existingStaff._id.toString(), {
                    status: RetainerStatus.ACTIVE,
                    role: staffRole,
                    hiredAt: new Date() // Update hire date for rehiring
                });
                logger_1.logger.info(`Reactivated staff member ${userId} as ${role} in guild ${guildId}`);
            }
            else {
                // Create new staff record
                const newStaff = {
                    userId,
                    guildId,
                    robloxUsername: member.displayName, // Use Discord display name as placeholder
                    role: staffRole,
                    hiredAt: new Date(),
                    hiredBy: 'System', // Could be enhanced to track who added the role
                    promotionHistory: [{
                            fromRole: null, // Initial hire has no "from" role
                            toRole: staffRole,
                            promotedBy: 'System',
                            promotedAt: new Date(),
                            reason: 'Initial hiring via Discord role assignment',
                            actionType: 'hire'
                        }],
                    status: RetainerStatus.ACTIVE,
                    discordRoleId: this.findDiscordRoleId(member.guild, role)
                };
                await this.staffRepository.add(newStaff);
                logger_1.logger.info(`Hired new staff member ${userId} as ${role} in guild ${guildId}`);
            }
            // Update channel permissions for new hire
            const newStaffRole = this.mapDiscordRoleToStaffRole(role);
            if (newStaffRole) {
                try {
                    await this.channelPermissionManager.handleRoleChange(member.guild, member, undefined, // No old role for new hire
                    newStaffRole, 'hire');
                    logger_1.logger.info(`Updated channel permissions for new hire ${userId} with role ${role}`);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to update channel permissions for new hire ${userId}:`, error);
                }
            }
            // Log audit trail
            await this.logAuditEvent({
                type: 'hire',
                userId,
                guildId,
                newRole: role,
                changedBy: 'System',
                timestamp: new Date()
            });
            // Handle cascading effects (in this case, hiring doesn't require cascade handling)
            // but we call it for consistency
            await this.roleChangeCascadeService.handleRoleChange({
                member,
                oldRole: undefined,
                newRole: staffRole,
                changeType: 'hire'
            });
        }
        catch (error) {
            logger_1.logger.error(`Error handling hiring for user ${userId}:`, error);
        }
    }
    /**
     * Handle firing a staff member
     */
    async handleFiring(userId, guildId, oldRole, member) {
        try {
            const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
            if (existingStaff) {
                // Delete the staff record from the database
                const deleted = await this.staffRepository.delete(existingStaff._id.toString());
                if (deleted) {
                    logger_1.logger.info(`Fired and deleted staff member ${userId} from ${oldRole} in guild ${guildId}`);
                }
                else {
                    logger_1.logger.warn(`Failed to delete staff record for user ${userId} in guild ${guildId}`);
                }
            }
            // Remove channel permissions for fired staff
            const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
            if (oldStaffRole) {
                try {
                    await this.channelPermissionManager.handleRoleChange(member.guild, member, oldStaffRole, undefined, // No new role for fired staff
                    'fire');
                    logger_1.logger.info(`Removed channel permissions for fired staff ${userId} with old role ${oldRole}`);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to remove channel permissions for fired staff ${userId}:`, error);
                }
            }
            // Log audit trail
            await this.logAuditEvent({
                type: 'fire',
                userId,
                guildId,
                oldRole,
                changedBy: 'System',
                timestamp: new Date()
            });
            // Handle cascading effects (unassign from cases, remove permissions)
            if (oldStaffRole) {
                await this.roleChangeCascadeService.handleRoleChange({
                    member,
                    oldRole: oldStaffRole,
                    newRole: undefined,
                    changeType: 'fire'
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Error handling firing for user ${userId}:`, error);
        }
    }
    /**
     * Handle promotion of a staff member
     */
    async handlePromotion(userId, guildId, oldRole, newRole, member) {
        try {
            const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
            if (existingStaff) {
                const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
                const newStaffRole = this.mapDiscordRoleToStaffRole(newRole);
                if (oldStaffRole && newStaffRole) {
                    const promotionRecord = {
                        fromRole: oldStaffRole,
                        toRole: newStaffRole,
                        promotedBy: 'System',
                        promotedAt: new Date(),
                        reason: 'Promoted via Discord role change',
                        actionType: 'promotion'
                    };
                    await this.staffRepository.update(existingStaff._id.toString(), {
                        role: newStaffRole,
                        promotionHistory: [...existingStaff.promotionHistory, promotionRecord],
                        discordRoleId: this.findDiscordRoleId(member.guild, newRole)
                    });
                }
                logger_1.logger.info(`Promoted staff member ${userId} from ${oldRole} to ${newRole} in guild ${guildId}`);
            }
            // Update channel permissions for promotion
            const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
            const newStaffRole = this.mapDiscordRoleToStaffRole(newRole);
            if (oldStaffRole && newStaffRole) {
                try {
                    await this.channelPermissionManager.handleRoleChange(member.guild, member, oldStaffRole, newStaffRole, 'promotion');
                    logger_1.logger.info(`Updated channel permissions for promotion ${userId} from ${oldRole} to ${newRole}`);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to update channel permissions for promotion ${userId}:`, error);
                }
            }
            // Log audit trail
            await this.logAuditEvent({
                type: 'promotion',
                userId,
                guildId,
                oldRole,
                newRole,
                changedBy: 'System',
                timestamp: new Date()
            });
            // Handle cascading effects (generally promotions grant more permissions, no cascade needed)
            // but we call it for consistency
            const oldStaffRoleForCascade = this.mapDiscordRoleToStaffRole(oldRole);
            const newStaffRoleForCascade = this.mapDiscordRoleToStaffRole(newRole);
            if (oldStaffRoleForCascade && newStaffRoleForCascade) {
                await this.roleChangeCascadeService.handleRoleChange({
                    member,
                    oldRole: oldStaffRoleForCascade,
                    newRole: newStaffRoleForCascade,
                    changeType: 'promotion'
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Error handling promotion for user ${userId}:`, error);
        }
    }
    /**
     * Handle demotion of a staff member
     */
    async handleDemotion(userId, guildId, oldRole, newRole, member) {
        try {
            const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
            if (existingStaff) {
                const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
                const newStaffRole = this.mapDiscordRoleToStaffRole(newRole);
                if (oldStaffRole && newStaffRole) {
                    const demotionRecord = {
                        fromRole: oldStaffRole,
                        toRole: newStaffRole,
                        promotedBy: 'System',
                        promotedAt: new Date(),
                        reason: 'Demoted via Discord role change',
                        actionType: 'demotion'
                    };
                    await this.staffRepository.update(existingStaff._id.toString(), {
                        role: newStaffRole,
                        promotionHistory: [...existingStaff.promotionHistory, demotionRecord],
                        discordRoleId: this.findDiscordRoleId(member.guild, newRole)
                    });
                }
                logger_1.logger.info(`Demoted staff member ${userId} from ${oldRole} to ${newRole} in guild ${guildId}`);
            }
            // Update channel permissions for demotion
            const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
            const newStaffRole = this.mapDiscordRoleToStaffRole(newRole);
            if (oldStaffRole && newStaffRole) {
                try {
                    await this.channelPermissionManager.handleRoleChange(member.guild, member, oldStaffRole, newStaffRole, 'demotion');
                    logger_1.logger.info(`Updated channel permissions for demotion ${userId} from ${oldRole} to ${newRole}`);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to update channel permissions for demotion ${userId}:`, error);
                }
            }
            // Log audit trail
            await this.logAuditEvent({
                type: 'demotion',
                userId,
                guildId,
                oldRole,
                newRole,
                changedBy: 'System',
                timestamp: new Date()
            });
            // Handle cascading effects (may lose case permissions)
            const oldStaffRoleForCascade = this.mapDiscordRoleToStaffRole(oldRole);
            const newStaffRoleForCascade = this.mapDiscordRoleToStaffRole(newRole);
            if (oldStaffRoleForCascade && newStaffRoleForCascade) {
                await this.roleChangeCascadeService.handleRoleChange({
                    member,
                    oldRole: oldStaffRoleForCascade,
                    newRole: newStaffRoleForCascade,
                    changeType: 'demotion'
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Error handling demotion for user ${userId}:`, error);
        }
    }
    /**
     * Extract staff roles from a list of role names
     */
    getStaffRoles(roleNames) {
        return roleNames.filter(roleName => this.STAFF_ROLES_HIERARCHY.includes(roleName));
    }
    /**
     * Get the highest (most senior) staff role from a list
     */
    getHighestStaffRole(staffRoles) {
        for (const role of this.STAFF_ROLES_HIERARCHY) {
            if (staffRoles.includes(role)) {
                return role;
            }
        }
        return null;
    }
    /**
     * Get the hierarchy level of a Discord role (higher = more senior)
     */
    getRoleLevel(roleName) {
        const index = this.STAFF_ROLES_HIERARCHY.indexOf(roleName);
        return index === -1 ? 0 : this.STAFF_ROLES_HIERARCHY.length - index;
    }
    /**
     * Map Discord role name to StaffRole enum
     */
    mapDiscordRoleToStaffRole(discordRoleName) {
        return this.STAFF_ROLE_MAPPING[discordRoleName] || null;
    }
    /**
     * Find Discord role ID by name
     */
    findDiscordRoleId(guild, roleName) {
        const role = guild.roles.cache.find(r => r.name === roleName);
        return role?.id;
    }
    /**
     * Log audit event for role changes
     */
    async logAuditEvent(event) {
        try {
            const actionMap = {
                hire: audit_log_1.AuditAction.STAFF_HIRED,
                fire: audit_log_1.AuditAction.STAFF_FIRED,
                promotion: audit_log_1.AuditAction.STAFF_PROMOTED,
                demotion: audit_log_1.AuditAction.STAFF_DEMOTED
            };
            const oldStaffRole = event.oldRole ? this.mapDiscordRoleToStaffRole(event.oldRole) : null;
            const newStaffRole = event.newRole ? this.mapDiscordRoleToStaffRole(event.newRole) : null;
            const auditLog = {
                guildId: event.guildId,
                action: actionMap[event.type],
                actorId: event.changedBy || 'System',
                targetId: event.userId,
                details: {
                    before: oldStaffRole ? { role: oldStaffRole } : undefined,
                    after: newStaffRole ? { role: newStaffRole } : undefined,
                    reason: `Role change via Discord: ${event.type}`,
                    metadata: { source: 'role-tracking-service', discordRole: event.newRole || event.oldRole }
                },
                timestamp: event.timestamp
            };
            await this.auditLogRepository.add(auditLog);
        }
        catch (error) {
            logger_1.logger.error('Error logging audit event:', error);
        }
    }
    /**
     * Manually sync all Discord roles with staff database for a guild
     */
    async syncGuildRoles(guild) {
        try {
            logger_1.logger.info(`Starting role sync for guild ${guild.id}`);
            // Get all current staff from database
            const currentStaff = await this.staffRepository.findByGuildId(guild.id);
            const currentStaffIds = new Set(currentStaff.map(s => s.userId));
            // Get all members with staff roles
            const members = await guild.members.fetch();
            const membersWithStaffRoles = new Map(); // userId -> highest role
            for (const [, member] of members) {
                const staffRoles = this.getStaffRoles(member.roles.cache.map(r => r.name));
                const highestRole = this.getHighestStaffRole(staffRoles);
                if (highestRole) {
                    membersWithStaffRoles.set(member.user.id, highestRole);
                }
            }
            // Find discrepancies and fix them
            let syncCount = 0;
            // Check for users with Discord staff roles but no database record
            for (const [userId, roleName] of membersWithStaffRoles) {
                if (!currentStaffIds.has(userId)) {
                    const member = members.get(userId);
                    if (member) {
                        await this.handleHiring(userId, guild.id, roleName, member);
                        syncCount++;
                    }
                }
            }
            // Check for database staff records without Discord roles
            for (const staff of currentStaff) {
                if (staff.status === 'active' && !membersWithStaffRoles.has(staff.userId)) {
                    // Staff member in DB but no Discord role - mark as terminated
                    await this.staffRepository.update(staff._id.toString(), {
                        status: 'terminated'
                    });
                    await this.logAuditEvent({
                        type: 'fire',
                        userId: staff.userId,
                        guildId: guild.id,
                        oldRole: staff.role,
                        changedBy: 'System-Sync',
                        timestamp: new Date()
                    });
                    syncCount++;
                }
            }
            logger_1.logger.info(`Completed role sync for guild ${guild.id}. Synced ${syncCount} records.`);
        }
        catch (error) {
            logger_1.logger.error(`Error syncing roles for guild ${guild.id}:`, error);
        }
    }
}
exports.RoleTrackingService = RoleTrackingService;
//# sourceMappingURL=role-tracking-service.js.map