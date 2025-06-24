import {
  Discord,
  Slash,
  SlashGroup,
} from 'discordx';
import {
  CommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { RoleTrackingService } from '../../application/services/role-tracking-service';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { logger } from '../../infrastructure/logger';

@Discord()
@SlashGroup({ name: 'role', description: 'Role management and synchronization commands' })
@SlashGroup('role')
export class RoleCommands {
  private guildConfigRepository: GuildConfigRepository;
  private permissionService: PermissionService;
  private roleTrackingService: RoleTrackingService;

  constructor() {
    this.guildConfigRepository = new GuildConfigRepository();
    this.permissionService = new PermissionService(this.guildConfigRepository);
    this.roleTrackingService = new RoleTrackingService();
  }

  private async getPermissionContext(interaction: CommandInteraction): Promise<PermissionContext> {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const userRoles = member?.roles.cache.map(role => role.id) || [];
    const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;

    return {
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      userRoles,
      isGuildOwner,
    };
  }

  private createErrorEmbed(message: string): EmbedBuilder {
    return EmbedUtils.createErrorEmbed('Error', message);
  }


  @Slash({ name: 'sync', description: 'Synchronize Discord roles with staff database' })
  async syncRoles(interaction: CommandInteraction): Promise<void> {
    try {
      if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      // Check permissions - only admin can sync roles
      const context = await this.getPermissionContext(interaction);
      const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');

      if (!hasPermission) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('You need admin permissions to sync roles.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Perform role sync
      await this.roleTrackingService.syncGuildRoles(interaction.guild);

      const embed = EmbedUtils.createAALegalEmbed({
        title: '🔄 Role Synchronization Complete',
        description: 'Successfully synchronized Discord roles with staff database.'
      });

      embed.addFields({
        name: 'Synchronization Details',
        value: [
          '✅ Checked all Discord roles against staff database',
          '✅ Added missing staff records for users with roles',
          '✅ Marked terminated staff who no longer have roles',
          '✅ Updated audit logs for all changes'
        ].join('\n'),
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

      logger.info(`Role sync performed by ${interaction.user.id} in guild ${interaction.guildId}`);

    } catch (error) {
      logger.error('Error in role sync command:', error);
      
      const errorEmbed = this.createErrorEmbed('Failed to synchronize roles. Please try again later.');
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  @Slash({ name: 'status', description: 'View role tracking system status' })
  async roleStatus(interaction: CommandInteraction): Promise<void> {
    try {
      if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      // Check permissions
      const context = await this.getPermissionContext(interaction);
      const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');

      if (!hasPermission) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('You need admin permissions to view role status.')],
          ephemeral: true,
        });
        return;
      }

      // Count Discord roles vs staff records
      const members = await interaction.guild.members.fetch();
      const staffRoles = ['Managing Partner', 'Senior Partner', 'Partner', 'Senior Associate', 'Associate', 'Paralegal'];
      
      let discordStaffCount = 0;
      const roleBreakdown: Record<string, number> = {};

      for (const [, member] of members) {
        const memberStaffRoles = member.roles.cache
          .map(r => r.name)
          .filter(name => staffRoles.includes(name));
        
        if (memberStaffRoles.length > 0) {
          discordStaffCount++;
          
          // Count highest role for each member
          for (const roleName of staffRoles) {
            if (memberStaffRoles.includes(roleName)) {
              roleBreakdown[roleName] = (roleBreakdown[roleName] || 0) + 1;
              break; // Only count highest role
            }
          }
        }
      }

      const embed = EmbedUtils.createAALegalEmbed({
        title: '📊 Role Tracking Status',
        description: 'Current state of role tracking system'
      });

      embed.addFields(
        {
          name: '👥 Discord Staff Members',
          value: `${discordStaffCount} members with staff roles`,
          inline: true
        },
        {
          name: '🔄 Tracking Status',
          value: '✅ Active and monitoring role changes',
          inline: true
        },
        {
          name: '\u200B',
          value: '\u200B',
          inline: true
        }
      );

      // Add role breakdown
      if (Object.keys(roleBreakdown).length > 0) {
        const roleText = Object.entries(roleBreakdown)
          .map(([role, count]) => `${role}: ${count}`)
          .join('\n');
        
        embed.addFields({
          name: '📋 Role Distribution',
          value: roleText,
          inline: false
        });
      }

      embed.addFields({
        name: '⚙️ System Information',
        value: [
          '• Monitors: `guildMemberUpdate` events',
          '• Tracks: Hiring, firing, promotions, demotions',
          '• Logs: All changes to audit log',
          '• Database: Automatic staff record updates'
        ].join('\n'),
        inline: false
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      logger.error('Error in role status command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('Failed to retrieve role status.')],
        ephemeral: true,
      });
    }
  }
}