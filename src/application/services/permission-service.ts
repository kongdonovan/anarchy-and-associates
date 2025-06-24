import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { GuildConfig } from '../../domain/entities/guild-config';
import { logger } from '../../infrastructure/logger';

export type PermissionAction = keyof GuildConfig['permissions'];

export interface PermissionContext {
  guildId: string;
  userId: string;
  userRoles: string[];
  isGuildOwner?: boolean;
}

export class PermissionService {
  private guildConfigRepository: GuildConfigRepository;

  constructor(guildConfigRepository: GuildConfigRepository) {
    this.guildConfigRepository = guildConfigRepository;
  }

  public async hasActionPermission(
    context: PermissionContext,
    action: PermissionAction
  ): Promise<boolean> {
    try {
      // Guild owner always has all permissions
      if (context.isGuildOwner) {
        logger.debug(`Permission granted to guild owner for action: ${action}`);
        return true;
      }

      const config = await this.guildConfigRepository.ensureGuildConfig(context.guildId);

      // Check if user is in admin users list
      if (config.adminUsers.includes(context.userId)) {
        logger.debug(`Permission granted to admin user ${context.userId} for action: ${action}`);
        return true;
      }

      // Check if user has any admin roles
      const hasAdminRole = context.userRoles.some(roleId => 
        config.adminRoles.includes(roleId)
      );
      if (hasAdminRole) {
        logger.debug(`Permission granted via admin role for action: ${action}`);
        return true;
      }

      // Check specific action permissions
      const actionRoles = config.permissions[action];
      const hasActionPermission = context.userRoles.some(roleId => 
        actionRoles.includes(roleId)
      );

      if (hasActionPermission) {
        logger.debug(`Permission granted via action role for action: ${action}`);
        return true;
      }

      logger.debug(`Permission denied for user ${context.userId} for action: ${action}`);
      return false;
    } catch (error) {
      logger.error(`Error checking permission for action ${action}:`, error);
      return false;
    }
  }

  public async isAdmin(context: PermissionContext): Promise<boolean> {
    try {
      // Guild owner is always admin
      if (context.isGuildOwner) {
        return true;
      }

      const config = await this.guildConfigRepository.ensureGuildConfig(context.guildId);

      // Check if user is in admin users list
      if (config.adminUsers.includes(context.userId)) {
        return true;
      }

      // Check if user has any admin roles
      return context.userRoles.some(roleId => 
        config.adminRoles.includes(roleId)
      );
    } catch (error) {
      logger.error(`Error checking admin status:`, error);
      return false;
    }
  }

  public async canManageAdmins(context: PermissionContext): Promise<boolean> {
    // Only guild owner or users with admin permission can manage admins
    return context.isGuildOwner || await this.hasActionPermission(context, 'admin');
  }

  public async canManageConfig(context: PermissionContext): Promise<boolean> {
    // Admin or config permission required
    return await this.isAdmin(context) || await this.hasActionPermission(context, 'config');
  }

  public async hasHRPermission(guildId: string, userId: string): Promise<boolean> {
    try {
      // Get user roles from Discord API would be ideal, but for now we'll create a minimal context
      // In a real implementation, this would fetch user roles from Discord
      const context: PermissionContext = {
        guildId,
        userId,
        userRoles: [], // This should be populated with actual Discord roles
        isGuildOwner: false, // This should be checked against Discord API
      };

      return await this.isAdmin(context) || await this.hasActionPermission(context, 'hr');
    } catch (error) {
      logger.error(`Error checking HR permission:`, error);
      return false;
    }
  }

  public async hasRetainerPermission(guildId: string, userId: string): Promise<boolean> {
    try {
      // Get user roles from Discord API would be ideal, but for now we'll create a minimal context
      // In a real implementation, this would fetch user roles from Discord
      const context: PermissionContext = {
        guildId,
        userId,
        userRoles: [], // This should be populated with actual Discord roles
        isGuildOwner: false, // This should be checked against Discord API
      };

      return await this.isAdmin(context) || await this.hasActionPermission(context, 'retainer');
    } catch (error) {
      logger.error(`Error checking retainer permission:`, error);
      return false;
    }
  }

  public async getPermissionSummary(context: PermissionContext): Promise<{
    isAdmin: boolean;
    isGuildOwner: boolean;
    permissions: Record<PermissionAction, boolean>;
  }> {
    const isAdmin = await this.isAdmin(context);
    const permissions: Record<PermissionAction, boolean> = {
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