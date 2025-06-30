/**
 * Anarchy & Associates Discord server setup configuration.
 * Edit as needed for your organization.
 * @module config/anarchy-server-config
 */
import { ChannelType } from 'discord.js';
import { JobQuestion } from '../domain/entities/job';
export interface AnarchyServerConfig {
    categories: Array<{
        name: string;
        channels: Array<{
            name: string;
            type: ChannelType;
        }>;
    }>;
    roles: Array<{
        name: string;
        color: string;
        permissions: bigint[];
        hoist: boolean;
        mentionable: boolean;
        maxCount?: number;
    }>;
    defaultJobs: Array<{
        title: string;
        description: string;
        roleName: string;
        isOpenByDefault: boolean;
        autoCreateOnSetup: boolean;
        customQuestions: JobQuestion[];
    }>;
}
export declare const ANARCHY_SERVER_CONFIG: AnarchyServerConfig;
/**
 * Default permission actions to assign to each role during server setup.
 * Key: role name, Value: array of permission actions
 */
export declare const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]>;
/**
 * Maps GuildConfig keys to logical channel/category names for auto-setup.
 * Change this mapping to update which channels/categories are used for each config key.
 */
export declare const DEFAULT_CHANNEL_MAPPINGS: Record<string, {
    name: string;
    type: 'GUILD_TEXT' | 'GUILD_CATEGORY';
}>;
/**
 * Category permission configurations for server setup
 * Defines how each category should be configured for different user groups
 */
export declare const CATEGORY_PERMISSIONS: {
    Information: {
        everyone: {
            allow: bigint[];
            deny: bigint[];
        };
        staff: {
            allow: bigint[];
        };
    };
    Lobby: {
        everyone: {
            allow: bigint[];
            deny: never[];
        };
    };
    'Legal Team': {
        everyone: {
            deny: bigint[];
        };
        legalRoles: string[];
    };
    Staff: {
        everyone: {
            deny: bigint[];
        };
        staffRoles: string[];
    };
    Administration: {
        everyone: {
            deny: bigint[];
        };
        adminRoles: string[];
    };
    'Case Reviews': {
        everyone: {
            deny: bigint[];
        };
    };
    'Case Archives': {
        everyone: {
            deny: bigint[];
        };
        archiveViewRoles: string[];
    };
};
//# sourceMappingURL=server-setup.config.d.ts.map