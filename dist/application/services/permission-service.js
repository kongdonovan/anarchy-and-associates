"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionService = void 0;
const logger_1 = require("../../infrastructure/logger");
class PermissionService {
    constructor(guildConfigRepository) {
        this.guildConfigRepository = guildConfigRepository;
    }
    async hasActionPermission(context, action) {
        try {
            // Validate context
            if (!context || !context.guildId || !context.userId) {
                logger_1.logger.warn(`Invalid permission context provided for action: ${action}`);
                return false;
            }
            // Guild owner always has all permissions
            if (context.isGuildOwner === true) {
                logger_1.logger.debug(`Permission granted to guild owner for action: ${action}`);
                return true;
            }
            const config = await this.guildConfigRepository.ensureGuildConfig(context.guildId);
            // Check if user has any admin roles (with null-safe check)
            const userRoles = context.userRoles || [];
            const adminRoles = config.adminRoles || [];
            const hasAdminRole = userRoles.some(roleId => adminRoles.includes(roleId));
            // Admin users and admin roles get admin permissions, but still need specific roles for other actions
            const isAdminUser = config.adminUsers && config.adminUsers.includes(context.userId);
            if ((isAdminUser || hasAdminRole) && action === 'admin') {
                logger_1.logger.debug(`Admin permission granted to ${context.userId} for action: ${action}`);
                return true;
            }
            // Check specific action permissions
            const actionRoles = config.permissions[action] || [];
            const hasActionPermission = userRoles.some(roleId => actionRoles.includes(roleId));
            if (hasActionPermission) {
                logger_1.logger.debug(`Permission granted via action role for action: ${action}`);
                return true;
            }
            logger_1.logger.debug(`Permission denied for user ${context.userId} for action: ${action}`);
            return false;
        }
        catch (error) {
            logger_1.logger.error(`Error checking permission for action ${action}:`, error);
            return false;
        }
    }
    async isAdmin(context) {
        try {
            // Validate context
            if (!context || !context.guildId || !context.userId) {
                logger_1.logger.warn(`Invalid permission context provided for admin check`);
                return false;
            }
            // Guild owner is always admin
            if (context.isGuildOwner === true) {
                return true;
            }
            const config = await this.guildConfigRepository.ensureGuildConfig(context.guildId);
            // Check if user is in admin users list
            if (config.adminUsers && config.adminUsers.includes(context.userId)) {
                return true;
            }
            // Check if user has any admin roles (with null-safe check)
            const userRoles = context.userRoles || [];
            const adminRoles = config.adminRoles || [];
            return userRoles.some(roleId => adminRoles.includes(roleId));
        }
        catch (error) {
            logger_1.logger.error(`Error checking admin status:`, error);
            return false;
        }
    }
    async canManageAdmins(context) {
        // Only guild owner or users with admin permission can manage admins
        return (context?.isGuildOwner === true) || await this.hasActionPermission(context, 'admin');
    }
    async canManageConfig(context) {
        // Admin or config permission required
        return await this.isAdmin(context) || await this.hasActionPermission(context, 'config');
    }
    async hasHRPermission(guildId, userId) {
        try {
            // Get user roles from Discord API would be ideal, but for now we'll create a minimal context
            // In a real implementation, this would fetch user roles from Discord
            const context = {
                guildId,
                userId,
                userRoles: [], // This should be populated with actual Discord roles
                isGuildOwner: false, // This should be checked against Discord API
            };
            return await this.isAdmin(context) || await this.hasActionPermission(context, 'hr');
        }
        catch (error) {
            logger_1.logger.error(`Error checking HR permission:`, error);
            return false;
        }
    }
    /**
     * Check HR permission with proper context (preferred method)
     */
    async hasHRPermissionWithContext(context) {
        try {
            return await this.isAdmin(context) || await this.hasActionPermission(context, 'hr');
        }
        catch (error) {
            logger_1.logger.error(`Error checking HR permission:`, error);
            return false;
        }
    }
    async hasRetainerPermission(guildId, userId) {
        try {
            // Get user roles from Discord API would be ideal, but for now we'll create a minimal context
            // In a real implementation, this would fetch user roles from Discord
            const context = {
                guildId,
                userId,
                userRoles: [], // This should be populated with actual Discord roles
                isGuildOwner: false, // This should be checked against Discord API
            };
            return await this.isAdmin(context) || await this.hasActionPermission(context, 'retainer');
        }
        catch (error) {
            logger_1.logger.error(`Error checking retainer permission:`, error);
            return false;
        }
    }
    /**
     * Check retainer permission with proper context (preferred method)
     */
    async hasRetainerPermissionWithContext(context) {
        try {
            return await this.isAdmin(context) || await this.hasActionPermission(context, 'retainer');
        }
        catch (error) {
            logger_1.logger.error(`Error checking retainer permission:`, error);
            return false;
        }
    }
    async getPermissionSummary(context) {
        const isAdmin = await this.isAdmin(context);
        const permissions = {
            admin: await this.hasActionPermission(context, 'admin'),
            hr: await this.hasActionPermission(context, 'hr'),
            case: await this.hasActionPermission(context, 'case'),
            config: await this.hasActionPermission(context, 'config'),
            retainer: await this.hasActionPermission(context, 'retainer'),
            repair: await this.hasActionPermission(context, 'repair'),
        };
        return {
            isAdmin,
            isGuildOwner: context.isGuildOwner || false,
            permissions,
        };
    }
}
exports.PermissionService = PermissionService;
//# sourceMappingURL=permission-service.js.map