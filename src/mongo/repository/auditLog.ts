import { BaseRepository } from "./base.js";

export interface AuditLogEntry {
  readonly _id?: string;
  readonly action: string;
  readonly userId: string;
  readonly targetId?: string;
  readonly details?: string;
  readonly timestamp: Date;
  readonly channelId?: string;
  readonly caseId?: string;
  readonly before?: Record<string, any>;
  readonly after?: Record<string, any>;
}

export class AuditLogRepository extends BaseRepository<AuditLogEntry> {
  constructor() {
    super("auditLog");
  }

  async addEntry(entry: Omit<AuditLogEntry, "_id">) {
    return this.insert(entry);
  }

  async getEntries(filters: Partial<AuditLogEntry> = {}, options: { limit?: number; skip?: number } = {}) {
    return this.findByFilters(filters, options);
  }
}
