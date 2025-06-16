import { BaseRepository } from "./base.js";
import type { Case } from "../../types/types.d.js";

export class ArchiveRepository extends BaseRepository<Case> {
  constructor() {
    super("archivedCases");
  }

  async addArchivedCase(caseData: Case) {
    return this.insert(caseData);
  }

  async getArchivedCases(filters: Partial<Case> = {}, options: { limit?: number; skip?: number } = {}) {
    return this.findByFilters(filters, options);
  }
}
