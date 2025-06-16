import { BaseRepository } from "./base.js";
import type { Case } from "../../types/types.d.js";

export class CaseRepository extends BaseRepository<Case> {
  constructor() {
    super("cases");
  }

  async addCase(caseData: Omit<Case, "_id">) {
    return this.insert(caseData);
  }

  async getCasesByUser(userId: string) {
    // Find cases where assignedTo array contains the userId
    return this.findByFilters({ assignedTo: { $elemMatch: { $eq: userId } } });
  }

  async getOpenCases() {
    return this.findByFilters({ status: "open" });
  }

  async getClosedCases() {
    return this.findByFilters({ status: "closed" });
  }
}
