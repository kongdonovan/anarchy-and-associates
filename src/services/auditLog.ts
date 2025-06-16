import { AuditLogRepository, AuditLogEntry } from "../mongo/repository/auditLog.js";
import { createAALegalEmbed } from "../utils/embed.js";

const auditDb = new AuditLogRepository();

export class AuditLogService {
  static async logAction(entry: Omit<AuditLogEntry, "_id">) {
    return auditDb.addEntry(entry);
  }

  static async getLogs(filters: Partial<AuditLogEntry> = {}, options: { limit?: number; skip?: number } = {}) {
    return auditDb.getEntries(filters, options);
  }

  /**
   * Log an action and post to the modlog channel.
   * @param params - { action, userId, targetId, details, before, after, channel, caseId }
   * @param modlogChannel - Discord.js TextChannel or NewsChannel
   */
  static async logAndPostAction({
    action,
    userId,
    targetId,
    details,
    before,
    after,
    channelId,
    caseId,
    modlogChannel
  }: {
    action: string;
    userId: string;
    targetId?: string;
    details?: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
    channelId?: string;
    caseId?: string;
    modlogChannel: any;
  }) {
    const timestamp = new Date();
    await auditDb.addEntry({ action, userId, targetId, details, before, after, channelId, caseId, timestamp });
    // Build embed
    const fields = [];
    if (targetId) fields.push({ name: "Target", value: `<@${targetId}>`, inline: true });
    if (caseId) fields.push({ name: "Case ID", value: caseId, inline: true });
    if (before) fields.push({ name: "Before", value: '```json\n' + JSON.stringify(before, null, 2).slice(0, 900) + '```', inline: false });
    if (after) fields.push({ name: "After", value: '```json\n' + JSON.stringify(after, null, 2).slice(0, 900) + '```', inline: false });
    await modlogChannel.send({
      embeds: [createAALegalEmbed({
        title: `Audit Log: ${action}`,
        description: details,
        fields,
        color: "#b366f6",
        footer: `User: ${userId}`
      })]
    });
  }
}
