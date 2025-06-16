/**
 * Config service helpers for privileged roles and channel/category config.
 * @module services/config
 */
import { GuildConfigRepository } from "../mongo/repository/guildConfig.js";
import { getConfig, setConfig, getConfigKeys } from "../utils/botConfig.js";
import { Role, Channel } from "discord.js";

/**
 * Update privileged/action roles for a given action.
 * @param guildId - Guild/server ID
 * @param action - Action string
 * @param role - Discord role to add
 * @returns Array of role IDs for the action
 */
export async function updateActionRoleConfig(guildId: string, action: string, role: Role) {
  const configDb = new GuildConfigRepository();
  const config = await configDb.getConfig(guildId) || { guildId, privilegedRoles: [] };
  let updatedRoles = Array.from(new Set([...(config.privilegedRoles || [])]));
  if (!updatedRoles.includes(role.id)) {
    updatedRoles.push(role.id);
  }
  await configDb.setConfig(guildId, { privilegedRoles: updatedRoles });
  let actionRoles = { ...(config.actionRoles || {}) };
  actionRoles[action] = Array.from(new Set([...(actionRoles[action] || []), role.id]));
  await configDb.setActionRoles(guildId, action, actionRoles[action]);
  return actionRoles[action];
}

/**
 * Set a config key to a channel/category ID.
 * @param key - Config key
 * @param channel - Channel or category
 */
export function setChannelConfig(key: string, channel: Channel) {
  setConfig(key, channel.id);
}

/**
 * Set a config key to a channel/category ID in the database for the current guild.
 * @param guildId - Guild/server ID
 * @param key - Config key (e.g. 'feedbackChannelId')
 * @param channel - Channel or category
 */
export async function setGuildChannelConfig(guildId: string, key: string, channel: Channel) {
  const configDb = new GuildConfigRepository();
  await configDb.setChannelConfig(guildId, { [key]: channel.id });
}

/**
 * Format config for display in an embed.
 * @returns Formatted string for embed
 */
export function formatConfigForDisplay() {
  const config = getConfig();
  const keys = getConfigKeys();
  return keys.length ? keys.map(k => `• **${k}**: <#${config[k]}>`).join("\n") : "No config set.";
}
