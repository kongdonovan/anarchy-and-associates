import { AuditLogService } from '../services/auditLog';
import { Logger } from './logger';

const logger = new Logger('withAuditLog');

/**
 * Wraps a state-mutating command with unified audit logging and error handling.
 * @param commandFn The actual command logic (should return { before, after, ... })
 * @param auditMeta Metadata for the audit log (action, getTarget, etc.)
 */
export async function withAuditLog({
  interaction,
  commandFn,
  auditMeta,
  modlogChannel
}: {
  interaction: any, // Discord interaction object
  commandFn: (interaction: any) => Promise<any>,
  auditMeta: {
    action: string,
    getTarget?: (result: any) => string,
    getBefore?: (result: any) => any,
    getAfter?: (result: any) => any,
    getDetails?: (result: any) => string,
    getCaseId?: (result: any) => string,
    getChannelId?: (result: any) => string,
  },
  modlogChannel: any
}) {
  let result;
  try {
    result = await commandFn(interaction);
    // Only log if command succeeded
    const targetId = auditMeta.getTarget ? auditMeta.getTarget(result) : undefined;
    const before = auditMeta.getBefore ? auditMeta.getBefore(result) : undefined;
    const after = auditMeta.getAfter ? auditMeta.getAfter(result) : undefined;
    const details = auditMeta.getDetails ? auditMeta.getDetails(result) : undefined;
    const caseId = auditMeta.getCaseId ? auditMeta.getCaseId(result) : undefined;
    const channelId = auditMeta.getChannelId ? auditMeta.getChannelId(result) : undefined;
    await AuditLogService.logAndPostAction({
      action: auditMeta.action,
      userId: interaction.user?.id,
      targetId,
      details,
      before,
      after,
      caseId,
      channelId,
      modlogChannel
    });
    return result;
  } catch (err) {
    logger.error(`Command failed: ${auditMeta.action}`, err);
    throw err;
  }
}
