import { Discord, Slash } from "discordx";
import {
  CommandInteraction,
  User,
  Colors,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  InteractionCollector,
  ComponentType,
} from "discord.js";
import { ApplicationRepository } from "../../mongo/repository/applications.js";
import { createAALegalEmbed } from "../../utils/embed.js";

const db = new ApplicationRepository();

@Discord()
export class ApplicationHistoryCommand {
  @Slash({ name: "applicationhistory", description: "View a user's application history" })
  async applicationHistory(interaction: CommandInteraction) {
    try {
      const targetUser = interaction.user;
      const displayName = targetUser.username || targetUser.displayName || "Unknown User";
      // find all applications, sorted by date
      const applications = await db.findByFilters(
        { applicantId: targetUser.id },
        {
          sort: { createdAt: -1 },
        }
      );
      const pageSize = 5;
      let page = 0;
      const totalPages = Math.ceil(applications.length / pageSize);

      const getEmbed = (page: number) => {
        const embed = createAALegalEmbed({
          title: applications.length ? `Application History for ${displayName}` : `No Applications Found`,
          description:
            applications.length
              ? applications
                  .slice(page * pageSize, (page + 1) * pageSize)
                  .map(
                    (app) =>
                      `**Status:** ${app.status.toUpperCase()}${
                        app.status === "rejected" && app.rejectionReason ? ` (Reason: ${app.rejectionReason})` : ""
                      }\n**Username:** ${app.username}\n**Reason:** ${app.reason}\n**Experience:** ${app.experience}\n**Submitted:** <t:${Math.floor(
                        new Date(app.createdAt).getTime() / 1000
                      )}:f>`
                  )
                  .join("\n\n")
              : `${displayName} has not submitted any applications.`,
          footer: `Page ${page + 1} of ${totalPages}`,
          thumbnail: targetUser.displayAvatarURL(),
        });
        return embed;
      };

      const getRow = (page: number) => {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("prev_page")
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId("next_page")
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
        );
      };

      const reply = await interaction.reply({
        embeds: [getEmbed(page)],
        components: totalPages > 1 ? [getRow(page)] : [],
        ephemeral: true,
        fetchReply: true,
      });

      if (totalPages > 1) {
        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60_000,
        });
        collector.on("collect", async (i) => {
          if (i.user.id !== interaction.user.id) {
            await i.reply({ content: "You can't control this pagination.", ephemeral: true });
            return;
          }
          if (i.customId === "prev_page" && page > 0) page--;
          if (i.customId === "next_page" && page < totalPages - 1) page++;
          await i.update({ embeds: [getEmbed(page)], components: [getRow(page)] });
        });
        collector.on("end", async () => {
          try {
            await reply.edit({ components: [] });
          } catch (err) {
            // Ignore error if message is ephemeral or deleted
          }
        });
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [
          createAALegalEmbed({
            title: "Error",
            description: "An unexpected error occurred while processing your request.",
            color: Colors.Red,
          }),
        ],
        ephemeral: true,
      });
    }
  }
}
