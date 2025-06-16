import { RetainerRepository } from "../mongo/repository/retainers.js";
import type { Retainer } from "../types/types.d.js";

const retainerRepo = new RetainerRepository();

export class RetainerService {
  /**
   * Check if a user has an active retainer in a guild
   */
  static async hasActiveRetainer(clientId: string, guildId?: string) {
    return !!(await retainerRepo.getActiveRetainer(clientId, guildId));
  }

  /**
   * Add a new retainer if none exists for this user/guild
   */
  static async addRetainer(retainer: Omit<Retainer, "_id"> & { guildId?: string }) {
    if (await this.hasActiveRetainer(retainer.clientId, retainer.guildId)) {
      throw new Error("User already has an active retainer agreement.");
    }
    return retainerRepo.addRetainer(retainer);
  }

  /**
   * Sever all active retainers for a user in a guild
   */
  static async severRetainer(clientId: string, guildId?: string) {
    return retainerRepo.severRetainer(clientId, guildId);
  }

  /**
   * Remove all active retainers for a user in a guild
   */
  static async removeRetainer(clientId: string, guildId?: string) {
    return retainerRepo.removeRetainer(clientId, guildId);
  }

  /**
   * Get all active retainers in a guild
   */
  static async getActiveRetainersInGuild(guildId: string) {
    return retainerRepo.findByFilters({ guildId, accepted: true });
  }

  /**
   * Get all retainers for a client in a guild
   */
  static async getRetainersByClient(clientId: string, guildId?: string) {
    const filter: any = { clientId };
    if (guildId) filter.guildId = guildId;
    return retainerRepo.findByFilters(filter);
  }
}
