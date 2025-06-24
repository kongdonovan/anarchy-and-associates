"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseCounterRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const logger_1 = require("../logger");
class CaseCounterRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('case_counters');
    }
    async getNextCaseNumber(guildId) {
        const currentYear = new Date().getFullYear();
        try {
            // Try to find existing counter for this guild and year
            let counter = await this.findOne({ guildId, year: currentYear });
            if (!counter) {
                // Create new counter for this year
                counter = await this.add({
                    guildId,
                    year: currentYear,
                    count: 1
                });
                return 1;
            }
            // Increment the counter atomically
            const updatedCounter = await this.update(counter._id.toString(), {
                count: counter.count + 1
            });
            if (!updatedCounter) {
                throw new Error('Failed to increment case counter');
            }
            logger_1.logger.debug('Case counter incremented', {
                guildId,
                year: currentYear,
                newCount: updatedCounter.count
            });
            return updatedCounter.count;
        }
        catch (error) {
            logger_1.logger.error('Error getting next case number:', error);
            throw error;
        }
    }
    async getCurrentCount(guildId, year) {
        const targetYear = year || new Date().getFullYear();
        const counter = await this.findOne({ guildId, year: targetYear });
        return counter?.count || 0;
    }
    async resetYearlyCounter(guildId, year) {
        try {
            const counter = await this.findOne({ guildId, year });
            if (counter) {
                await this.update(counter._id.toString(), { count: 0 });
            }
            else {
                await this.add({ guildId, year, count: 0 });
            }
            logger_1.logger.info('Case counter reset for year', { guildId, year });
        }
        catch (error) {
            logger_1.logger.error('Error resetting yearly counter:', error);
            throw error;
        }
    }
}
exports.CaseCounterRepository = CaseCounterRepository;
//# sourceMappingURL=case-counter-repository.js.map