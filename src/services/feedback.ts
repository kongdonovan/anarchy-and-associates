/**
 * Feedback service helpers for feedback embed formatting.
 * @module services/feedback
 */
import { EmbedBuilder } from "discord.js";

/**
 * Build embed for feedback received confirmation.
 * @param pingId - Optional Discord user ID to ping
 * @param stars - Optional number of stars for rating (0-5)
 * @returns EmbedBuilder instance
 */
export function buildFeedbackReceivedEmbed(pingId?: string, stars?: number) {
  return new EmbedBuilder()
    .setTitle("Feedback Received")
    .setDescription(
      `Thank you for your feedback. The Anarchy & Associates team values your input and will review your message promptly.` +
      (stars ? `\n\n**Rating:** ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}` : "") +
      (pingId ? `\n\n<@${pingId}> has been pinged.` : "")
    );
}

/**
 * Build embed for feedback submission to admins.
 * @param userId - Discord user ID of submitter
 * @param username - Username of submitter
 * @param message - Feedback message
 * @param stars - Number of stars for rating (0-5)
 * @param pingId - Optional Discord user ID to ping
 * @returns EmbedBuilder instance
 */
export function buildFeedbackSubmittedEmbed(userId: string, username: string, message: string, stars: number, pingId?: string) {
  return new EmbedBuilder()
    .setTitle("New Feedback Submitted")
    .setDescription(
      `**From:** <@${userId}> (${username})\n**Message:** ${message}\n**Rating:** ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}` + (pingId ? `\n**Pinged:** <@${pingId}>` : "")
    );
}
