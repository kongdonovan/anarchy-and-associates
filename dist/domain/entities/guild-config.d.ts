import { BaseEntity } from './base';
export interface GuildConfig extends BaseEntity {
    guildId: string;
    feedbackChannelId?: string;
    retainerChannelId?: string;
    caseReviewCategoryId?: string;
    caseArchiveCategoryId?: string;
    modlogChannelId?: string;
    applicationChannelId?: string;
    clientRoleId?: string;
    permissions: {
        admin: string[];
        'senior-staff': string[];
        case: string[];
        config: string[];
        lawyer: string[];
        'lead-attorney': string[];
        repair: string[];
    };
    adminRoles: string[];
    adminUsers: string[];
    channelCleanupConfig?: {
        scanInterval: number;
        inactivityThreshold: number;
        archiveThreshold: number;
        deleteThreshold: number;
        batchSize: number;
        enableAutoCleanup: boolean;
        notificationChannelId?: string;
        excludedCategories: string[];
        excludedChannels: string[];
    };
}
//# sourceMappingURL=guild-config.d.ts.map