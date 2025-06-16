import { Application } from "../../types/types.d.js";
import { BaseRepository } from "./base.js";

/**
 * Repository for Application documents.
 * Use dependency injection for testability.
 */
export class ApplicationRepository extends BaseRepository<Application> {
  constructor() {
    super("applications");
  }

  /**
   * Submit a new application (supports dynamic responses)
   */
  async submitApplication(app: Application) {
    return this.insert(app);
  }

  /**
   * Find all applications for a user
   */
  async findByDiscordId(discordId: string) {
    return this.findByFilters({ discordId });
  }

  /**
   * Update an application by its MongoDB ObjectId (as string)
   */
  async updateApplicationById(id: string, updates: Partial<Application>) {
    return this.update(id, updates);
  }

  /**
   * Delete an application by its MongoDB ObjectId (as string)
   */
  async deleteApplicationById(id: string) {
    return this.delete(id);
  }

  /**
   * Find all applications with a given status
   */
  async findByStatus(status: Application["status"]) {
    return this.findByFilters({ status });
  }
}