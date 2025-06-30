import { CaseCounter } from '../../validation';
import { BaseMongoRepository } from './base-mongo-repository';
import { logger } from '../logger';

export class CaseCounterRepository extends BaseMongoRepository<CaseCounter> {
  constructor() {
    super('case_counters');
  }

  public async getNextCaseNumber(guildId: string): Promise<number> {
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
      const updatedCounter = await this.update(counter._id!.toString(), {
        count: counter.count + 1
      });

      if (!updatedCounter) {
        throw new Error('Failed to increment case counter');
      }

      logger.debug('Case counter incremented', {
        guildId,
        year: currentYear,
        newCount: updatedCounter.count
      });

      return updatedCounter.count;
    } catch (error) {
      logger.error('Error getting next case number:', error);
      throw error;
    }
  }

  public async getCurrentCount(guildId: string, year?: number): Promise<number> {
    const targetYear = year || new Date().getFullYear();
    const counter = await this.findOne({ guildId, year: targetYear });
    return counter?.count || 0;
  }

  public async resetYearlyCounter(guildId: string, year: number): Promise<void> {
    try {
      const counter = await this.findOne({ guildId, year });
      
      if (counter) {
        await this.update(counter._id!.toString(), { count: 0 });
      } else {
        await this.add({ guildId, year, count: 0 });
      }

      logger.info('Case counter reset for year', { guildId, year });
    } catch (error) {
      logger.error('Error resetting yearly counter:', error);
      throw error;
    }
  }
}