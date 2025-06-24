import { BaseMongoRepository } from './base-mongo-repository';
import { GuildConfig } from '../../domain/entities/guild-config';
import { logger } from '../logger';

export class GuildConfigRepository extends BaseMongoRepository<GuildConfig> {
  constructor() {
    super('guild_configs');
  }

  public async findByGuildId(guildId: string): Promise<GuildConfig | null> {
    try {
      return await this.findOne({ guildId });
    } catch (error) {
      logger.error(`Error finding guild config for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async createDefaultConfig(guildId: string): Promise<GuildConfig> {
    const defaultConfig: Omit<GuildConfig, '_id' | 'createdAt' | 'updatedAt'> = {
      guildId,
      feedbackChannelId: undefined,
      retainerChannelId: undefined,
      caseReviewCategoryId: undefined,
      caseArchiveCategoryId: undefined,
      modlogChannelId: undefined,
      applicationChannelId: undefined,
      clientRoleId: undefined,
      permissions: {
        admin: [],
        hr: [],
        case: [],
        config: [],
        retainer: [],
        repair: [],
      },
      adminRoles: [],
      adminUsers: [],
    };

    try {
      return await this.add(defaultConfig);
    } catch (error) {
      logger.error(`Error creating default config for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async updateConfig(
    guildId: string,
    updates: Partial<Omit<GuildConfig, '_id' | 'guildId' | 'createdAt' | 'updatedAt'>>
  ): Promise<GuildConfig | null> {
    try {
      const existing = await this.findByGuildId(guildId);
      if (!existing) {
        return null;
      }

      return await this.update(existing._id!.toHexString(), updates);
    } catch (error) {
      logger.error(`Error updating config for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async ensureGuildConfig(guildId: string): Promise<GuildConfig> {
    try {
      let config = await this.findByGuildId(guildId);
      if (!config) {
        config = await this.createDefaultConfig(guildId);
        logger.info(`Created default configuration for guild ${guildId}`);
      }
      return config;
    } catch (error) {
      logger.error(`Error ensuring guild config for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async addAdminUser(guildId: string, userId: string): Promise<GuildConfig | null> {
    try {
      const config = await this.findByGuildId(guildId);
      if (!config) {
        return null;
      }

      const adminUsers = [...config.adminUsers];
      if (!adminUsers.includes(userId)) {
        adminUsers.push(userId);
        return await this.updateConfig(guildId, { adminUsers });
      }

      return config;
    } catch (error) {
      logger.error(`Error adding admin user ${userId} to guild ${guildId}:`, error);
      throw error;
    }
  }

  public async removeAdminUser(guildId: string, userId: string): Promise<GuildConfig | null> {
    try {
      const config = await this.findByGuildId(guildId);
      if (!config) {
        return null;
      }

      const adminUsers = config.adminUsers.filter(id => id !== userId);
      return await this.updateConfig(guildId, { adminUsers });
    } catch (error) {
      logger.error(`Error removing admin user ${userId} from guild ${guildId}:`, error);
      throw error;
    }
  }

  public async addAdminRole(guildId: string, roleId: string): Promise<GuildConfig | null> {
    try {
      const config = await this.findByGuildId(guildId);
      if (!config) {
        return null;
      }

      const adminRoles = [...config.adminRoles];
      if (!adminRoles.includes(roleId)) {
        adminRoles.push(roleId);
        return await this.updateConfig(guildId, { adminRoles });
      }

      return config;
    } catch (error) {
      logger.error(`Error adding admin role ${roleId} to guild ${guildId}:`, error);
      throw error;
    }
  }

  public async removeAdminRole(guildId: string, roleId: string): Promise<GuildConfig | null> {
    try {
      const config = await this.findByGuildId(guildId);
      if (!config) {
        return null;
      }

      const adminRoles = config.adminRoles.filter(id => id !== roleId);
      return await this.updateConfig(guildId, { adminRoles });
    } catch (error) {
      logger.error(`Error removing admin role ${roleId} from guild ${guildId}:`, error);
      throw error;
    }
  }

  public async setPermissionRole(
    guildId: string,
    action: keyof GuildConfig['permissions'],
    roleId: string
  ): Promise<GuildConfig | null> {
    try {
      const config = await this.findByGuildId(guildId);
      if (!config) {
        return null;
      }

      const permissions = { ...config.permissions };
      if (!permissions[action].includes(roleId)) {
        permissions[action].push(roleId);
        return await this.updateConfig(guildId, { permissions });
      }

      return config;
    } catch (error) {
      logger.error(`Error setting permission role ${roleId} for action ${action} in guild ${guildId}:`, error);
      throw error;
    }
  }
}