import { Discord, Slash, SlashGroup, SlashOption, ButtonComponent, ModalComponent } from "discordx";
import { CommandInteraction, User, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, GuildTextBasedChannel, EmbedBuilder } from "discord.js";
import { createAALegalEmbed } from "../utils/embed.js";
import { Logger } from "../utils/logger.js";
import { hasActionPermission } from "../utils/permissions.js";
import { getConfig, getGuildConfig } from "../utils/botConfig.js";
import { RetainerService } from "../services/retainer.js";
import { AuditLog } from "../utils/auditLogDecorator.js";

const logger = new Logger("RetainerCommandGroup");

@Discord()
@SlashGroup({ name: "retainer", description: "Retainer agreement commands" })
@SlashGroup("retainer")
export class RetainerCommandGroup {
  /**
   * /retainer sign [user]
   * Send a retainer agreement to a user for signature (was /retainer sign)
   */
  @Slash({ name: "sign", description: "Send a retainer agreement to a user for signature" })
  @AuditLog({
    action: "Send Retainer Agreement",
    getTarget: (result, args) => args[0]?.id, // user
    getAfter: (result) => result?.retainer,
    getDetails: (result, args) => `Sent to: <@${args[0]?.id}>`,
  })
  async sign(
    @SlashOption({ name: "user", description: "User to send the retainer to", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "retainer"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **retainer** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      const guildId = interaction.guildId ?? undefined;
      const hasActive = await RetainerService.hasActiveRetainer(user.id, guildId);
      if (hasActive) {
        await interaction.reply({ content: `User <@${user.id}> already has an active retainer agreement.`, ephemeral: true });
        return;
      }
      const RETAINER_TEXT = `**Anarchy & Associates Retainer Agreement**\n\nThis agreement is made between the undersigned client and Anarchy & Associates ("the Firm"). By signing below, the client agrees to retain the Firm for legal services, to provide all necessary information truthfully, and to abide by the Firm's policies. The Firm agrees to represent the client with diligence and confidentiality. Fees, scope, and terms are as discussed. This agreement is effective upon signature.\n\n*By clicking 'Sign Retainer', you acknowledge and accept these terms.*`;
      const embed = createAALegalEmbed({
        title: "Retainer Agreement",
        description: RETAINER_TEXT,
      });
      const signBtn = new ButtonBuilder()
        .setCustomId("sign_retainer")
        .setLabel("Sign Retainer")
        .setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(signBtn);
      try {
        await user.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `Retainer agreement sent to <@${user.id}>.`, ephemeral: true });
      } catch (e) {
        await interaction.reply({ content: `Failed to DM <@${user.id}>. They may have DMs disabled.`, ephemeral: true });
      }
      return { retainer: { userId: user.id, guildId: interaction.guildId } };
    } catch (error) {
      logger.error("Failed to send retainer agreement", error);
      await interaction.reply({ content: "Failed to send retainer agreement.", ephemeral: true });
    }
  }

  @ButtonComponent({ id: "sign_retainer" })
  async onSignRetainer(interaction: CommandInteraction) {
    try {
      const modal = new ModalBuilder()
        .setCustomId("retainer_modal")
        .setTitle("Sign Retainer Agreement")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("username")
              .setLabel("Your Roblox Username")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("date")
              .setLabel("Date (YYYY-MM-DD)")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
    } catch (error) {
      logger.error("Failed to show retainer modal", error);
      await interaction.reply({ content: "Failed to show retainer modal.", ephemeral: true });
    }
  }

  @ModalComponent({ id: "retainer_modal" })
  async onRetainerModalSubmit(inter: ModalSubmitInteraction) {
    try {
      const config = await getGuildConfig(inter.guildId!);
      const retainerChannelId = config?.retainerChannelId;
      const clientRoleId = config?.clientRoleId;
      const username = inter.fields.getTextInputValue("username");
      const date = inter.fields.getTextInputValue("date");
      try {
        const guildId = inter.guildId ?? undefined;
        await RetainerService.addRetainer({
          clientId: inter.user.id,
          lawyerId: inter.user.id,
          agreement: `**Anarchy & Associates Retainer Agreement**\n\nThis agreement is made between the undersigned client and Anarchy & Associates ("the Firm"). By signing below, the client agrees to retain the Firm for legal services, to provide all necessary information truthfully, and to abide by the Firm's policies. The Firm agrees to represent the client with diligence and confidentiality. Fees, scope, and terms are as discussed. This agreement is effective upon signature.\n\n*By clicking 'Sign Retainer', you acknowledge and accept these terms.*`,
          signedAt: new Date(),
          accepted: true,
          guildId,
          robloxUsername: username,
        });
      } catch (e: any) {
        await inter.reply({ content: e.message || "You already have an active retainer.", ephemeral: true });
        return;
      }
      const embed = createAALegalEmbed({
        title: "Signed Retainer Agreement",
        description: `**Anarchy & Associates Retainer Agreement**\n\nThis agreement is made between the undersigned client and Anarchy & Associates ("the Firm"). By signing below, the client agrees to retain the Firm for legal services, to provide all necessary information truthfully, and to abide by the Firm's policies. The Firm agrees to represent the client with diligence and confidentiality. Fees, scope, and terms are as discussed. This agreement is effective upon signature.\n\n*By clicking 'Sign Retainer', you acknowledge and accept these terms.*\n\n**Roblox Username:** ${username}\n**Date:** ${date}`,
        footer: `Client Discord: ${inter.user.tag}`,
      });
      if (retainerChannelId) {
        const channel = (await inter.client.channels.fetch(retainerChannelId).catch(() => null)) as GuildTextBasedChannel | null;
        if (channel) {
          await channel.send({ embeds: [embed] });
        }
      }
      if (clientRoleId && inter.guild) {
        const member = await inter.guild.members.fetch(inter.user.id).catch(() => null);
        if (member && !member.roles.cache.has(clientRoleId)) {
          await member.roles.add(clientRoleId).catch(() => {});
        }
      }
      await inter.reply({ content: "Your retainer agreement has been submitted. Thank you for choosing Anarchy & Associates.", ephemeral: true });
    } catch (error) {
      logger.error("Failed to submit retainer agreement", error);
      await inter.reply({ content: "Failed to submit retainer agreement.", ephemeral: true });
    }
  }

  /**
   * /retainer list
   * View your active retainer agreements (was /retainer list)
   */
  @Slash({ name: "list", description: "View your active retainer agreements" })
  async list(interaction: CommandInteraction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const retainers = await RetainerService.getRetainersByClient(userId, guildId || undefined);
    if (!retainers || retainers.length === 0) {
      await interaction.reply({ content: "You have no active retainer agreements.", ephemeral: true });
      return;
    }
    const embeds = retainers.slice(0, 10).map((r: any) =>
      new EmbedBuilder()
        .setTitle(`Retainer Agreement with <@${r.lawyerId}>`)
        .addFields(
          { name: "Signed At", value: r.signedAt ? new Date(r.signedAt).toLocaleString() : "N/A", inline: true },
          { name: "Accepted", value: r.accepted ? "Yes" : "No", inline: true },
          { name: "Roblox Username", value: r.robloxUsername || "N/A", inline: true }
        )
        .setDescription(r.agreement || "No agreement text.")
    );
    await interaction.reply({
      content: `Here are your active retainers (${retainers.length} total):`,
      embeds,
      ephemeral: true,
    });
  }

  /**
   * /retainer listall
   * List all users with an active retainer in this guild (was /retainerlist)
   */
  @Slash({ name: "listall", description: "List all users with an active retainer in this guild" })
  async listAll(interaction: CommandInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }
    const retainers = await RetainerService.getActiveRetainersInGuild(guildId);
    if (!retainers.length) {
      await interaction.reply({ content: "No active retainers found in this guild.", ephemeral: true });
      return;
    }
    const lines = retainers.map(r => `• <@${r.clientId}> (Roblox: ${r.robloxUsername || 'N/A'})`);
    const embed = createAALegalEmbed({
      title: "Active Retainer Agreements",
      description: lines.join("\n"),
      color: 0x00bfff,
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
