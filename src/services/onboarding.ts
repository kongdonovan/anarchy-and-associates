/**
 * Onboarding service helpers for staff onboarding flows.
 * @module services/onboarding
 */
import { EmbedBuilder } from "discord.js";

/**
 * Build the onboarding welcome embed for new staff.
 * @param userId - Discord user ID of the new staff member
 * @returns EmbedBuilder instance for onboarding
 */
export function buildOnboardingEmbed(userId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Staff Onboarding Initiated")
    .setDescription(
      `Welcome <@${userId}> to Anarchy & Associates!\n\nA mentor will be assigned to guide you through your first days. Please review the onboarding checklist and reach out with any questions.\n\n**Onboarding Checklist:**\n- [ ] Complete HR paperwork\n- [ ] Review firm policies\n- [ ] Meet your mentor\n- [ ] Set up required accounts\n- [ ] Schedule intro meeting`
    );
}
