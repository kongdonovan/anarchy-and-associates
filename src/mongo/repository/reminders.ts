import { BaseRepository } from "./base.js";

export interface Reminder {
  readonly _id?: string;
  readonly userId: string;
  readonly message: string;
  readonly scheduledFor: Date;
  readonly channelId?: string;
  readonly createdAt: Date;
}

export class RemindersRepository extends BaseRepository<Reminder> {
  constructor() {
    super("reminders");
  }

  async getRemindersByUser(userId: string) {
    return this.findByFilters({ userId });
  }
}
