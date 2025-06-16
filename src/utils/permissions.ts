/**
 * Permission utility for per-action and admin role checks.
 * @module utils/permissions
 */
import { CommandInteraction, GuildMember } from "discord.js";
import { GuildConfigRepository } from "../mongo/repository/guildConfig.js";

const configDb = new GuildConfigRepository();
const BOT_OWNER = process.env.BOT_OWNER;

/**
 * Checks if a user has permission to perform a specific action based on per-action role whitelisting and admin status.
 * @param interaction - The command interaction
 * @param action - The action to check (e.g., "addjob", "assigncase")
 * @returns Promise resolving to true if the user is allowed, false otherwise
 */
export async function hasActionPermission(interaction: CommandInteraction, action: string): Promise<boolean> {
  const guildId = interaction.guildId;
  if (!guildId) return false;
  const member = interaction.member as GuildMember;
  if (!member) return false;

  // Bot owner always allowed
  if (BOT_OWNER && (member.id === BOT_OWNER || interaction.user.id === BOT_OWNER)) return true;

  const config = await configDb.getConfig(guildId);
  if (!config) return false;

  // Admin users always allowed
  if (config.admins && config.admins.includes(member.id)) return true;
  // Admin roles always allowed
  if (config.adminRoles && member.roles.cache.some(r => config.adminRoles!.includes(r.id))) return true;

  // Per-action roles
  const actionRoles = config.actionRoles?.[action] || [];
  if (actionRoles.length === 0) return false; // If no roles set, deny by default
  if (member.roles.cache.some(r => actionRoles.includes(r.id))) return true;

  return false;
}

/**
 * List of all valid permission action names for the bot.
 */
export const PERMISSION_ACTIONS = [
  "admin",
  "config",
  "case",
  "hr",
  "retainer",
  "casereview"
] as const;
export type PermissionAction = typeof PERMISSION_ACTIONS[number];
