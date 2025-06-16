/**
 * Bot config utility for reading/writing config.json.
 * @module utils/botConfig
 */
import fs from "fs";
import path from "path";
import { GuildConfigRepository } from "../mongo/repository/guildConfig.js";

const CONFIG_PATH = path.resolve(process.cwd(), "config.json");

export type BotConfig = Record<string, string>;

/**
 * Get the current bot config as an object.
 * @returns BotConfig object
 */
export function getConfig(): BotConfig {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

/**
 * Set a config key to a value and persist to disk.
 * @param key - Config key
 * @param value - Config value
 */
export function setConfig(key: string, value: string) {
  const config = getConfig();
  config[key] = value;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Get all config keys.
 * @returns Array of config key strings
 */
export function getConfigKeys(): string[] {
  return Object.keys(getConfig());
}

/**
 * Fetches the latest config for a guild from the database.
 * @param guildId Discord guild/server ID
 * @returns GuildConfig object or null
 */
export async function getGuildConfig(guildId: string) {
  const configDb = new GuildConfigRepository();
  return await configDb.getConfig(guildId);
}

/**
 * Helper to get a specific config value for a guild.
 * @param guildId Discord guild/server ID
 * @param key Config key (e.g. 'feedbackChannelId')
 * @returns Value or undefined
 */
export async function getGuildConfigValue<T extends keyof import("../types/types.d.js").GuildConfig>(guildId: string, key: T) {
  const config = await getGuildConfig(guildId);
  return config?.[key];
}
