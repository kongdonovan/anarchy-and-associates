import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { CommandInteraction, User, Role } from "discord.js";
import { StaffService } from "../services/staffService.js";
import { Logger } from "../utils/logger.js";
import { createAALegalEmbed } from "../utils/embed.js";
import { hasActionPermission } from "../utils/permissions.js";
import { AuditLog } from "../utils/auditLogDecorator.js";
import type { Staff } from "../types/types.d.js";

const staffService = new StaffService();
const logger = new Logger("StaffCommandGroup");

@Discord()
@SlashGroup({ name: "staff", description: "Staff management commands" })
@SlashGroup("staff")
export class StaffCommandGroup {
  @Slash({ name: "list", description: "View all staff and their roles" })
  async list(
    @SlashOption({ name: "role", description: "Filter by role", required: false, type: 3 }) role: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      const staff = await staffService.getAllStaff();
      const filtered = role ? staff.filter((s: Staff) => s.role === role) : staff;
      if (!filtered.length) {
        await interaction.reply({ content: "No staff found.", ephemeral: true });
        return;
      }
      const feedbackRepo = (await import("../mongo/repository/feedback.js")).FeedbackRepository;
      const feedbackDb = new feedbackRepo();
      const embed = createAALegalEmbed({
        title: "Staff Directory",
        description: filtered.length
          ? await Promise.all(filtered.map(async (s: Staff) => {
              const feedbacks = await feedbackDb.searchFeedback({ userId: undefined });
              const theirFeedback = feedbacks.filter(f => f.pingedUserId === s.userId);
              if (theirFeedback.length) {
                const avg = theirFeedback.reduce((sum, f) => sum + (f.stars || 0), 0) / theirFeedback.length;
                return `**${s.username || s.userId}** — ${s.role || "(no role)"} — ⭐ ${avg.toFixed(2)} (${theirFeedback.length} rating${theirFeedback.length > 1 ? "s" : ""})`;
              } else {
                return `**${s.username || s.userId}** — ${s.role || "(no role)"} — _No ratings yet_`;
              }
            })).then(lines => lines.join("\n"))
          : "No staff found.",
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to fetch staff list", error);
      await interaction.reply({ content: "Failed to fetch staff list.", ephemeral: true });
    }
  }

  @Slash({ name: "hire", description: "Hire a new staff member" })
  @AuditLog({
    action: "Hire Staff",
    getTarget: (result: any, args: any[]) => args[0]?.id,
    getAfter: (result: any) => result?.staff,
    getDetails: (result: any, args: any[]) => `Hired: <@${args[0]?.id}> as ${args[1]?.name}`,
  })
  async hire(
    @SlashOption({ name: "user", description: "User to hire", required: true, type: 6 }) user: User,
    @SlashOption({ name: "role", description: "Role to assign", required: true, type: 8 }) role: Role,
    @SlashOption({ name: "roblox_username", description: "Roblox username", required: true, type: 3 }) robloxUsername: string,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **hire** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      const existing = await staffService.getStaffByUserId(user.id);
      if (existing && existing.length > 0) {
        await interaction.reply({ content: `<@${user.id}> is already a staff member.`, ephemeral: true });
        return;
      }
      const guild = interaction.guild;
      const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
      if (!member) {
        await interaction.reply({ content: `User <@${user.id}> is not in this server.`, ephemeral: true });
        return;
      }
      const job = await staffService.getJobByRole(role);
      if (job && typeof job.limit === "number") {
        const { allowed, limit, count } = await staffService.canAssignJob(job.title);
        if (!allowed) {
          await interaction.reply({ content: `The job limit for **${role.name}** has been reached (${count}/${limit}).`, ephemeral: true });
          return;
        }
      }
      await staffService.addStaffMember({
        userId: user.id,
        username: robloxUsername,
        role: role.name,
      });
      await member.roles.add(role).catch(() => {});
      const embed = createAALegalEmbed({
        title: "Staff Hired",
        description: `Welcome <@${user.id}> to Anarchy & Associates as **${role.name}**! We look forward to your contributions to our legacy of excellence.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return { staff: { userId: user.id, role: role.name, robloxUsername } };
    } catch (error) {
      logger.error("Failed to hire staff", error);
      await interaction.reply({ content: "Failed to hire staff. Please try again later.", ephemeral: true });
    }
  }

  @Slash({ name: "fire", description: "Remove a staff member from the team" })
  @AuditLog({
    action: "Fire Staff",
    getTarget: (result: any, args: any[]) => args[0]?.id,
    getAfter: (result: any) => result?.removed,
    getDetails: (result: any, args: any[]) => `Fired: <@${args[0]?.id}>`,
  })
  async fire(
    @SlashOption({ name: "user", description: "User to fire", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **fire** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      // --- Prevent firing someone with a higher or equal role ---
      const guild = interaction.guild;
      if (!guild) throw new Error("This command must be run in a server.");
      const targetMember = await guild.members.fetch(user.id);
      const actingMember = await guild.members.fetch(interaction.user.id);
      if (!targetMember || !actingMember) {
        await interaction.reply({ content: "Could not find one of the users in the server.", ephemeral: true });
        return;
      }
      if (
        actingMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0
      ) {
        await interaction.reply({ content: `You cannot fire <@${user.id}> because they have a higher or equal role than you.`, ephemeral: true });
        return;
      }
      const staffRecords = await staffService.getStaffByUserId(user.id);
      if (!staffRecords || staffRecords.length === 0) {
        await interaction.reply({ content: `<@${user.id}> is not a staff member.`, ephemeral: true });
        return;
      }
      await staffService.fireStaffMember(user.id, interaction.guild!);
      const embed = createAALegalEmbed({
        title: "Staff Removed",
        description: `<@${user.id}> has been removed from the staff team.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return { removed: { userId: user.id } };
    } catch (error) {
      logger.error("Failed to remove staff member", error);
      await interaction.reply({ content: "Failed to remove staff member.", ephemeral: true });
    }
  }

  @Slash({ name: "promote", description: "Promote a staff member to a specified rank" })
  @AuditLog({
    action: "Promote Staff",
    getTarget: (result: any, args: any[]) => args[0]?.id,
    getBefore: (result: any) => result?.before,
    getAfter: (result: any) => result?.after,
    getDetails: (result: any, args: any[]) => `Promoted: <@${args[0]?.id}> to <@&${args[1]?.id}>`,
  })
  async promote(
    @SlashOption({ name: "user", description: "User to promote", required: true, type: 6 }) user: User,
    @SlashOption({ name: "role", description: "New role", required: true, type: 8 }) role: Role,
    @SlashOption({ name: "roblox_username", description: "Roblox username", required: false, type: 3 }) robloxUsername: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **promote** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      const guild = interaction.guild;
      if (!guild) throw new Error("This command must be run in a server.");
      const member = await guild.members.fetch(user.id);
      if (!member) throw new Error("User not found in this server.");
      const actingMember = await guild.members.fetch(interaction.user.id);
      // Only allow promotion to a role higher than the user's current highest
      if (role.position <= member.roles.highest.position) {
        await interaction.reply({ content: `<@${user.id}> already has a role equal to or higher than <@&${role.id}>.`, ephemeral: true });
        return;
      }
      // Prevent promoting someone with a higher or equal role than yourself
      if (actingMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        await interaction.reply({ content: `You cannot promote <@${user.id}> because they have a higher or equal role than you.`, ephemeral: true });
        return;
      }
      if (member.roles.cache.has(role.id)) {
        await interaction.reply({ content: `<@${user.id}> already has the role <@&${role.id}>.`, ephemeral: true });
        return;
      }
      // Check that the user is a staff member before promoting
      const staffRecords = await staffService.getStaffByUserId(user.id);
      if (!staffRecords || staffRecords.length === 0) {
        await interaction.reply({ content: `<@${user.id}> is not a staff member.`, ephemeral: true });
        return;
      }
      // Remove all staff roles below the new one
      for (const r of member.roles.cache.values()) {
        if (r.position < role.position && r.id !== guild.id) {
          await member.roles.remove(r).catch(() => {});
        }
      }
      await member.roles.add(role).catch(() => {});
      await staffService.staffDb.updateStaff(user.id, { role: role.name, updatedAt: new Date(), ...(robloxUsername ? { username: robloxUsername } : {}) });
      const embed = createAALegalEmbed({
        title: "Promotion Awarded",
        description: `Congratulations <@${user.id}>! You have been promoted to <@&${role.id}> at Anarchy & Associates. Your dedication is recognized and valued.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return { before: { userId: user.id, previousRole: member.roles.highest.name }, after: { userId: user.id, newRole: role.name } };
    } catch (error) {
      logger.error("Failed to promote staff member", error);
      await interaction.reply({ content: "Failed to promote staff member.", ephemeral: true });
    }
  }

  @Slash({ name: "demote", description: "Demote a staff member to a specified lower rank" })
  @AuditLog({
    action: "Demote Staff",
    getTarget: (result: any, args: any[]) => args[0]?.id,
    getBefore: (result: any) => result?.before,
    getAfter: (result: any) => result?.after,
    getDetails: (result: any, args: any[]) => `Demoted: <@${args[0]?.id}> to <@&${args[1]?.id}>`,
  })
  async demote(
    @SlashOption({ name: "user", description: "User to demote", required: true, type: 6 }) user: User,
    @SlashOption({ name: "role", description: "New lower role", required: true, type: 8 }) role: Role,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **demote** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      const guild = interaction.guild;
      if (!guild) throw new Error("This command must be run in a server.");
      const member = await guild.members.fetch(user.id);
      if (!member) throw new Error("User not found in this server.");
      const actingMember = await guild.members.fetch(interaction.user.id);
      // Only allow demotion to a role lower than the user's current highest
      if (role.position >= member.roles.highest.position) {
        await interaction.reply({ content: `<@${user.id}> already has a role equal to or lower than <@&${role.id}>.`, ephemeral: true });
        return;
      }
      // Prevent demoting someone with a higher or equal role than yourself
      if (actingMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        await interaction.reply({ content: `You cannot demote <@${user.id}> because they have a higher or equal role than you.`, ephemeral: true });
        return;
      }
      if (member.roles.cache.has(role.id)) {
        await interaction.reply({ content: `<@${user.id}> already has the role <@&${role.id}>.`, ephemeral: true });
        return;
      }
      // Remove all staff roles above the new one
      for (const r of member.roles.cache.values()) {
        if (r.position > role.position && r.id !== guild.id) {
          await member.roles.remove(r).catch(() => {});
        }
      }
      await member.roles.add(role).catch(() => {});
      await staffService.staffDb.updateStaff(user.id, { role: role.name, updatedAt: new Date() });
      const embed = createAALegalEmbed({
        title: "Demotion Processed",
        description: `<@${user.id}> has been demoted to <@&${role.id}> at Anarchy & Associates.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return { before: { userId: user.id, previousRole: member.roles.highest.name }, after: { userId: user.id, newRole: role.name } };
    } catch (error) {
      logger.error("Failed to demote staff member", error);
      await interaction.reply({ content: "Failed to demote staff member.", ephemeral: true });
    }
  }

  @Slash({ name: "info", description: "Get detailed info about a staff member" })
  async info(
    @SlashOption({ name: "user", description: "Staff member to look up", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    try {
      const staffRecords = await staffService.getStaffByUserId(user.id);
      if (!staffRecords || staffRecords.length === 0) {
        await interaction.reply({ content: `<@${user.id}> is not a staff member.`, ephemeral: true });
        return;
      }
      const staff = staffRecords[0];
      // Roblox profile info (basic)
      const robloxUsername = staff.username;
      const robloxProfileUrl = robloxUsername ? `https://www.roblox.com/users/profile?username=${encodeURIComponent(robloxUsername)}` : null;
      // Tenure calculation
      const joined = staff.createdAt ? new Date(staff.createdAt) : null;
      const now = new Date();
      const tenureMs = joined ? now.getTime() - joined.getTime() : null;
      const tenureStr = tenureMs ? `${Math.floor(tenureMs / (1000*60*60*24))} days` : "Unknown";
      // Feedback
      const feedbackRepo = (await import("../mongo/repository/feedback.js")).FeedbackRepository;
      const feedbackDb = new feedbackRepo();
      // FIX: Search feedbacks where pingedUserId matches the staff member
      const feedbacks = await feedbackDb.searchFeedback({ pingedUserId: user.id });
      let feedbackDetails = "No feedback yet.";
      if (feedbacks.length) {
        const avg = feedbacks.reduce((sum, f) => sum + (f.stars || 0), 0) / feedbacks.length;
        feedbackDetails = `Average Rating: ⭐ ${avg.toFixed(2)} (${feedbacks.length} rating${feedbacks.length > 1 ? "s" : ""})\n` +
          feedbacks.slice(0, 5).map(f => `• ${f.stars ? `⭐${f.stars}` : ""} ${f.message || "(no comment)"} <t:${Math.floor(new Date(f.createdAt).getTime()/1000)}:R>`).join("\n");
        if (feedbacks.length > 5) feedbackDetails += `\n...and ${feedbacks.length - 5} more.`;
      }
      // Build embed
      const embed = createAALegalEmbed({
        title: `Staff Info: ${robloxUsername || user.username}`,
        description: `**Discord:** <@${user.id}>\n**Role:** ${staff.role}\n**Joined:** ${joined ? `<t:${Math.floor(joined.getTime()/1000)}:D>` : "Unknown"} (${tenureStr})\n` +
          (robloxProfileUrl ? `**Roblox:** [${robloxUsername}](${robloxProfileUrl})\n` : "") +
          `\n__**Feedback:**__\n${feedbackDetails}`
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to fetch staff info", error);
      await interaction.reply({ content: "Failed to fetch staff info.", ephemeral: true });
    }
  }
}
