import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";
import { StaffService } from "../services/staffService.js";
import { getGuildConfig } from "../utils/botConfig.js";
import { Logger } from "../utils/logger.js";

@Discord()
export class Example {
  @On()
  messageCreate([message]: ArgsOf<"messageCreate">): void {
    console.log(message.author.username, "said:", message.content);
  }

  @On()
  async guildMemberUpdate([oldMember, newMember]: ArgsOf<"guildMemberUpdate">) {
    const logger = new Logger("guildMemberUpdate");
    try {
      if (oldMember.partial) oldMember = await oldMember.fetch();
      if (newMember.partial) newMember = await newMember.fetch();
      const staffService = new StaffService();
      const jobs = await staffService.jobsDb.listJobs();
      const staffRoleIds = jobs.map(j => j.roleId).filter(Boolean);
      const staffRoles = newMember.roles.cache.filter(role => staffRoleIds.includes(role.id));
      logger.info(`Member update: ${newMember.id} | Staff roles: [${[...staffRoles.values()].map(r=>r.name).join(", ")}]`);
      if (staffRoles.size === 0) {
        await staffService.removeStaffMember(newMember.id);
        logger.info(`Removed staff DB entry for ${newMember.id} (no staff roles left)`);
      } else {
        // Pick the highest staff role (by position)
        const highestRole = staffRoles.sort((a, b) => b.position - a.position).first();
        if (highestRole) {
          // Only update the role field in the DB, do not overwrite the Roblox username
          const existing = await staffService.getStaffByUserId(newMember.id);
          if (existing && existing.length > 0) {
            if (existing[0].role !== highestRole.name) {
              await staffService.staffDb.updateStaff(newMember.id, {
                role: highestRole.name,
                updatedAt: new Date(),
              });
              logger.info(`Updated staff DB entry for ${newMember.id} to role ${highestRole.name}`);
            } else {
              logger.info(`No DB update needed for ${newMember.id}; role already set as ${highestRole.name}`);
            }
          } else {
            // If no entry exists, do not create one here (it should be created at application acceptance)
            logger.info(`No staff DB entry for ${newMember.id}; not creating one in event handler.`);
          }
        }
      }
    } catch (error) {
      const logger = new Logger("guildMemberUpdate");
      logger.error("Error in guildMemberUpdate event", error);
    }
  }
}
