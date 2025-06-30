import { BaseEntity } from './base';
export interface InformationChannel extends BaseEntity {
    guildId: string;
    channelId: string;
    messageId?: string;
    title: string;
    content: string;
    color?: number;
    thumbnailUrl?: string;
    imageUrl?: string;
    footer?: string;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    lastUpdatedBy: string;
    lastUpdatedAt: Date;
}
//# sourceMappingURL=information-channel.d.ts.map