import { BaseMongoRepository } from './base-mongo-repository';
import { GuildConfig } from '../../domain/entities/guild-config';
export declare class GuildConfigRepository extends BaseMongoRepository<GuildConfig> {
    constructor();
    findByGuildId(guildId: string): Promise<GuildConfig | null>;
    createDefaultConfig(guildId: string): Promise<GuildConfig>;
    updateConfig(guildId: string, updates: Partial<Omit<GuildConfig, '_id' | 'guildId' | 'createdAt' | 'updatedAt'>>): Promise<GuildConfig | null>;
    ensureGuildConfig(guildId: string): Promise<GuildConfig>;
    addAdminUser(guildId: string, userId: string): Promise<GuildConfig | null>;
    removeAdminUser(guildId: string, userId: string): Promise<GuildConfig | null>;
    addAdminRole(guildId: string, roleId: string): Promise<GuildConfig | null>;
    removeAdminRole(guildId: string, roleId: string): Promise<GuildConfig | null>;
    setPermissionRole(guildId: string, action: keyof GuildConfig['permissions'], roleId: string): Promise<GuildConfig | null>;
}
//# sourceMappingURL=guild-config-repository.d.ts.map