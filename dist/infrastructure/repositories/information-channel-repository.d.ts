import { InformationChannel } from '../../validation';
import { BaseMongoRepository } from './base-mongo-repository';
export declare class InformationChannelRepository extends BaseMongoRepository<InformationChannel> {
    constructor();
    findByChannelId(guildId: string, channelId: string): Promise<InformationChannel | null>;
    findByGuildId(guildId: string): Promise<InformationChannel[]>;
    upsertByChannelId(guildId: string, channelId: string, data: Partial<InformationChannel>): Promise<InformationChannel>;
}
//# sourceMappingURL=information-channel-repository.d.ts.map