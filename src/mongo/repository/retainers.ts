import { BaseRepository } from "./base.js";
import type { Retainer } from "../../types/types.d.js";

export class RetainerRepository extends BaseRepository<Retainer> {
  constructor() {
    super("retainers");
  }

  async addRetainer(retainer: Omit<Retainer, "_id">) {
    return this.insert(retainer);
  }

  async getRetainersByUser(userId: string) {
    return this.findByFilters({ clientId: userId });
  }

  /**
   * Find an active retainer for a client in a guild (optionally by lawyer)
   */
  async getActiveRetainer(clientId: string, guildId?: string) {
    const filter: any = { clientId, accepted: true };
    if (guildId) filter.guildId = guildId;
    const results = await this.findByFilters(filter);
    return results[0] || null;
  }

  /**
   * Sever (soft delete) a retainer by client (and optionally guild)
   */
  async severRetainer(clientId: string, guildId?: string) {
    const filter: any = { clientId, accepted: true };
    if (guildId) filter.guildId = guildId;
    const retainers = await this.findByFilters(filter);
    for (const retainer of retainers) {
      await this.update(retainer._id, { accepted: false });
    }
    return retainers.length;
  }

  /**
   * Remove (delete) all active retainers for a user in a guild
   */
  async removeRetainer(clientId: string, guildId?: string) {
    const filter: any = { clientId, accepted: true };
    if (guildId) filter.guildId = guildId;
    return this.deleteByFilters(filter);
  }
}
