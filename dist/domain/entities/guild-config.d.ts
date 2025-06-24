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
        hr: string[];
        case: string[];
        config: string[];
        retainer: string[];
        repair: string[];
    };
    adminRoles: string[];
    adminUsers: string[];
}
//# sourceMappingURL=guild-config.d.ts.map