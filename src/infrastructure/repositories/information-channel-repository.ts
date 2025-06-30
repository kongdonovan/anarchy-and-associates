import { InformationChannel } from '../../validation';
import { BaseMongoRepository } from './base-mongo-repository';

export class InformationChannelRepository extends BaseMongoRepository<InformationChannel> {
  constructor() {
    // BaseMongoRepository handles database connection internally
    super('informationChannels');
  }

  async findByChannelId(guildId: string, channelId: string): Promise<InformationChannel | null> {
    const doc = await this.collection.findOne({ guildId, channelId });
    return this.fromMongoDoc(doc);
  }

  async findByGuildId(guildId: string): Promise<InformationChannel[]> {
    const docs = await this.collection.find({ guildId }).toArray();
    return docs.map(doc => this.fromMongoDoc(doc)).filter(channel => channel !== null) as InformationChannel[];
  }

  async upsertByChannelId(
    guildId: string, 
    channelId: string, 
    data: Partial<InformationChannel>
  ): Promise<InformationChannel> {
    const now = new Date();
    const update = {
      ...data,
      guildId,
      channelId,
      lastUpdatedAt: now,
      updatedAt: now
    };

    // Convert to MongoDB document format, removing _id if present
    const mongoUpdate = this.toMongoDoc(update);
    delete mongoUpdate._id;

    const result = await this.collection.findOneAndUpdate(
      { guildId, channelId },
      { 
        $set: mongoUpdate,
        $setOnInsert: { createdAt: now }
      },
      { 
        upsert: true, 
        returnDocument: 'after' 
      }
    );

    if (!result) {
      throw new Error('Failed to upsert information channel');
    }

    const converted = this.fromMongoDoc(result);
    if (!converted) {
      throw new Error('Failed to convert information channel');
    }
    
    return converted;
  }
}