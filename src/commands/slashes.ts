import { Discord, Slash } from "discordx";
import { CommandInteraction } from "discord.js";
import { createAALegalEmbed } from "../utils/embed.js";

@Discord()
export class SlashesCommand {
  /**
   * /slashes
   * List all available slash commands
   */
  @Slash({ name: "slashes", description: "List all available slash commands" })
  async slashes(interaction: CommandInteraction) {
    const embed = createAALegalEmbed({
      title: "Available Commands",
      description: `Here are the main commands for Anarchy & Associates:\n\n- /apply — Submit a job application\n- /jobs — List all jobs\n- /addjob — Add a new job\n- /editjob — Edit a job\n- /cases — List all cases\n- /casereview — Request a case review\n- /assigncase — Assign a case\n- /closecase — Close a case\n- /staff — View staff directory\n- /hire — Hire a staff member\n- /retainer — Initiate a retainer agreement\n- /promote — Promote a staff member\n- /stats — View firm statistics\n- /feedback — Submit feedback\n- /reminder — Set a reminder\n- /archive — Archive a record`,
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
