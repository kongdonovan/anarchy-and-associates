import { BaseMongoRepository } from './base-mongo-repository';
import { logger } from '../logger';
import {
  GuildConfig,
  ValidationHelpers,
  DiscordSnowflakeSchema,
  z
} from '../../validation';

export class GuildConfigRepository extends BaseMongoRepository<GuildConfig> {
  constructor() {
    super('guild_configs');
  }

  public async findByGuildId(guildId: unknown): Promise<GuildConfig | null> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      return await this.findOne({ guildId: validatedGuildId });
    } catch (error) {
      logger.error(`Error finding guild config for guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async createDefaultConfig(guildId: unknown): Promise<GuildConfig> {
    const validatedGuildId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      guildId,
      'Guild ID'
    );
    const defaultConfig: Omit<GuildConfig, '_id' | 'createdAt' | 'updatedAt'> = {
      guildId: validatedGuildId,
      feedbackChannelId: undefined,
      retainerChannelId: undefined,
      caseReviewCategoryId: undefined,
      caseArchiveCategoryId: undefined,
      modlogChannelId: undefined,
      applicationChannelId: undefined,
      clientRoleId: undefined,
      permissions: {
        admin: [],
        'senior-staff': [],
        case: [],
        config: [],
        lawyer: [],
        'lead-attorney': [],
        repair: [],
      },
      adminRoles: [],
      adminUsers: [],
    };

    try {
      return await this.add(defaultConfig);
    } catch (error) {
      logger.error(`Error creating default config for guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async updateConfig(
    guildId: unknown,
    updates: unknown
  ): Promise<GuildConfig | null> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      
      // Create a partial schema for GuildConfig updates
      const GuildConfigUpdateSchema = z.object({
        feedbackChannelId: DiscordSnowflakeSchema.optional(),
        retainerChannelId: DiscordSnowflakeSchema.optional(),
        caseReviewCategoryId: DiscordSnowflakeSchema.optional(),
        caseArchiveCategoryId: DiscordSnowflakeSchema.optional(),
        modlogChannelId: DiscordSnowflakeSchema.optional(),
        applicationChannelId: DiscordSnowflakeSchema.optional(),
        clientRoleId: DiscordSnowflakeSchema.optional(),
        permissions: z.record(z.array(DiscordSnowflakeSchema)).optional(),
        adminRoles: z.array(DiscordSnowflakeSchema).optional(),
        adminUsers: z.array(DiscordSnowflakeSchema).optional(),
      }).partial();
      
      const validatedUpdates = ValidationHelpers.validateOrThrow(
        GuildConfigUpdateSchema,
        updates,
        'Guild config updates'
      );
      
      const existing = await this.findByGuildId(validatedGuildId);
      if (!existing) {
        return null;
      }

      return await this.update(existing._id!, validatedUpdates as Partial<GuildConfig>);
    } catch (error) {
      logger.error(`Error updating config for guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async ensureGuildConfig(guildId: unknown): Promise<GuildConfig> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      let config = await this.findByGuildId(validatedGuildId);
      if (!config) {
        config = await this.createDefaultConfig(validatedGuildId);
        logger.info(`Created default configuration for guild ${validatedGuildId}`);
      }
      return config;
    } catch (error) {
      logger.error(`Error ensuring guild config for guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async addAdminUser(guildId: unknown, userId: unknown): Promise<GuildConfig | null> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedUserId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        userId,
        'User ID'
      );
      const config = await this.findByGuildId(validatedGuildId);
      if (!config) {
        return null;
      }

      const adminUsers = [...config.adminUsers];
      if (!adminUsers.includes(validatedUserId)) {
        adminUsers.push(validatedUserId);
        return await this.updateConfig(validatedGuildId, { adminUsers });
      }

      return config;
    } catch (error) {
      logger.error(`Error adding admin user ${String(userId)} to guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async removeAdminUser(guildId: unknown, userId: unknown): Promise<GuildConfig | null> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedUserId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        userId,
        'User ID'
      );
      const config = await this.findByGuildId(validatedGuildId);
      if (!config) {
        return null;
      }

      const adminUsers = config.adminUsers.filter(id => id !== validatedUserId);
      return await this.updateConfig(validatedGuildId, { adminUsers });
    } catch (error) {
      logger.error(`Error removing admin user ${String(userId)} from guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async addAdminRole(guildId: unknown, roleId: unknown): Promise<GuildConfig | null> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedRoleId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        roleId,
        'Role ID'
      );
      const config = await this.findByGuildId(validatedGuildId);
      if (!config) {
        return null;
      }

      const adminRoles = [...config.adminRoles];
      if (!adminRoles.includes(validatedRoleId)) {
        adminRoles.push(validatedRoleId);
        return await this.updateConfig(validatedGuildId, { adminRoles });
      }

      return config;
    } catch (error) {
      logger.error(`Error adding admin role ${String(roleId)} to guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async removeAdminRole(guildId: unknown, roleId: unknown): Promise<GuildConfig | null> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedRoleId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        roleId,
        'Role ID'
      );
      const config = await this.findByGuildId(validatedGuildId);
      if (!config) {
        return null;
      }

      const adminRoles = config.adminRoles.filter(id => id !== validatedRoleId);
      return await this.updateConfig(validatedGuildId, { adminRoles });
    } catch (error) {
      logger.error(`Error removing admin role ${String(roleId)} from guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async setPermissionRole(
    guildId: unknown,
    action: unknown,
    roleId: unknown
  ): Promise<GuildConfig | null> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedAction = ValidationHelpers.validateOrThrow(
        z.enum(['admin', 'senior-staff', 'case', 'config', 'lawyer', 'lead-attorney', 'repair']),
        action,
        'Permission action'
      );
      const validatedRoleId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        roleId,
        'Role ID'
      );
      const config = await this.findByGuildId(validatedGuildId);
      if (!config) {
        return null;
      }

      const permissions = { ...config.permissions };
      
      // Ensure the permission action exists and is an array
      if (!permissions[validatedAction]) {
        permissions[validatedAction] = [];
      }
      
      if (!permissions[validatedAction].includes(validatedRoleId)) {
        permissions[validatedAction].push(validatedRoleId);
        return await this.updateConfig(validatedGuildId, { permissions });
      }

      return config;
    } catch (error) {
      logger.error(`Error setting permission role ${String(roleId)} for action ${String(action)} in guild ${String(guildId)}:`, error);
      throw error;
    }
  }
}