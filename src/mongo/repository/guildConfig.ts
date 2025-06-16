import type { GuildConfig } from "../../types/types.d.js";
import { BaseRepository } from "./base.js";

/**
 * Repository for GuildConfig documents.
 */
export class GuildConfigRepository extends BaseRepository<GuildConfig> {
  constructor() {
    super("guildConfig");
  }

  /**
   * Get config for a guild
   */
  async getConfig(guildId: string) {
    const configs = await this.findByFilters({ guildId });
    return configs[0] ?? null;
  }

  /**
   * Set config for a guild (upsert)
   */
  async setConfig(guildId: string, config: Partial<GuildConfig>) {
    const existing = await this.getConfig(guildId);
    if (existing) {
      return this.update(existing._id as string, config);
    }
    return this.insert({ guildId, ...config } as GuildConfig);
  }

  /**
   * Add an admin user
   */
  async addAdmin(guildId: string, userId: string) {
    const config = await this.getConfig(guildId);
    if (config) {
      const admins = config.admins || [];
      if (!admins.includes(userId)) {
        admins.push(userId);
        await this.update(config._id as string, { admins });
      }
    } else {
      await this.insert({ guildId, privilegedRoles: [], admins: [userId], adminRoles: [] });
    }
  }

  /**
   * Remove an admin user
   */
  async removeAdmin(guildId: string, userId: string) {
    const config = await this.getConfig(guildId);
    if (config && config.admins) {
      const admins = config.admins.filter((id: string) => id !== userId);
      await this.update(config._id as string, { admins });
    }
  }

  /**
   * Add an admin role
   */
  async addAdminRole(guildId: string, roleId: string) {
    const config = await this.getConfig(guildId);
    if (config) {
      const adminRoles = config.adminRoles || [];
      if (!adminRoles.includes(roleId)) {
        adminRoles.push(roleId);
        await this.update(config._id as string, { adminRoles });
      }
    } else {
      await this.insert({ guildId, privilegedRoles: [], admins: [], adminRoles: [roleId] });
    }
  }

  /**
   * Remove an admin role
   */
  async removeAdminRole(guildId: string, roleId: string) {
    const config = await this.getConfig(guildId);
    if (config && config.adminRoles) {
      const adminRoles = config.adminRoles.filter((id: string) => id !== roleId);
      await this.update(config._id as string, { adminRoles });
    }
  }

  /**
   * Set allowed roles for a specific action
   */
  async setActionRoles(guildId: string, action: string, roleIds: string[]) {
    const config = await this.getConfig(guildId);
    const actionRoles = { ...(config?.actionRoles || {}) };
    actionRoles[action] = Array.from(new Set(roleIds));
    if (config) {
      await this.update(config._id as string, { actionRoles });
    } else {
      await this.insert({ guildId, privilegedRoles: [], admins: [], actionRoles } as any);
    }
  }

  /**
   * Get allowed roles for a specific action
   */
  async getActionRoles(guildId: string, action: string): Promise<string[]> {
    const config = await this.getConfig(guildId);
    return config?.actionRoles?.[action] || [];
  }

  /**
   * Set channel/category config for a guild (upsert)
   */
  async setChannelConfig(guildId: string, config: Partial<GuildConfig>) {
    return this.setConfig(guildId, config);
  }

  /**
   * Get and increment the case counter for a guild (for sequential case numbers)
   */
  async getAndIncrementCaseCounter(guildId: string): Promise<number> {
    const config = await this.getConfig(guildId);
    let counter = config?.caseCounter ?? 0;
    counter++;
    await this.setConfig(guildId, { caseCounter: counter });
    return counter;
  }

  /**
   * Set the case counter for a guild (admin use)
   */
  async setCaseCounter(guildId: string, value: number) {
    await this.setConfig(guildId, { caseCounter: value });
  }

  /**
   * Delete all config for a guild
   */
  async deleteGuildConfig(guildId: string) {
    const configs = await this.findByFilters({ guildId });
    for (const config of configs) {
      await this.delete(config._id as string);
    }
  }
}
