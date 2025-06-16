/**
 * Reminders service helpers for scheduling and formatting reminders.
 * @module services/reminders
 */
import { EmbedBuilder } from "discord.js";
import { RemindersRepository } from "../mongo/repository/reminders.js";

const remindersRepo = new RemindersRepository();

/**
 * Build a reminder embed.
 * @param message - Reminder message
 * @param time - Time string (e.g., '10m', '2h')
 * @returns EmbedBuilder instance for reminder
 */
export function buildReminderEmbed(message: string, time: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Reminder Set")
    .setDescription(`Your reminder has been scheduled: **${message}**\n\n⏰ Time: ${time}`);
}

export class RemindersService {
  static async getRemindersByUser(userId: string) {
    return remindersRepo.getRemindersByUser(userId);
  }
  // Additional methods for scheduling, deleting, etc. can be added here
}
