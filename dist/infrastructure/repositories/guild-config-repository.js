"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildConfigRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const logger_1 = require("../logger");
const validation_1 = require("../../validation");
class GuildConfigRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('guild_configs');
    }
    async findByGuildId(guildId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            return await this.findOne({ guildId: validatedGuildId });
        }
        catch (error) {
            logger_1.logger.error(`Error finding guild config for guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async createDefaultConfig(guildId) {
        const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
        const defaultConfig = {
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
        }
        catch (error) {
            logger_1.logger.error(`Error creating default config for guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async updateConfig(guildId, updates) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            // Create a partial schema for GuildConfig updates
            const GuildConfigUpdateSchema = validation_1.z.object({
                feedbackChannelId: validation_1.DiscordSnowflakeSchema.optional(),
                retainerChannelId: validation_1.DiscordSnowflakeSchema.optional(),
                caseReviewCategoryId: validation_1.DiscordSnowflakeSchema.optional(),
                caseArchiveCategoryId: validation_1.DiscordSnowflakeSchema.optional(),
                modlogChannelId: validation_1.DiscordSnowflakeSchema.optional(),
                applicationChannelId: validation_1.DiscordSnowflakeSchema.optional(),
                clientRoleId: validation_1.DiscordSnowflakeSchema.optional(),
                permissions: validation_1.z.record(validation_1.z.array(validation_1.DiscordSnowflakeSchema)).optional(),
                adminRoles: validation_1.z.array(validation_1.DiscordSnowflakeSchema).optional(),
                adminUsers: validation_1.z.array(validation_1.DiscordSnowflakeSchema).optional(),
            }).partial();
            const validatedUpdates = validation_1.ValidationHelpers.validateOrThrow(GuildConfigUpdateSchema, updates, 'Guild config updates');
            const existing = await this.findByGuildId(validatedGuildId);
            if (!existing) {
                return null;
            }
            return await this.update(existing._id, validatedUpdates);
        }
        catch (error) {
            logger_1.logger.error(`Error updating config for guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async ensureGuildConfig(guildId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            let config = await this.findByGuildId(validatedGuildId);
            if (!config) {
                config = await this.createDefaultConfig(validatedGuildId);
                logger_1.logger.info(`Created default configuration for guild ${validatedGuildId}`);
            }
            return config;
        }
        catch (error) {
            logger_1.logger.error(`Error ensuring guild config for guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async addAdminUser(guildId, userId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedUserId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, userId, 'User ID');
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
        }
        catch (error) {
            logger_1.logger.error(`Error adding admin user ${String(userId)} to guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async removeAdminUser(guildId, userId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedUserId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, userId, 'User ID');
            const config = await this.findByGuildId(validatedGuildId);
            if (!config) {
                return null;
            }
            const adminUsers = config.adminUsers.filter(id => id !== validatedUserId);
            return await this.updateConfig(validatedGuildId, { adminUsers });
        }
        catch (error) {
            logger_1.logger.error(`Error removing admin user ${String(userId)} from guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async addAdminRole(guildId, roleId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedRoleId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, roleId, 'Role ID');
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
        }
        catch (error) {
            logger_1.logger.error(`Error adding admin role ${String(roleId)} to guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async removeAdminRole(guildId, roleId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedRoleId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, roleId, 'Role ID');
            const config = await this.findByGuildId(validatedGuildId);
            if (!config) {
                return null;
            }
            const adminRoles = config.adminRoles.filter(id => id !== validatedRoleId);
            return await this.updateConfig(validatedGuildId, { adminRoles });
        }
        catch (error) {
            logger_1.logger.error(`Error removing admin role ${String(roleId)} from guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async setPermissionRole(guildId, action, roleId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedAction = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.enum(['admin', 'senior-staff', 'case', 'config', 'lawyer', 'lead-attorney', 'repair']), action, 'Permission action');
            const validatedRoleId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, roleId, 'Role ID');
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
        }
        catch (error) {
            logger_1.logger.error(`Error setting permission role ${String(roleId)} for action ${String(action)} in guild ${String(guildId)}:`, error);
            throw error;
        }
    }
}
exports.GuildConfigRepository = GuildConfigRepository;
//# sourceMappingURL=guild-config-repository.js.map