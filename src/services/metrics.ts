/**
 * Metrics service helpers for bot/server stats and firm statistics.
 * @module services/metrics
 */
import { EmbedBuilder } from "discord.js";

/**
 * Build embed for bot/server metrics.
 * @param metrics - Record of metric name to value
 * @param uptime - Bot uptime in seconds
 * @returns EmbedBuilder instance
 */
export function buildMetricsEmbed(metrics: Record<string, number>, uptime: number) {
  return new EmbedBuilder()
    .setTitle("Bot Metrics & Server Stats")
    .setDescription(
      Object.entries(metrics)
        .map(([k, v]) => `${k}: **${v}**`)
        .join("\n") +
      `\n\nUptime: **${uptime.toFixed(0)}s**\n\nFor more details, contact an admin.`
    );
}

/**
 * Build embed for firm statistics.
 * @param appCount - Number of applications
 * @param jobCount - Number of jobs
 * @param openCases - Number of open cases
 * @param closedCases - Number of closed cases
 * @returns EmbedBuilder instance
 */
export function buildStatsEmbed(appCount: number, jobCount: number, openCases: number, closedCases: number) {
  return new EmbedBuilder()
    .setTitle("Firm Statistics")
    .setDescription(
      `**Applications:** ${appCount}\n**Jobs:** ${jobCount}\n**Open Cases:** ${openCases}\n**Closed Cases:** ${closedCases}`
    );
}
