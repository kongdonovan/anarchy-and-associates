"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleTrackingService = void 0;
const discord_js_1 = require("discord.js");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
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
                    status: 'active',
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
                    status: 'active',
                    discordRoleId: this.findDiscordRoleId(member.guild, role)
                };
                await this.staffRepository.add(newStaff);
                logger_1.logger.info(`Hired new staff member ${userId} as ${role} in guild ${guildId}`);
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
        }
        catch (error) {
            logger_1.logger.error(`Error handling hiring for user ${userId}:`, error);
        }
    }
    /**
     * Handle firing a staff member
     */
    async handleFiring(userId, guildId, oldRole, _member) {
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
            // Log audit trail
            await this.logAuditEvent({
                type: 'fire',
                userId,
                guildId,
                oldRole,
                changedBy: 'System',
                timestamp: new Date()
            });
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