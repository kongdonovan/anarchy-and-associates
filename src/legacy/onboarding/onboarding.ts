import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, User } from "discord.js";
import { buildOnboardingEmbed } from "../../services/onboarding.js";
import { Logger } from "../../utils/logger.js";

const logger = new Logger("OnboardingCommand");

@Discord()
export class OnboardingCommand {
  /**
   * /onboarding [user]
   * Start onboarding for a new staff member
   */
  @Slash({ name: "onboarding", description: "Start onboarding for a new staff member" })
  async onboarding(
    @SlashOption({ name: "user", description: "User to onboard", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    try {
      const embed = buildOnboardingEmbed(user.id);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to start onboarding", error);
      await interaction.reply({ content: "Failed to start onboarding.", ephemeral: true });
    }
  }
}
