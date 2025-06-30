import { BaseMongoRepository } from './base-mongo-repository';
import { GuildConfig } from '../../validation';
export declare class GuildConfigRepository extends BaseMongoRepository<GuildConfig> {
    constructor();
    findByGuildId(guildId: unknown): Promise<GuildConfig | null>;
    createDefaultConfig(guildId: unknown): Promise<GuildConfig>;
    updateConfig(guildId: unknown, updates: unknown): Promise<GuildConfig | null>;
    ensureGuildConfig(guildId: unknown): Promise<GuildConfig>;
    addAdminUser(guildId: unknown, userId: unknown): Promise<GuildConfig | null>;
    removeAdminUser(guildId: unknown, userId: unknown): Promise<GuildConfig | null>;
    addAdminRole(guildId: unknown, roleId: unknown): Promise<GuildConfig | null>;
    removeAdminRole(guildId: unknown, roleId: unknown): Promise<GuildConfig | null>;
    setPermissionRole(guildId: unknown, action: unknown, roleId: unknown): Promise<GuildConfig | null>;
}
//# sourceMappingURL=guild-config-repository.d.ts.map