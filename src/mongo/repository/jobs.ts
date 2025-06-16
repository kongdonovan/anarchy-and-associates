import type { Job, JobQuestion } from "../../types/types.d.js";
import { BaseRepository } from "./base.js";

/**
 * Repository for Job documents.
 */
export class JobRepository extends BaseRepository<Job> {
  constructor() {
    super("jobs");
  }

  /**
   * Add a new job
   */
  async addJob(job: Omit<Job, "_id">) {
    return this.insert(job);
  }

  /**
   * Get all open jobs
   */
  async getOpenJobs() {
    return this.findByFilters({ open: true });
  }

  /**
   * Get a job by its ID
   */
  async getJobById(id: string) {
    return this.findById(id);
  }

  /**
   * Close a job by ID
   */
  async closeJob(id: string, by: string) {
    // Use $push for statusHistory
    return this.updateWithOperator(id, {
      $set: { open: false, updatedAt: new Date() },
      $push: { statusHistory: { status: "closed", at: new Date(), by } },
    });
  }

  /**
   * Open a job by ID
   */
  async openJob(id: string, by: string) {
    return this.updateWithOperator(id, {
      $set: { open: true, updatedAt: new Date() },
      $push: { statusHistory: { status: "opened", at: new Date(), by } },
    });
  }

  /**
   * Update a job by ID
   */
  async updateJob(id: string, updates: Partial<Job>) {
    return this.update(id, { ...updates, updatedAt: new Date() });
  }

  /**
   * List jobs with optional filtering and pagination
   */
  async listJobs(filter: Partial<Job> = {}, options: { limit?: number; skip?: number } = {}) {
    return this.findByFilters(filter, options);
  }

  /**
   * Delete a job by ID and optionally remove the associated role from all members
   */
  async deleteJobAndCleanup(id: string, guild: any) {
    const job = await this.findById(id);
    if (job && job.roleId && guild) {
      const role = guild.roles.cache.get(job.roleId);
      if (role) {
        for (const member of role.members.values()) {
          await member.roles.remove(role).catch(() => {});
        }
        await role.delete().catch(() => {});
      }
    }
    return this.delete(id);
  }
}
