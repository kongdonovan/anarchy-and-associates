"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelPermissionManager = void 0;
const discord_js_1 = require("discord.js");
const case_1 = require("../../domain/entities/case");
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
const logger_1 = require("../../infrastructure/logger");
class ChannelPermissionManager {
    constructor(caseRepository, staffRepository, auditLogRepository, guildConfigRepository, permissionService, businessRuleValidationService) {
        // Channel type patterns for automatic detection
        this.CHANNEL_PATTERNS = {
            case: /^case-|^aa-\d{4}-\d+-/i,
            staff: /^staff-|^lawyer-|^paralegal-|^team-/i,
            admin: /^admin-|^modlog/i,
            legalTeam: /^legal-team|^lawyer-lounge/i
        };
        // Permission matrix for different channel types and roles
        this.PERMISSION_MATRIX = {
            case: {
                [staff_role_1.StaffRole.MANAGING_PARTNER]: {
                    channelType: 'case',
                    requiredRole: staff_role_1.StaffRole.MANAGING_PARTNER,
                    permissions: { view: true, send: true, manage: true, read_history: true }
                },
                [staff_role_1.StaffRole.SENIOR_PARTNER]: {
                    channelType: 'case',
                    requiredRole: staff_role_1.StaffRole.SENIOR_PARTNER,
                    permissions: { view: true, send: true, manage: true, read_history: true }
                },
                [staff_role_1.StaffRole.JUNIOR_PARTNER]: {
                    channelType: 'case',
                    requiredRole: staff_role_1.StaffRole.JUNIOR_PARTNER,
                    permissions: { view: true, send: true, manage: false, read_history: true }
                },
                [staff_role_1.StaffRole.SENIOR_ASSOCIATE]: {
                    channelType: 'case',
                    requiredRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
                    permissions: { view: true, send: true, manage: false, read_history: true }
                },
                [staff_role_1.StaffRole.JUNIOR_ASSOCIATE]: {
                    channelType: 'case',
                    requiredRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    permissions: { view: true, send: true, manage: false, read_history: true }
                },
                [staff_role_1.StaffRole.PARALEGAL]: {
                    channelType: 'case',
                    requiredRole: staff_role_1.StaffRole.PARALEGAL,
                    permissions: { view: true, send: true, manage: false, read_history: true }
                }
            },
            staff: {
                [staff_role_1.StaffRole.MANAGING_PARTNER]: {
                    channelType: 'staff',
                    requiredPermission: 'senior-staff',
                    permissions: { view: true, send: true, manage: true, read_history: true }
                },
                [staff_role_1.StaffRole.SENIOR_PARTNER]: {
                    channelType: 'staff',
                    requiredPermission: 'senior-staff',
                    permissions: { view: true, send: true, manage: true, read_history: true }
                },
                [staff_role_1.StaffRole.JUNIOR_PARTNER]: {
                    channelType: 'staff',
                    requiredPermission: 'lawyer',
                    permissions: { view: true, send: true, manage: false, read_history: true }
                },
                [staff_role_1.StaffRole.SENIOR_ASSOCIATE]: {
                    channelType: 'staff',
                    requiredPermission: 'lawyer',
                    permissions: { view: true, send: true, manage: false, read_history: true }
                },
                [staff_role_1.StaffRole.JUNIOR_ASSOCIATE]: {
                    channelType: 'staff',
                    requiredPermission: 'lawyer',
                    permissions: { view: true, send: true, manage: false, read_history: true }
                },
                [staff_role_1.StaffRole.PARALEGAL]: {
                    channelType: 'staff',
                    permissions: { view: true, send: true, manage: false, read_history: true }
                }
            },
            admin: {
                [staff_role_1.StaffRole.MANAGING_PARTNER]: {
                    channelType: 'admin',
                    requiredPermission: 'admin',
                    permissions: { view: true, send: true, manage: true, read_history: true }
                }
            },
            legalTeam: {
                [staff_role_1.StaffRole.MANAGING_PARTNER]: {
                    channelType: 'legal-team',
                    requiredPermission: 'lawyer',
                    permissions: { view: true, send: true, manage: true, read_history: true }
                },
                [staff_role_1.StaffRole.SENIOR_PARTNER]: {
                    channelType: 'legal-team',
                    requiredPermission: 'lawyer',
                    permissions: { view: true, send: true, manage: true, read_history: true }
                },
                [staff_role_1.StaffRole.JUNIOR_PARTNER]: {
                    channelType: 'legal-team',
                    requiredPermission: 'lawyer',
                    permissions: { view: true, send: true, manage: false, read_history: true }
                },
                [staff_role_1.StaffRole.SENIOR_ASSOCIATE]: {
                    channelType: 'legal-team',
                    requiredPermission: 'lawyer',
                    permissions: { view: true, send: true, manage: false, read_history: true }
                },
                [staff_role_1.StaffRole.JUNIOR_ASSOCIATE]: {
                    channelType: 'legal-team',
                    requiredPermission: 'lawyer',
                    permissions: { view: true, send: true, manage: false, read_history: true }
                }
            }
        };
        this.caseRepository = caseRepository;
        this.staffRepository = staffRepository;
        this.auditLogRepository = auditLogRepository;
        this.guildConfigRepository = guildConfigRepository;
        this.permissionService = permissionService;
        this.businessRuleValidationService = businessRuleValidationService;
    }
    /**
     * Handle role change and update all relevant channel permissions
     */
    async handleRoleChange(guild, member, oldRole, newRole, changeType = 'promotion') {
        try {
            const updates = [];
            logger_1.logger.info('Processing channel permission updates for role change', {
                guildId: guild.id,
                userId: member.user.id,
                oldRole,
                newRole,
                changeType
            });
            // Get all channels that need permission updates
            const channelsToUpdate = await this.getChannelsForPermissionUpdate(guild, member.user.id);
            // Update permissions for each channel type
            for (const channel of channelsToUpdate) {
                try {
                    const update = await this.updateChannelPermissions(guild, channel, member, oldRole, newRole, changeType);
                    if (update) {
                        updates.push(update);
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Failed to update permissions for channel ${channel.id}:`, error);
                    // Continue with other channels even if one fails
                }
            }
            // Log aggregate audit trail
            await this.logChannelPermissionUpdates(guild.id, member.user.id, updates, changeType);
            logger_1.logger.info('Completed channel permission updates for role change', {
                guildId: guild.id,
                userId: member.user.id,
                channelsUpdated: updates.length,
                changeType
            });
            return updates;
        }
        catch (error) {
            logger_1.logger.error('Error handling role change channel permissions:', error);
            throw error;
        }
    }
    /**
     * Update permissions for a specific channel based on role change
     */
    async updateChannelPermissions(guild, channel, member, oldRole, newRole, changeType = 'promotion') {
        try {
            const channelType = this.detectChannelType(channel.name);
            const userId = member.user.id;
            // Calculate new permissions based on new role
            const newPermissions = newRole ? this.calculateChannelPermissions(channelType, newRole) : null;
            const oldPermissions = oldRole ? this.calculateChannelPermissions(channelType, oldRole) : null;
            // If no role change affects this channel type, skip
            if (!newPermissions && !oldPermissions) {
                return null;
            }
            const permissionsGranted = [];
            const permissionsRevoked = [];
            // Handle firing (remove all permissions)
            if (changeType === 'fire' || !newRole) {
                if (oldPermissions) {
                    // Remove user from channel permissions
                    await channel.permissionOverwrites.delete(userId);
                    permissionsRevoked.push('all');
                    logger_1.logger.debug(`Removed all permissions for fired user ${userId} from channel ${channel.name}`);
                }
            }
            // Handle hiring, promotion, or demotion
            else if (newPermissions) {
                // Validate new permissions with business rules
                const context = {
                    guildId: guild.id,
                    userId,
                    userRoles: member.roles.cache.map(r => r.id),
                    isGuildOwner: guild.ownerId === userId
                };
                // Check if user should have access to this channel type
                const hasAccess = await this.validateChannelAccess(context, channelType, newRole);
                if (hasAccess) {
                    // Calculate Discord permission flags
                    const allowPermissions = [];
                    const denyPermissions = [];
                    if (newPermissions.view) {
                        allowPermissions.push(discord_js_1.PermissionFlagsBits.ViewChannel);
                        permissionsGranted.push('view');
                    }
                    else {
                        denyPermissions.push(discord_js_1.PermissionFlagsBits.ViewChannel);
                        permissionsRevoked.push('view');
                    }
                    if (newPermissions.send) {
                        allowPermissions.push(discord_js_1.PermissionFlagsBits.SendMessages);
                        permissionsGranted.push('send');
                    }
                    else {
                        denyPermissions.push(discord_js_1.PermissionFlagsBits.SendMessages);
                        permissionsRevoked.push('send');
                    }
                    if (newPermissions.read_history) {
                        allowPermissions.push(discord_js_1.PermissionFlagsBits.ReadMessageHistory);
                        permissionsGranted.push('read_history');
                    }
                    if (newPermissions.manage) {
                        allowPermissions.push(discord_js_1.PermissionFlagsBits.ManageMessages);
                        permissionsGranted.push('manage');
                    }
                    // Apply permission overwrites
                    await channel.permissionOverwrites.edit(userId, {
                        ViewChannel: newPermissions.view || null,
                        SendMessages: newPermissions.send || null,
                        ReadMessageHistory: newPermissions.read_history || null,
                        ManageMessages: newPermissions.manage || null,
                    });
                    logger_1.logger.debug(`Updated permissions for user ${userId} in channel ${channel.name}`, {
                        channelType,
                        newRole,
                        permissions: newPermissions
                    });
                }
                else {
                    // User shouldn't have access, remove permissions
                    await channel.permissionOverwrites.delete(userId);
                    permissionsRevoked.push('all');
                    logger_1.logger.debug(`Removed access for user ${userId} from channel ${channel.name} (insufficient role)`);
                }
            }
            // Return update record if changes were made
            if (permissionsGranted.length > 0 || permissionsRevoked.length > 0) {
                return {
                    channelId: channel.id,
                    channelName: channel.name,
                    updateType: 'role-change',
                    affectedUserId: userId,
                    oldRole: oldRole || undefined,
                    newRole: newRole || undefined,
                    permissionsGranted,
                    permissionsRevoked,
                    timestamp: new Date()
                };
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error(`Error updating channel permissions for ${channel.name}:`, error);
            throw error;
        }
    }
    /**
     * Get all channels that need permission updates for a user
     */
    async getChannelsForPermissionUpdate(guild, userId) {
        const channels = [];
        // Get all text channels and categories
        const allChannels = guild.channels.cache.filter(channel => channel.type === discord_js_1.ChannelType.GuildText || channel.type === discord_js_1.ChannelType.GuildCategory);
        for (const [, channel] of allChannels) {
            const typedChannel = channel;
            // Check if channel has existing permissions for this user or if it's a relevant channel type
            const hasExistingPermissions = typedChannel.permissionOverwrites.cache.has(userId);
            const channelType = this.detectChannelType(typedChannel.name);
            const isRelevantChannel = channelType !== 'unknown';
            if (hasExistingPermissions || isRelevantChannel) {
                channels.push(typedChannel);
            }
        }
        // Also get case channels where user is involved
        const userCases = await this.caseRepository.findCasesByUserId(guild.id, userId);
        for (const userCase of userCases) {
            if (userCase.channelId && userCase.status !== case_1.CaseStatus.CLOSED) {
                const caseChannel = guild.channels.cache.get(userCase.channelId);
                if (caseChannel && !channels.includes(caseChannel)) {
                    channels.push(caseChannel);
                }
            }
        }
        return channels;
    }
    /**
     * Detect channel type based on naming patterns
     */
    detectChannelType(channelName) {
        if (this.CHANNEL_PATTERNS.case.test(channelName))
            return 'case';
        if (this.CHANNEL_PATTERNS.staff.test(channelName))
            return 'staff';
        if (this.CHANNEL_PATTERNS.admin.test(channelName))
            return 'admin';
        if (this.CHANNEL_PATTERNS.legalTeam.test(channelName))
            return 'legal-team';
        return 'unknown';
    }
    /**
     * Calculate permissions for a role in a specific channel type
     */
    calculateChannelPermissions(channelType, role) {
        const typeMatrix = this.PERMISSION_MATRIX[channelType];
        if (!typeMatrix)
            return null;
        const rolePermissions = typeMatrix[role];
        return rolePermissions?.permissions || null;
    }
    /**
     * Validate if user should have access to a channel type based on business rules
     */
    async validateChannelAccess(context, channelType, role) {
        try {
            const typeMatrix = this.PERMISSION_MATRIX[channelType];
            if (!typeMatrix)
                return false;
            const rolePermissions = typeMatrix[role];
            if (!rolePermissions)
                return false;
            // If channel requires a specific permission, validate it
            if (rolePermissions.requiredPermission) {
                const permissionValidation = await this.businessRuleValidationService.validatePermission(context, rolePermissions.requiredPermission);
                return permissionValidation.valid;
            }
            // If channel requires a specific role, check role hierarchy
            if (rolePermissions.requiredRole) {
                const currentRoleLevel = staff_role_1.RoleUtils.getRoleLevel(role);
                const requiredRoleLevel = staff_role_1.RoleUtils.getRoleLevel(rolePermissions.requiredRole);
                return currentRoleLevel >= requiredRoleLevel;
            }
            // Default access for channel type
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error validating channel access:', error);
            return false;
        }
    }
    /**
     * Sync all channel permissions for a guild (maintenance operation)
     */
    async syncGuildChannelPermissions(guild) {
        try {
            logger_1.logger.info(`Starting channel permission sync for guild ${guild.id}`);
            const updates = [];
            // Get all active staff
            const activeStaff = await this.staffRepository.findByGuildId(guild.id);
            const staffMembers = activeStaff.filter(s => s.status === 'active');
            // Process each staff member
            for (const staff of staffMembers) {
                try {
                    const member = await guild.members.fetch(staff.userId);
                    if (member) {
                        const memberUpdates = await this.handleRoleChange(guild, member, undefined, // No old role in sync
                        staff.role, 'promotion');
                        updates.push(...memberUpdates);
                    }
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to sync permissions for staff member ${staff.userId}:`, error);
                }
            }
            logger_1.logger.info(`Completed channel permission sync for guild ${guild.id}`, {
                staffProcessed: staffMembers.length,
                totalUpdates: updates.length
            });
            return updates;
        }
        catch (error) {
            logger_1.logger.error(`Error syncing channel permissions for guild ${guild.id}:`, error);
            throw error;
        }
    }
    /**
     * Log channel permission updates to audit trail
     */
    async logChannelPermissionUpdates(guildId, userId, updates, changeType) {
        try {
            if (updates.length === 0)
                return;
            await this.auditLogRepository.add({
                guildId,
                action: audit_log_1.AuditAction.STAFF_PROMOTED, // Generic action for channel permission changes
                actorId: 'System',
                targetId: userId,
                details: {
                    reason: `Channel permissions updated due to ${changeType}`,
                    metadata: {
                        changeType,
                        channelsAffected: updates.length,
                        channels: updates.map(u => ({
                            channelId: u.channelId,
                            channelName: u.channelName,
                            permissionsGranted: u.permissionsGranted,
                            permissionsRevoked: u.permissionsRevoked
                        }))
                    }
                },
                timestamp: new Date()
            });
            logger_1.logger.debug('Logged channel permission updates to audit trail', {
                guildId,
                userId,
                updatesLogged: updates.length
            });
        }
        catch (error) {
            logger_1.logger.error('Error logging channel permission updates:', error);
        }
    }
}
exports.ChannelPermissionManager = ChannelPermissionManager;
//# sourceMappingURL=channel-permission-manager.js.map