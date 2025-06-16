import { BaseRepository } from "./base.js";
import type { Feedback } from "../../types/types.d.js";

export class FeedbackRepository extends BaseRepository<Feedback> {
  constructor() {
    super("feedback");
  }

  async addFeedback(feedback: Omit<Feedback, "_id">) {
    return this.insert(feedback);
  }

  async searchFeedback({ userId, pingedUserId, from, to }: { userId?: string; pingedUserId?: string; from?: Date; to?: Date }) {
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (pingedUserId) filters.pingedUserId = pingedUserId;
    if (from || to) {
      filters.createdAt = {};
      if (from) filters.createdAt.$gte = from;
      if (to) filters.createdAt.$lte = to;
    }
    return this.findByFilters(filters, { sort: { createdAt: -1 } });
  }
}
