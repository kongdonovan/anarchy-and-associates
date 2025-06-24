import { Guild } from 'discord.js';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { Staff } from '../../domain/entities/staff';
import { StaffRole, ROLE_HIERARCHY } from '../../domain/entities/staff-role';
import { AuditAction } from '../../domain/entities/audit-log';
import { logger } from '../../infrastructure/logger';

export interface RoleMapping {
  staffRole: StaffRole;
  discordRoleId: string;
  discordRoleName: string;
}

export class DiscordRoleSyncService {
  private staffRepository: StaffRepository;
  private auditLogRepository: AuditLogRepository;
  private roleMappings: Map<string, RoleMapping[]> = new Map(); // guildId -> mappings

  constructor(
    staffRepository: StaffRepository,
    auditLogRepository: AuditLogRepository
  ) {
    this.staffRepository = staffRepository;
    this.auditLogRepository = auditLogRepository;
  }

  public async initializeGuildRoleMappings(guild: Guild): Promise<void> {
    try {
      const guildId = guild.id;
      const mappings: RoleMapping[] = [];

      // Find Discord roles that match our staff roles
      for (const staffRole of Object.values(StaffRole)) {
        const discordRole = guild.roles.cache.find(
          role => role.name.toLowerCase() === staffRole.toLowerCase() ||
          role.name.toLowerCase().replace(/\s+/g, '_') === staffRole.toLowerCase().replace(/\s+/g, '_')
        );

        if (discordRole) {
          mappings.push({
            staffRole,
            discordRoleId: discordRole.id,
            discordRoleName: discordRole.name,
          });

          // Update the role hierarchy with Discord role ID
          ROLE_HIERARCHY[staffRole].discordRoleId = discordRole.id;
        } else {
          logger.warn(`Discord role not found for staff role: ${staffRole} in guild ${guildId}`);
        }
      }

      this.roleMappings.set(guildId, mappings);
      logger.info(`Initialized role mappings for guild ${guildId}: ${mappings.length} roles mapped`);
    } catch (error) {
      logger.error(`Error initializing role mappings for guild ${guild.id}:`, error);
      throw error;
    }
  }

  public async syncStaffRole(
    guild: Guild,
    staff: Staff,
    actorId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const member = await guild.members.fetch(staff.userId).catch(() => null);
      if (!member) {
        return {
          success: false,
          error: 'Member not found in Discord server',
        };
      }

      const mappings = this.roleMappings.get(guild.id) || [];
      const targetMapping = mappings.find(m => m.staffRole === staff.role);

      if (!targetMapping) {
        return {
          success: false,
          error: `Discord role mapping not found for ${staff.role}`,
        };
      }

      const targetRole = guild.roles.cache.get(targetMapping.discordRoleId);
      if (!targetRole) {
        return {
          success: false,
          error: `Discord role ${targetMapping.discordRoleName} not found`,
        };
      }

      // Remove all other staff roles from the member
      const staffRoleIds = mappings.map(m => m.discordRoleId);
      const rolesToRemove = member.roles.cache.filter(role => 
        staffRoleIds.includes(role.id) && role.id !== targetRole.id
      );

      for (const roleToRemove of rolesToRemove.values()) {
        await member.roles.remove(roleToRemove, `Staff role sync by ${actorId}`);
      }

      // Add the correct staff role
      if (!member.roles.cache.has(targetRole.id)) {
        await member.roles.add(targetRole, `Staff role sync by ${actorId}`);
      }

      // Update staff record with Discord role ID
      await this.staffRepository.update(staff._id!.toHexString(), {
        discordRoleId: targetRole.id,
      });

      // Log the sync action
      await this.auditLogRepository.logAction({
        guildId: guild.id,
        action: AuditAction.ROLE_SYNC_PERFORMED,
        actorId,
        targetId: staff.userId,
        details: {
          metadata: {
            staffRole: staff.role,
            discordRoleId: targetRole.id,
            discordRoleName: targetRole.name,
            rolesRemoved: rolesToRemove.map(r => ({ id: r.id, name: r.name })),
          },
        },
        timestamp: new Date(),
      });

      logger.info(`Role synced for ${staff.userId}: ${staff.role} -> ${targetRole.name} in guild ${guild.id}`);

      return { success: true };
    } catch (error) {
      logger.error(`Error syncing staff role for ${staff.userId}:`, error);
      return {
        success: false,
        error: 'Failed to sync Discord role',
      };
    }
  }

  public async syncAllStaffRoles(
    guild: Guild,
    actorId: string
  ): Promise<{ synced: number; failed: number; errors: string[] }> {
    try {
      const allStaff = await this.staffRepository.findByGuildId(guild.id);
      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const staff of allStaff) {
        const result = await this.syncStaffRole(guild, staff, actorId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`${staff.userId}: ${result.error}`);
        }
      }

      logger.info(`Bulk role sync completed for guild ${guild.id}: ${synced} synced, ${failed} failed`);

      return { synced, failed, errors };
    } catch (error) {
      logger.error(`Error during bulk role sync for guild ${guild.id}:`, error);
      throw error;
    }
  }

  public async removeStaffRoles(
    guild: Guild,
    userId: string,
    actorId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return {
          success: false,
          error: 'Member not found in Discord server',
        };
      }

      const mappings = this.roleMappings.get(guild.id) || [];
      const staffRoleIds = mappings.map(m => m.discordRoleId);
      const rolesToRemove = member.roles.cache.filter(role => 
        staffRoleIds.includes(role.id)
      );

      for (const roleToRemove of rolesToRemove.values()) {
        await member.roles.remove(roleToRemove, `Staff fired by ${actorId}`);
      }

      logger.info(`Removed staff roles from ${userId} in guild ${guild.id}`);

      return { success: true };
    } catch (error) {
      logger.error(`Error removing staff roles from ${userId}:`, error);
      return {
        success: false,
        error: 'Failed to remove Discord roles',
      };
    }
  }

  public getRoleMappings(guildId: string): RoleMapping[] {
    return this.roleMappings.get(guildId) || [];
  }

  public async createMissingRoles(guild: Guild): Promise<{ created: number; errors: string[] }> {
    try {
      let created = 0;
      const errors: string[] = [];

      for (const [staffRole, hierarchy] of Object.entries(ROLE_HIERARCHY)) {
        const existingRole = guild.roles.cache.find(
          role => role.name.toLowerCase() === staffRole.toLowerCase() ||
          role.name.toLowerCase().replace(/\s+/g, '_') === staffRole.toLowerCase().replace(/\s+/g, '_')
        );

        if (!existingRole) {
          try {
            const newRole = await guild.roles.create({
              name: staffRole,
              color: this.getRoleColor(hierarchy.level),
              hoist: true,
              mentionable: true,
              reason: 'Auto-created by Anarchy & Associates bot',
            });

            // Update mapping
            const mappings = this.roleMappings.get(guild.id) || [];
            mappings.push({
              staffRole: staffRole as StaffRole,
              discordRoleId: newRole.id,
              discordRoleName: newRole.name,
            });
            this.roleMappings.set(guild.id, mappings);

            ROLE_HIERARCHY[staffRole as StaffRole].discordRoleId = newRole.id;
            created++;

            logger.info(`Created Discord role: ${staffRole} in guild ${guild.id}`);
          } catch (error) {
            const errorMsg = `Failed to create role ${staffRole}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }
      }

      return { created, errors };
    } catch (error) {
      logger.error(`Error creating missing roles for guild ${guild.id}:`, error);
      throw error;
    }
  }

  private getRoleColor(level: number): number {
    // Color coding based on role level
    const colors: Record<number, number> = {
      6: 0x8B0000, // Managing Partner - Dark Red
      5: 0xFF4500, // Senior Partner - Orange Red
      4: 0xFF8C00, // Junior Partner - Dark Orange
      3: 0x1E90FF, // Senior Associate - Dodger Blue
      2: 0x32CD32, // Junior Associate - Lime Green
      1: 0x9370DB, // Paralegal - Medium Purple
    };

    return colors[level] || 0x808080; // Default gray
  }
}