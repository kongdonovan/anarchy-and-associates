"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildConfigRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const logger_1 = require("../logger");
class GuildConfigRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('guild_configs');
    }
    async findByGuildId(guildId) {
        try {
            return await this.findOne({ guildId });
        }
        catch (error) {
            logger_1.logger.error(`Error finding guild config for guild ${guildId}:`, error);
            throw error;
        }
    }
    async createDefaultConfig(guildId) {
        const defaultConfig = {
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
        }
        catch (error) {
            logger_1.logger.error(`Error creating default config for guild ${guildId}:`, error);
            throw error;
        }
    }
    async updateConfig(guildId, updates) {
        try {
            const existing = await this.findByGuildId(guildId);
            if (!existing) {
                return null;
            }
            return await this.update(existing._id.toHexString(), updates);
        }
        catch (error) {
            logger_1.logger.error(`Error updating config for guild ${guildId}:`, error);
            throw error;
        }
    }
    async ensureGuildConfig(guildId) {
        try {
            let config = await this.findByGuildId(guildId);
            if (!config) {
                config = await this.createDefaultConfig(guildId);
                logger_1.logger.info(`Created default configuration for guild ${guildId}`);
            }
            return config;
        }
        catch (error) {
            logger_1.logger.error(`Error ensuring guild config for guild ${guildId}:`, error);
            throw error;
        }
    }
    async addAdminUser(guildId, userId) {
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
        }
        catch (error) {
            logger_1.logger.error(`Error adding admin user ${userId} to guild ${guildId}:`, error);
            throw error;
        }
    }
    async removeAdminUser(guildId, userId) {
        try {
            const config = await this.findByGuildId(guildId);
            if (!config) {
                return null;
            }
            const adminUsers = config.adminUsers.filter(id => id !== userId);
            return await this.updateConfig(guildId, { adminUsers });
        }
        catch (error) {
            logger_1.logger.error(`Error removing admin user ${userId} from guild ${guildId}:`, error);
            throw error;
        }
    }
    async addAdminRole(guildId, roleId) {
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
        }
        catch (error) {
            logger_1.logger.error(`Error adding admin role ${roleId} to guild ${guildId}:`, error);
            throw error;
        }
    }
    async removeAdminRole(guildId, roleId) {
        try {
            const config = await this.findByGuildId(guildId);
            if (!config) {
                return null;
            }
            const adminRoles = config.adminRoles.filter(id => id !== roleId);
            return await this.updateConfig(guildId, { adminRoles });
        }
        catch (error) {
            logger_1.logger.error(`Error removing admin role ${roleId} from guild ${guildId}:`, error);
            throw error;
        }
    }
    async setPermissionRole(guildId, action, roleId) {
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
        }
        catch (error) {
            logger_1.logger.error(`Error setting permission role ${roleId} for action ${action} in guild ${guildId}:`, error);
            throw error;
        }
    }
}
exports.GuildConfigRepository = GuildConfigRepository;
//# sourceMappingURL=guild-config-repository.js.map