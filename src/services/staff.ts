/**
 * Staff service helpers for staff role management.
 * @module services/staff
 */
import { GuildMember } from "discord.js";

/**
 * Remove all staff roles from a member before assigning a new one.
 * Staff roles are those containing staff, associate, manager, or partner.
 * @param member - The guild member to update
 * @returns Promise that resolves when roles are removed
 */
export async function removeAllStaffRoles(member: GuildMember): Promise<void> {
  // This function should now use jobs collection to determine staff roles
  const staffRoles = member.roles.cache.filter((r) =>
    r.name.toLowerCase().includes("staff") ||
    r.name.toLowerCase().includes("associate") ||
    r.name.toLowerCase().includes("manager") ||
    r.name.toLowerCase().includes("partner")
  );
  if (staffRoles.size > 0) {
    await member.roles.remove(staffRoles);
  }
}
