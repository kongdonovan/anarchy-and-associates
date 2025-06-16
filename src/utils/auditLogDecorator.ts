import { AuditLogService } from '../services/auditLog.js';
import { Logger } from './logger.js';
import { getGuildConfig } from './botConfig.js';

const logger = new Logger('AuditLogDecorator');

/**
 * Decorator for audit logging state-mutating methods.
 * Usage:
 *   @AuditLog({ action: 'Close Case', ... })
 *   async closeCase(interaction, ...args) { ... }
 */
export function AuditLog({
  action,
  getTarget,
  getBefore,
  getAfter,
  getDetails,
  getCaseId,
  getChannelId
}: {
  action: string,
  getTarget?: (result: any, args: any[]) => string,
  getBefore?: (result: any, args: any[]) => any,
  getAfter?: (result: any, args: any[]) => any,
  getDetails?: (result: any, args: any[]) => string,
  getCaseId?: (result: any, args: any[]) => string,
  getChannelId?: (result: any, args: any[]) => string
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      let result;
      try {
        result = await originalMethod.apply(this, args);
        const interaction = args.find(arg => arg && arg.guildId && arg.user);
        let modlogChannel = undefined;
        if (interaction && interaction.guild && interaction.guild.channels) {
          const config = await getGuildConfig(interaction.guildId);
          const modlogChannelId = config?.modlogChannelId;
          if (modlogChannelId) {
            modlogChannel = interaction.guild.channels.cache.get(modlogChannelId);
          }
        }
        const targetId = getTarget ? getTarget(result, args) : undefined;
        const before = getBefore ? getBefore(result, args) : undefined;
        const after = getAfter ? getAfter(result, args) : undefined;
        const details = getDetails ? getDetails(result, args) : undefined;
        const caseId = getCaseId ? getCaseId(result, args) : undefined;
        const channelId = getChannelId ? getChannelId(result, args) : undefined;
        await AuditLogService.logAndPostAction({
          action,
          userId: interaction?.user?.id,
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
        logger.error(`Command failed: ${action}`, err);
        throw err;
      }
    };
    return descriptor;
  };
}
