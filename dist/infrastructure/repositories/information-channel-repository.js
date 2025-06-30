"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InformationChannelRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
class InformationChannelRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        // BaseMongoRepository handles database connection internally
        super('informationChannels');
    }
    async findByChannelId(guildId, channelId) {
        const doc = await this.collection.findOne({ guildId, channelId });
        return this.fromMongoDoc(doc);
    }
    async findByGuildId(guildId) {
        const docs = await this.collection.find({ guildId }).toArray();
        return docs.map(doc => this.fromMongoDoc(doc)).filter(channel => channel !== null);
    }
    async upsertByChannelId(guildId, channelId, data) {
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
        const result = await this.collection.findOneAndUpdate({ guildId, channelId }, {
            $set: mongoUpdate,
            $setOnInsert: { createdAt: now }
        }, {
            upsert: true,
            returnDocument: 'after'
        });
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
exports.InformationChannelRepository = InformationChannelRepository;
//# sourceMappingURL=information-channel-repository.js.map