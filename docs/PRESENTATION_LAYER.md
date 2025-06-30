# Presentation Layer Documentation

## Overview

The Presentation Layer handles all user interactions through Discord slash commands, providing the interface between users and the application services. This layer is responsible for command parsing, input validation, response formatting, and user experience through Discord's rich interaction model.

## Architecture Principles

### Command-Driven Architecture
- **Slash Commands**: All interactions through Discord slash commands
- **Command Groups**: Logical grouping of related commands
- **Decorators**: Using discordx decorators for clean command definition
- **Separation of Concerns**: Commands only handle presentation logic

### Key Characteristics
- No business logic (delegated to application layer)
- Input parsing and validation
- Response formatting with embeds
- Error handling and user feedback
- Permission checking at command level

## Command Structure

### Command Organization

The bot implements 80+ slash commands organized into 12 command files by domain:

1. **StaffCommands** - Staff management operations
2. **CaseCommands** - Legal case management
3. **JobCommands** - Job posting and recruitment
4. **ApplicationCommands** - Job application processing
5. **RetainerCommands** - Retainer agreement management
6. **FeedbackCommands** - Client feedback system
7. **ReminderCommands** - Reminder management
8. **AdminCommands** - Administrative functions
9. **RoleCommands** - Discord role management
10. **RepairCommands** - System maintenance
11. **MetricsCommands** - Analytics and reporting
12. **InformationCommands** - Information channel management

### Base Command Structure

All command classes follow a consistent pattern:

```typescript
@Discord()
@SlashGroup({ 
  name: 'commandgroup',
  description: 'Group description' 
})
@SlashGroup('commandgroup')
export class CommandGroupCommands {
  // Service dependencies
  private staffService: StaffService;
  private permissionService: PermissionService;
  
  constructor() {
    // Initialize services
    this.staffService = ServiceContainer.get(StaffService);
    this.permissionService = ServiceContainer.get(PermissionService);
  }
  
  @Slash({ 
    name: 'subcommand',
    description: 'Command description' 
  })
  async commandHandler(
    @SlashOption({
      name: 'parameter',
      description: 'Parameter description',
      required: true,
      type: ApplicationCommandOptionType.String
    })
    parameter: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      // 1. Defer reply for long operations
      await interaction.deferReply({ ephemeral: true });
      
      // 2. Get permission context
      const context = await this.getPermissionContext(interaction);
      
      // 3. Check permissions
      if (!await this.permissionService.hasPermission(context, 'required-permission')) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Insufficient permissions')]
        });
        return;
      }
      
      // 4. Parse and validate input
      // 5. Call application service
      // 6. Format and send response
      
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }
  
  // Common utility methods
  private async getPermissionContext(interaction: CommandInteraction): Promise<PermissionContext> {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    return {
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      userRoles: member?.roles.cache.map(role => role.id) || [],
      isGuildOwner: interaction.guild?.ownerId === interaction.user.id,
    };
  }
  
  private createErrorEmbed(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle('❌ Error')
      .setDescription(message)
      .setTimestamp();
  }
}
```

## Command Implementations

### 1. Staff Commands (`src/presentation/commands/staff-commands.ts`)

Manages staff hiring, firing, promotion, and information display.

```typescript
@Discord()
@SlashGroup({ name: 'staff', description: 'Staff management commands' })
@SlashGroup('staff')
export class StaffCommands {
  /**
   * /staff hire - Hire a new staff member
   */
  @Slash({ name: 'hire', description: 'Hire a new staff member' })
  async hireStaff(
    @SlashOption({
      name: 'user',
      description: 'The user to hire',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    
    @SlashOption({
      name: 'role',
      description: 'The role to assign',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice(...Object.values(StaffRole))
    role: StaffRole,
    
    @SlashOption({
      name: 'roblox_username',
      description: 'Roblox username',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    robloxUsername: string,
    
    @SlashOption({
      name: 'reason',
      description: 'Reason for hiring',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    reason: string = 'No reason provided',
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const context = await this.getPermissionContext(interaction);
      
      // Validate inputs
      if (!interaction.guildId) {
        throw new Error('This command must be used in a guild');
      }

      // Call service
      const result = await this.staffService.hireStaff(context, {
        guildId: interaction.guildId,
        userId: user.id,
        robloxUsername,
        role,
        hiredBy: interaction.user.id,
        reason,
      });

      if (result.success && result.staff) {
        // Update Discord role
        const member = await interaction.guild?.members.fetch(user.id);
        const discordRole = await this.getOrCreateStaffRole(interaction.guild!, role);
        await member?.roles.add(discordRole);

        // Success embed
        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Staff Member Hired')
          .setDescription(`Successfully hired ${user} as ${role}`)
          .addFields([
            { name: 'Staff Member', value: `<@${user.id}>`, inline: true },
            { name: 'Role', value: role, inline: true },
            { name: 'Roblox Username', value: robloxUsername, inline: true },
            { name: 'Hired By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason, inline: false },
          ])
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to hire staff member')],
        });
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /staff fire - Terminate a staff member
   */
  @Slash({ name: 'fire', description: 'Fire a staff member' })
  async fireStaff(
    @SlashOption({
      name: 'user',
      description: 'The staff member to fire',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    
    @SlashOption({
      name: 'reason',
      description: 'Reason for termination',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    reason: string,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Confirm action with modal
      const confirmed = await this.confirmAction(
        interaction,
        'Confirm Termination',
        `Are you sure you want to fire ${user.username}? This action cannot be undone.`
      );

      if (!confirmed) {
        await interaction.editReply({
          embeds: [this.createInfoEmbed('Termination cancelled')],
        });
        return;
      }

      const context = await this.getPermissionContext(interaction);
      const result = await this.staffService.fireStaff(context, {
        guildId: interaction.guildId!,
        userId: user.id,
        firedBy: interaction.user.id,
        reason,
      });

      if (result.success) {
        // Remove all Discord staff roles
        const member = await interaction.guild?.members.fetch(user.id);
        const staffRoles = member?.roles.cache.filter(role => 
          Object.values(StaffRole).includes(role.name as StaffRole)
        );
        if (staffRoles) {
          await member?.roles.remove(staffRoles);
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle('👋 Staff Member Terminated')
          .setDescription(`${user} has been terminated from their position`)
          .addFields([
            { name: 'Terminated Staff', value: `<@${user.id}>`, inline: true },
            { name: 'Terminated By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason, inline: false },
          ])
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to fire staff member')],
        });
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /staff promote - Promote a staff member
   */
  @Slash({ name: 'promote', description: 'Promote a staff member' })
  async promoteStaff(
    @SlashOption({
      name: 'user',
      description: 'The staff member to promote',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    
    @SlashOption({
      name: 'new_role',
      description: 'The new role',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice(...Object.values(StaffRole))
    newRole: StaffRole,
    
    @SlashOption({
      name: 'reason',
      description: 'Reason for promotion',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    reason: string = 'Excellent performance',
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      const result = await this.staffService.promoteStaff(context, {
        guildId: interaction.guildId!,
        userId: user.id,
        newRole,
        promotedBy: interaction.user.id,
        reason,
      });

      if (result.success && result.staff) {
        // Update Discord roles
        const member = await interaction.guild?.members.fetch(user.id);
        const oldDiscordRole = member?.roles.cache.find(role => 
          Object.values(StaffRole).includes(role.name as StaffRole)
        );
        if (oldDiscordRole) {
          await member?.roles.remove(oldDiscordRole);
        }
        const newDiscordRole = await this.getOrCreateStaffRole(interaction.guild!, newRole);
        await member?.roles.add(newDiscordRole);

        const embed = new EmbedBuilder()
          .setColor(Colors.Gold)
          .setTitle('🎉 Staff Member Promoted')
          .setDescription(`Congratulations to ${user} on their promotion!`)
          .addFields([
            { name: 'Staff Member', value: `<@${user.id}>`, inline: true },
            { name: 'Previous Role', value: result.previousRole || 'N/A', inline: true },
            { name: 'New Role', value: newRole, inline: true },
            { name: 'Promoted By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason, inline: false },
          ])
          .setTimestamp()
          .setFooter({ text: 'Keep up the excellent work!' });

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to promote staff member')],
        });
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /staff list - List all staff members with filtering
   */
  @Slash({ name: 'list', description: 'List all staff members' })
  async listStaff(
    @SlashOption({
      name: 'role',
      description: 'Filter by role',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice(...Object.values(StaffRole), 'All')
    roleFilter: string = 'All',
    
    @SlashOption({
      name: 'status',
      description: 'Filter by status',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice('Active', 'Terminated', 'All')
    statusFilter: string = 'Active',
    
    @SlashOption({
      name: 'page',
      description: 'Page number',
      required: false,
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
    })
    page: number = 1,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      
      // Build query options
      const options: StaffQueryOptions = {
        page,
        pageSize: 10,
        role: roleFilter !== 'All' ? roleFilter as StaffRole : undefined,
        status: statusFilter === 'All' ? undefined : statusFilter.toLowerCase() as 'active' | 'terminated',
      };

      const result = await this.staffService.getStaffMembers(context, options);

      if (result.items.length === 0) {
        await interaction.editReply({
          embeds: [this.createInfoEmbed('No staff members found matching the criteria')],
        });
        return;
      }

      // Create paginated embed
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('👥 Staff Directory')
        .setDescription(`Showing ${result.items.length} of ${result.total} staff members`)
        .setFooter({ text: `Page ${page} of ${Math.ceil(result.total / options.pageSize)}` });

      // Add staff members
      for (const staff of result.items) {
        const member = await interaction.guild?.members.fetch(staff.userId).catch(() => null);
        const displayName = member?.displayName || 'Unknown User';
        
        embed.addFields({
          name: `${displayName} - ${staff.role}`,
          value: [
            `**User:** <@${staff.userId}>`,
            `**Roblox:** ${staff.robloxUsername}`,
            `**Status:** ${staff.status}`,
            `**Hired:** ${staff.hiredAt.toLocaleDateString()}`,
            staff.status === 'terminated' ? `**Terminated:** ${staff.terminatedAt?.toLocaleDateString()}` : '',
          ].filter(Boolean).join('\n'),
          inline: false,
        });
      }

      // Add pagination buttons
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`staff_list_prev_${page - 1}_${roleFilter}_${statusFilter}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
          new ButtonBuilder()
            .setCustomId(`staff_list_next_${page + 1}_${roleFilter}_${statusFilter}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!result.hasNext)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /staff info - Get detailed information about a staff member
   */
  @Slash({ name: 'info', description: 'Get information about a staff member' })
  async staffInfo(
    @SlashOption({
      name: 'user',
      description: 'The staff member',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      const staff = await this.staffService.getStaffMember(context, user.id);

      if (!staff) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('User is not a staff member')],
        });
        return;
      }

      // Get additional statistics
      const stats = await this.staffService.getStaffStatistics(context, user.id);
      const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setColor(this.getRoleColor(staff.role))
        .setTitle(`Staff Information - ${member?.displayName || user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .addFields([
          { name: 'User', value: `<@${user.id}>`, inline: true },
          { name: 'Role', value: staff.role, inline: true },
          { name: 'Status', value: staff.status, inline: true },
          { name: 'Roblox Username', value: staff.robloxUsername, inline: true },
          { name: 'Hired Date', value: staff.hiredAt.toLocaleDateString(), inline: true },
          { name: 'Hired By', value: `<@${staff.hiredBy}>`, inline: true },
        ]);

      // Add termination info if applicable
      if (staff.status === 'terminated' && staff.terminatedAt) {
        embed.addFields([
          { name: 'Terminated Date', value: staff.terminatedAt.toLocaleDateString(), inline: true },
          { name: 'Terminated By', value: `<@${staff.terminatedBy}>`, inline: true },
          { name: 'Termination Reason', value: staff.terminationReason || 'N/A', inline: false },
        ]);
      }

      // Add statistics
      embed.addFields([
        { name: '\u200B', value: '**📊 Statistics**', inline: false },
        { name: 'Cases Handled', value: stats.casesHandled.toString(), inline: true },
        { name: 'Active Cases', value: stats.activeCases.toString(), inline: true },
        { name: 'Average Rating', value: stats.averageRating ? `${stats.averageRating.toFixed(1)}/5` : 'N/A', inline: true },
      ]);

      // Add promotion history
      if (staff.promotionHistory.length > 0) {
        const promotions = staff.promotionHistory
          .slice(-3) // Last 3 promotions
          .map(p => `${p.fromRole} → ${p.toRole} (${new Date(p.promotedAt).toLocaleDateString()})`)
          .join('\n');
        
        embed.addFields({
          name: '📈 Recent Promotions',
          value: promotions,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /staff hierarchy - Display staff hierarchy
   */
  @Slash({ name: 'hierarchy', description: 'Display staff hierarchy' })
  async staffHierarchy(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      const hierarchy = await this.staffService.getStaffHierarchy(context);

      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('🏢 Staff Hierarchy')
        .setDescription('Current staff structure and available positions')
        .setTimestamp();

      // Add role sections
      for (const role of Object.values(StaffRole)) {
        const staffInRole = hierarchy.hierarchy[role] || [];
        const maxCount = RoleUtils.getRoleMaxCount(role);
        const currentCount = staffInRole.length;
        const availableSlots = maxCount - currentCount;

        const staffList = staffInRole.length > 0
          ? staffInRole.map(s => `<@${s.userId}>`).join('\n')
          : '*No staff in this role*';

        embed.addFields({
          name: `${this.getRoleEmoji(role)} ${role} (${currentCount}/${maxCount})`,
          value: [
            staffList,
            availableSlots > 0 ? `*${availableSlots} position(s) available*` : '*No positions available*',
          ].join('\n'),
          inline: false,
        });
      }

      // Add summary statistics
      embed.addFields({
        name: '📊 Summary',
        value: [
          `**Total Staff:** ${hierarchy.statistics.totalStaff}`,
          `**Active Staff:** ${hierarchy.statistics.activeStaff}`,
          `**Terminated Staff:** ${hierarchy.statistics.totalStaff - hierarchy.statistics.activeStaff}`,
          `**Fill Rate:** ${((hierarchy.statistics.activeStaff / hierarchy.statistics.totalCapacity) * 100).toFixed(1)}%`,
        ].join('\n'),
        inline: false,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /staff sync - Synchronize Discord roles with database
   */
  @Slash({ name: 'sync', description: 'Synchronize Discord roles with database' })
  @Guard(AdminGuard)
  async syncStaff(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const context = await this.getPermissionContext(interaction);
      const result = await this.staffService.syncDiscordRoles(context);

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('🔄 Role Synchronization Complete')
        .setDescription('Discord roles have been synchronized with the database')
        .addFields([
          { name: 'Roles Added', value: result.rolesAdded.toString(), inline: true },
          { name: 'Roles Removed', value: result.rolesRemoved.toString(), inline: true },
          { name: 'Users Updated', value: result.usersUpdated.toString(), inline: true },
        ])
        .setTimestamp();

      if (result.errors.length > 0) {
        embed.addFields({
          name: '⚠️ Errors',
          value: result.errors.slice(0, 5).join('\n'),
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  // Utility Methods

  private async getOrCreateStaffRole(guild: Guild, role: StaffRole): Promise<Role> {
    let discordRole = guild.roles.cache.find(r => r.name === role);
    
    if (!discordRole) {
      discordRole = await guild.roles.create({
        name: role,
        color: this.getRoleColor(role),
        hoist: true,
        mentionable: true,
        reason: `Auto-created staff role: ${role}`,
      });
    }
    
    return discordRole;
  }

  private getRoleColor(role: StaffRole): ColorResolvable {
    const colors: Record<StaffRole, ColorResolvable> = {
      [StaffRole.MANAGING_PARTNER]: Colors.DarkRed,
      [StaffRole.SENIOR_PARTNER]: Colors.Red,
      [StaffRole.JUNIOR_PARTNER]: Colors.Orange,
      [StaffRole.SENIOR_ASSOCIATE]: Colors.Yellow,
      [StaffRole.JUNIOR_ASSOCIATE]: Colors.Blue,
      [StaffRole.PARALEGAL]: Colors.Grey,
    };
    return colors[role] || Colors.Default;
  }

  private getRoleEmoji(role: StaffRole): string {
    const emojis: Record<StaffRole, string> = {
      [StaffRole.MANAGING_PARTNER]: '👑',
      [StaffRole.SENIOR_PARTNER]: '⭐',
      [StaffRole.JUNIOR_PARTNER]: '💫',
      [StaffRole.SENIOR_ASSOCIATE]: '🌟',
      [StaffRole.JUNIOR_ASSOCIATE]: '✨',
      [StaffRole.PARALEGAL]: '📋',
    };
    return emojis[role] || '👤';
  }

  private async confirmAction(
    interaction: CommandInteraction,
    title: string,
    message: string
  ): Promise<boolean> {
    const modal = new ModalBuilder()
      .setCustomId(`confirm_${interaction.id}`)
      .setTitle(title)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('confirmation')
            .setLabel(message)
            .setPlaceholder('Type "CONFIRM" to proceed')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);

    try {
      const submission = await interaction.awaitModalSubmit({
        time: 30000,
        filter: i => i.customId === `confirm_${interaction.id}`,
      });

      const confirmed = submission.fields.getTextInputValue('confirmation').toUpperCase() === 'CONFIRM';
      await submission.deferUpdate();
      return confirmed;
    } catch {
      return false;
    }
  }
}
```

### 2. Case Commands (`src/presentation/commands/case-commands.ts`)

Handles legal case creation, management, and closure.

```typescript
@Discord()
@SlashGroup({ name: 'case', description: 'Case management commands' })
@SlashGroup('case')
export class CaseCommands {
  /**
   * /case create - Create a new legal case
   */
  @Slash({ name: 'create', description: 'Create a new legal case' })
  async createCase(
    @SlashOption({
      name: 'client',
      description: 'The client for this case',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    client: User,
    
    @SlashOption({
      name: 'title',
      description: 'Case title',
      required: true,
      type: ApplicationCommandOptionType.String,
      maxLength: 100,
    })
    title: string,
    
    @SlashOption({
      name: 'description',
      description: 'Detailed case description',
      required: true,
      type: ApplicationCommandOptionType.String,
      maxLength: 1000,
    })
    description: string,
    
    @SlashOption({
      name: 'priority',
      description: 'Case priority',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice(...Object.values(CasePriority))
    priority: CasePriority = CasePriority.MEDIUM,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      
      const result = await this.caseService.createCase(context, {
        guildId: interaction.guildId!,
        clientId: client.id,
        clientUsername: client.username,
        title,
        description,
        priority,
      });

      if (result.success && result.case) {
        const embed = new EmbedBuilder()
          .setColor(this.getPriorityColor(priority))
          .setTitle('📋 New Case Created')
          .setDescription(`Case ${result.case.caseNumber} has been created`)
          .addFields([
            { name: 'Case Number', value: result.case.caseNumber, inline: true },
            { name: 'Client', value: `<@${client.id}>`, inline: true },
            { name: 'Priority', value: priority, inline: true },
            { name: 'Title', value: title, inline: false },
            { name: 'Description', value: description, inline: false },
            { name: 'Channel', value: `<#${result.case.channelId}>`, inline: true },
            { name: 'Status', value: result.case.status, inline: true },
          ])
          .setTimestamp()
          .setFooter({ text: 'Please assign a lawyer to this case' });

        await interaction.editReply({ embeds: [embed] });

        // Send notification to client
        try {
          const clientDM = await client.createDM();
          const clientEmbed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('Your Case Has Been Created')
            .setDescription(`Your legal case has been created and is being reviewed.`)
            .addFields([
              { name: 'Case Number', value: result.case.caseNumber },
              { name: 'Title', value: title },
              { name: 'Priority', value: priority },
              { name: 'Next Steps', value: 'A lawyer will be assigned to your case shortly. You can communicate in your private case channel.' },
            ]);
          
          await clientDM.send({ embeds: [clientEmbed] });
        } catch {
          // Client has DMs disabled
        }
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to create case')],
        });
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /case assign - Assign a lawyer to a case
   */
  @Slash({ name: 'assign', description: 'Assign a lawyer to a case' })
  async assignCase(
    @SlashOption({
      name: 'case_number',
      description: 'Case number',
      required: true,
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
    })
    caseNumber: string,
    
    @SlashOption({
      name: 'lawyer',
      description: 'Lawyer to assign',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    lawyer: User,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      
      // Get case
      const caseData = await this.caseService.getCaseByNumber(context, caseNumber);
      if (!caseData) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Case not found')],
        });
        return;
      }

      // Assign lawyer
      const result = await this.caseService.assignLawyer(
        context,
        caseData._id!.toString(),
        lawyer.id
      );

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Lawyer Assigned')
          .setDescription(`${lawyer} has been assigned to case ${caseNumber}`)
          .addFields([
            { name: 'Case', value: caseNumber, inline: true },
            { name: 'Lawyer', value: `<@${lawyer.id}>`, inline: true },
            { name: 'Assigned By', value: `<@${interaction.user.id}>`, inline: true },
          ])
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Update channel permissions
        if (caseData.channelId) {
          const channel = interaction.guild?.channels.cache.get(caseData.channelId) as TextChannel;
          if (channel) {
            await channel.permissionOverwrites.edit(lawyer.id, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              ManageMessages: true,
            });

            // Send notification in channel
            const notificationEmbed = new EmbedBuilder()
              .setColor(Colors.Blue)
              .setDescription(`${lawyer} has been assigned to this case by <@${interaction.user.id}>`);
            
            await channel.send({ embeds: [notificationEmbed] });
          }
        }
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to assign lawyer')],
        });
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /case setlead - Set lead attorney for a case
   */
  @Slash({ name: 'setlead', description: 'Set lead attorney for a case' })
  async setLeadAttorney(
    @SlashOption({
      name: 'case_number',
      description: 'Case number',
      required: true,
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
    })
    caseNumber: string,
    
    @SlashOption({
      name: 'attorney',
      description: 'Lead attorney',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    attorney: User,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      
      // Get case
      const caseData = await this.caseService.getCaseByNumber(context, caseNumber);
      if (!caseData) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Case not found')],
        });
        return;
      }

      // Check if attorney is assigned to case
      if (!caseData.assignedLawyerIds.includes(attorney.id)) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Attorney must be assigned to the case first')],
        });
        return;
      }

      // Set lead attorney
      const result = await this.caseService.setLeadAttorney(
        context,
        caseData._id!.toString(),
        attorney.id
      );

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Gold)
          .setTitle('👨‍⚖️ Lead Attorney Set')
          .setDescription(`${attorney} is now the lead attorney for case ${caseNumber}`)
          .addFields([
            { name: 'Case', value: caseNumber, inline: true },
            { name: 'Lead Attorney', value: `<@${attorney.id}>`, inline: true },
            { name: 'Set By', value: `<@${interaction.user.id}>`, inline: true },
          ])
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Notify in case channel
        if (caseData.channelId) {
          const channel = interaction.guild?.channels.cache.get(caseData.channelId) as TextChannel;
          if (channel) {
            const notificationEmbed = new EmbedBuilder()
              .setColor(Colors.Gold)
              .setTitle('Lead Attorney Assigned')
              .setDescription(`${attorney} has been designated as the lead attorney for this case`)
              .setTimestamp();
            
            await channel.send({ embeds: [notificationEmbed] });
          }
        }
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to set lead attorney')],
        });
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /case close - Close a case
   */
  @Slash({ name: 'close', description: 'Close a case' })
  async closeCase(
    @SlashOption({
      name: 'case_number',
      description: 'Case number',
      required: true,
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
    })
    caseNumber: string,
    
    @SlashOption({
      name: 'outcome',
      description: 'Case outcome',
      required: true,
      type: ApplicationCommandOptionType.String,
      maxLength: 500,
    })
    outcome: string,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      
      // Get case
      const caseData = await this.caseService.getCaseByNumber(context, caseNumber);
      if (!caseData) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Case not found')],
        });
        return;
      }

      // Close case
      const result = await this.caseService.closeCase(
        context,
        caseData._id!.toString(),
        outcome
      );

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Case Closed')
          .setDescription(`Case ${caseNumber} has been closed`)
          .addFields([
            { name: 'Case Number', value: caseNumber, inline: true },
            { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Status', value: 'Closed', inline: true },
            { name: 'Outcome', value: outcome, inline: false },
          ])
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Archive channel
        if (caseData.channelId) {
          const channelService = new DiscordChannelService(interaction.client);
          await channelService.archiveCaseChannel(
            interaction.guild!,
            caseData.channelId,
            outcome
          );
        }

        // Notify client
        try {
          const client = await interaction.client.users.fetch(caseData.clientId);
          const clientDM = await client.createDM();
          
          const clientEmbed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Your Case Has Been Closed')
            .setDescription(`Case ${caseNumber} has been resolved.`)
            .addFields([
              { name: 'Outcome', value: outcome },
              { name: 'Thank You', value: 'Thank you for choosing Anarchy & Associates for your legal needs.' },
            ])
            .setTimestamp();
          
          await clientDM.send({ embeds: [clientEmbed] });
        } catch {
          // Client has DMs disabled
        }

        // Prompt for feedback
        const feedbackButton = new ButtonBuilder()
          .setCustomId(`feedback_${caseData._id}`)
          .setLabel('Leave Feedback')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐');

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(feedbackButton);

        await interaction.followUp({
          content: `${caseData.clientId}, your case has been closed. We would appreciate your feedback!`,
          components: [row],
        });
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to close case')],
        });
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /case list - List cases with filtering
   */
  @Slash({ name: 'list', description: 'List cases' })
  async listCases(
    @SlashOption({
      name: 'status',
      description: 'Filter by status',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice(...Object.values(CaseStatus), 'All')
    statusFilter: string = 'All',
    
    @SlashOption({
      name: 'priority',
      description: 'Filter by priority',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice(...Object.values(CasePriority), 'All')
    priorityFilter: string = 'All',
    
    @SlashOption({
      name: 'assigned_to',
      description: 'Filter by assigned lawyer',
      required: false,
      type: ApplicationCommandOptionType.User,
    })
    assignedTo: User | null = null,
    
    @SlashOption({
      name: 'page',
      description: 'Page number',
      required: false,
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
    })
    page: number = 1,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      
      // Build search params
      const searchParams: CaseSearchParams = {
        page,
        pageSize: 5,
        status: statusFilter !== 'All' ? statusFilter as CaseStatus : undefined,
        priority: priorityFilter !== 'All' ? priorityFilter as CasePriority : undefined,
        lawyerId: assignedTo?.id,
      };

      const result = await this.caseService.searchCases(context, searchParams);

      if (result.items.length === 0) {
        await interaction.editReply({
          embeds: [this.createInfoEmbed('No cases found matching the criteria')],
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('📋 Case List')
        .setDescription(`Showing ${result.items.length} of ${result.total} cases`)
        .setFooter({ text: `Page ${page} of ${Math.ceil(result.total / searchParams.pageSize)}` });

      for (const caseItem of result.items) {
        const lawyers = caseItem.assignedLawyerIds.length > 0
          ? caseItem.assignedLawyerIds.map(id => `<@${id}>`).join(', ')
          : '*Unassigned*';
        
        const leadAttorney = caseItem.leadAttorneyId
          ? `<@${caseItem.leadAttorneyId}>`
          : '*None*';

        embed.addFields({
          name: `${this.getPriorityEmoji(caseItem.priority)} Case ${caseItem.caseNumber}`,
          value: [
            `**Title:** ${caseItem.title}`,
            `**Client:** <@${caseItem.clientId}>`,
            `**Status:** ${caseItem.status}`,
            `**Priority:** ${caseItem.priority}`,
            `**Assigned Lawyers:** ${lawyers}`,
            `**Lead Attorney:** ${leadAttorney}`,
            `**Created:** ${caseItem.createdAt.toLocaleDateString()}`,
          ].join('\n'),
          inline: false,
        });
      }

      // Pagination buttons
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`case_list_prev_${page - 1}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
          new ButtonBuilder()
            .setCustomId(`case_list_next_${page + 1}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!result.hasNext)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /case info - Get detailed case information
   */
  @Slash({ name: 'info', description: 'Get case information' })
  async caseInfo(
    @SlashOption({
      name: 'case_number',
      description: 'Case number',
      required: true,
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
    })
    caseNumber: string,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = await this.getPermissionContext(interaction);
      const caseData = await this.caseService.getCaseByNumber(context, caseNumber);

      if (!caseData) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Case not found')],
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(this.getPriorityColor(caseData.priority))
        .setTitle(`Case ${caseData.caseNumber}`)
        .setDescription(caseData.title)
        .addFields([
          { name: 'Client', value: `<@${caseData.clientId}>`, inline: true },
          { name: 'Status', value: caseData.status, inline: true },
          { name: 'Priority', value: caseData.priority, inline: true },
          { name: 'Channel', value: caseData.channelId ? `<#${caseData.channelId}>` : '*None*', inline: true },
          { name: 'Created', value: caseData.createdAt.toLocaleDateString(), inline: true },
          { name: 'Lead Attorney', value: caseData.leadAttorneyId ? `<@${caseData.leadAttorneyId}>` : '*None*', inline: true },
        ]);

      // Add assigned lawyers
      if (caseData.assignedLawyerIds.length > 0) {
        embed.addFields({
          name: 'Assigned Lawyers',
          value: caseData.assignedLawyerIds.map(id => `<@${id}>`).join('\n'),
          inline: false,
        });
      }

      // Add description
      embed.addFields({
        name: 'Description',
        value: caseData.description,
        inline: false,
      });

      // Add notes count
      const publicNotes = caseData.notes.filter(n => !n.isInternal).length;
      const internalNotes = caseData.notes.filter(n => n.isInternal).length;
      embed.addFields({
        name: 'Notes',
        value: `${publicNotes} public, ${internalNotes} internal`,
        inline: true,
      });

      // Add documents count
      embed.addFields({
        name: 'Documents',
        value: caseData.documents.length.toString(),
        inline: true,
      });

      // Add outcome if closed
      if (caseData.status === CaseStatus.CLOSED && caseData.outcome) {
        embed.addFields({
          name: 'Outcome',
          value: caseData.outcome,
          inline: false,
        });
        embed.addFields({
          name: 'Closed',
          value: `${caseData.closedAt?.toLocaleDateString()} by <@${caseData.closedBy}>`,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /case addnote - Add a note to a case
   */
  @Slash({ name: 'addnote', description: 'Add a note to a case' })
  async addCaseNote(
    @SlashOption({
      name: 'case_number',
      description: 'Case number',
      required: true,
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
    })
    caseNumber: string,
    
    @SlashOption({
      name: 'note',
      description: 'Note content',
      required: true,
      type: ApplicationCommandOptionType.String,
      maxLength: 1000,
    })
    noteContent: string,
    
    @SlashOption({
      name: 'internal',
      description: 'Internal note (not visible to client)',
      required: false,
      type: ApplicationCommandOptionType.Boolean,
    })
    isInternal: boolean = false,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const context = await this.getPermissionContext(interaction);
      
      // Get case
      const caseData = await this.caseService.getCaseByNumber(context, caseNumber);
      if (!caseData) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Case not found')],
        });
        return;
      }

      // Add note
      const result = await this.caseService.addCaseNote(
        context,
        caseData._id!.toString(),
        {
          content: noteContent,
          isInternal,
          authorId: interaction.user.id,
        }
      );

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Note Added')
          .setDescription(`Note has been added to case ${caseNumber}`)
          .addFields([
            { name: 'Type', value: isInternal ? 'Internal' : 'Public', inline: true },
            { name: 'Author', value: `<@${interaction.user.id}>`, inline: true },
          ])
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Post note in case channel if public
        if (!isInternal && caseData.channelId) {
          const channel = interaction.guild?.channels.cache.get(caseData.channelId) as TextChannel;
          if (channel) {
            const noteEmbed = new EmbedBuilder()
              .setColor(Colors.Blue)
              .setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL(),
              })
              .setDescription(noteContent)
              .setFooter({ text: 'Case Note' })
              .setTimestamp();
            
            await channel.send({ embeds: [noteEmbed] });
          }
        }
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to add note')],
        });
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  // Autocomplete Handlers

  @Slash({ name: 'case', description: 'Case commands' })
  @SlashGroup('case')
  async onAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'case_number') {
      const query = focusedOption.value.toLowerCase();
      const context = await this.getPermissionContext(interaction);
      
      // Search cases
      const cases = await this.caseService.searchCases(context, {
        searchTerm: query,
        page: 1,
        pageSize: 25,
      });

      const choices = cases.items.map(c => ({
        name: `${c.caseNumber} - ${c.title.substring(0, 50)}`,
        value: c.caseNumber,
      }));

      await interaction.respond(choices);
    }
  }

  // Utility Methods

  private getPriorityColor(priority: CasePriority): ColorResolvable {
    const colors: Record<CasePriority, ColorResolvable> = {
      [CasePriority.LOW]: Colors.Grey,
      [CasePriority.MEDIUM]: Colors.Blue,
      [CasePriority.HIGH]: Colors.Orange,
      [CasePriority.URGENT]: Colors.Red,
    };
    return colors[priority];
  }

  private getPriorityEmoji(priority: CasePriority): string {
    const emojis: Record<CasePriority, string> = {
      [CasePriority.LOW]: '🟢',
      [CasePriority.MEDIUM]: '🟡',
      [CasePriority.HIGH]: '🟠',
      [CasePriority.URGENT]: '🔴',
    };
    return emojis[priority];
  }
}
```

### 3. Admin Commands (`src/presentation/commands/admin-commands.ts`)

Administrative commands for server setup and configuration.

```typescript
@Discord()
@SlashGroup({ name: 'admin', description: 'Administrative commands' })
@SlashGroup('admin')
@Guard(AdminGuard)
export class AdminCommands {
  /**
   * /admin setupserver - Complete server setup (DESTRUCTIVE)
   */
  @Slash({ name: 'setupserver', description: '⚠️ COMPLETELY rebuild server (DESTRUCTIVE)' })
  async setupServer(interaction: CommandInteraction): Promise<void> {
    // Show warning modal
    const modal = new ModalBuilder()
      .setCustomId('confirm_server_setup')
      .setTitle('⚠️ DESTRUCTIVE ACTION WARNING')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('confirmation')
            .setLabel('This will DELETE ALL channels, roles, and messages!')
            .setPlaceholder('Type "DELETE EVERYTHING" to confirm')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for server rebuild')
            .setPlaceholder('Explain why this is necessary')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);

    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: i => i.customId === 'confirm_server_setup',
      });

      const confirmation = submission.fields.getTextInputValue('confirmation');
      const reason = submission.fields.getTextInputValue('reason');

      if (confirmation !== 'DELETE EVERYTHING') {
        await submission.reply({
          content: '❌ Confirmation text did not match. Server setup cancelled.',
          ephemeral: true,
        });
        return;
      }

      await submission.deferReply({ ephemeral: false });

      // Log this critical action
      await this.auditLogService.logAction(AuditAction.CONFIG_CHANGED, {
        guildId: interaction.guildId!,
        actorId: interaction.user.id,
        details: {
          action: 'server_setup_initiated',
          reason,
          severity: AuditSeverity.CRITICAL,
        },
      });

      // Execute server setup
      const setupService = new AnarchyServerSetupService();
      const progressEmbed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle('🔧 Server Setup In Progress')
        .setDescription('Please wait while the server is being rebuilt...')
        .addFields([
          { name: 'Status', value: 'Starting...', inline: false },
        ])
        .setTimestamp();

      await submission.editReply({ embeds: [progressEmbed] });

      // Execute setup with progress updates
      let step = 1;
      const updateProgress = async (status: string) => {
        progressEmbed.spliceFields(0, 1, {
          name: `Step ${step++}`,
          value: status,
          inline: false,
        });
        await submission.editReply({ embeds: [progressEmbed] });
      };

      await updateProgress('Backing up current configuration...');
      // Backup logic here

      await updateProgress('Clearing existing channels...');
      await setupService.clearChannels(interaction.guild!);

      await updateProgress('Clearing existing roles...');
      await setupService.clearRoles(interaction.guild!);

      await updateProgress('Creating new roles...');
      await setupService.createRoles(interaction.guild!);

      await updateProgress('Creating channel structure...');
      await setupService.createChannels(interaction.guild!);

      await updateProgress('Setting up permissions...');
      await setupService.setupPermissions(interaction.guild!);

      await updateProgress('Creating job postings...');
      await setupService.createDefaultJobs(interaction.guild!);

      await updateProgress('Finalizing configuration...');
      await setupService.finalizeSetup(interaction.guild!);

      // Success
      const successEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Server Setup Complete')
        .setDescription('The server has been completely rebuilt according to Anarchy & Associates specifications.')
        .addFields([
          { name: 'Channels Created', value: '15+', inline: true },
          { name: 'Roles Created', value: '10+', inline: true },
          { name: 'Jobs Posted', value: '5', inline: true },
          { name: 'Next Steps', value: '1. Assign admin roles\n2. Configure bot permissions\n3. Invite staff members', inline: false },
        ])
        .setTimestamp()
        .setFooter({ text: `Setup completed by ${interaction.user.username}` });

      await submission.editReply({ embeds: [successEmbed] });

      // Log completion
      await this.auditLogService.logAction(AuditAction.CONFIG_CHANGED, {
        guildId: interaction.guildId!,
        actorId: interaction.user.id,
        details: {
          action: 'server_setup_completed',
          success: true,
        },
      });
    } catch (error) {
      logger.error('Server setup failed:', error);
      await interaction.followUp({
        content: '❌ Server setup failed. Please check logs and try again.',
        ephemeral: true,
      });
    }
  }

  /**
   * /admin config - View and update guild configuration
   */
  @Slash({ name: 'config', description: 'View and update guild configuration' })
  async guildConfig(
    @SlashOption({
      name: 'action',
      description: 'Configuration action',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice('view', 'update', 'reset')
    action: string,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const context = await this.getPermissionContext(interaction);
      const config = await this.guildConfigService.getGuildConfig(context.guildId);

      switch (action) {
        case 'view':
          await this.viewConfig(interaction, config);
          break;
        case 'update':
          await this.updateConfig(interaction, config);
          break;
        case 'reset':
          await this.resetConfig(interaction);
          break;
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  private async viewConfig(interaction: CommandInteraction, config: GuildConfig): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('⚙️ Guild Configuration')
      .setDescription('Current configuration settings')
      .addFields([
        {
          name: '📝 Channels',
          value: [
            `Feedback: ${config.feedbackChannelId ? `<#${config.feedbackChannelId}>` : '*Not set*'}`,
            `Retainer: ${config.retainerChannelId ? `<#${config.retainerChannelId}>` : '*Not set*'}`,
            `Applications: ${config.applicationChannelId ? `<#${config.applicationChannelId}>` : '*Not set*'}`,
            `Mod Log: ${config.modlogChannelId ? `<#${config.modlogChannelId}>` : '*Not set*'}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '👥 Roles',
          value: [
            `Client Role: ${config.clientRoleId ? `<@&${config.clientRoleId}>` : '*Not set*'}`,
            `Admin Roles: ${config.adminRoles.length > 0 ? config.adminRoles.map(r => `<@&${r}>`).join(', ') : '*None*'}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🔧 Settings',
          value: [
            `Max Cases per Client: ${config.maxActiveCasesPerClient}`,
            `Retainer Expiration: ${config.retainerExpirationDays} days`,
            `Case Inactivity: ${config.caseInactivityDays} days`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '✨ Features',
          value: [
            `Roblox Integration: ${config.features.robloxIntegration ? '✅' : '❌'}`,
            `Auto Archive: ${config.features.autoArchiveCases ? '✅' : '❌'}`,
            `Client Self-Service: ${config.features.clientSelfService ? '✅' : '❌'}`,
            `Advanced Analytics: ${config.features.advancedAnalytics ? '✅' : '❌'}`,
            `AI Assistance: ${config.features.aiAssistance ? '✅' : '❌'}`,
          ].join('\n'),
          inline: false,
        },
      ])
      .setTimestamp();

    // Add permission breakdown
    const permissionFields = Object.entries(config.permissions).map(([action, roles]) => ({
      name: `Permission: ${action}`,
      value: roles.length > 0 ? roles.map(r => `<@&${r}>`).join(', ') : '*No roles assigned*',
      inline: true,
    }));

    embed.addFields(permissionFields);

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * /admin cleardata - Clear specific data types
   */
  @Slash({ name: 'cleardata', description: 'Clear specific data from the database' })
  async clearData(
    @SlashOption({
      name: 'data_type',
      description: 'Type of data to clear',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice('audit_logs', 'closed_cases', 'terminated_staff', 'old_applications')
    dataType: string,
    
    @SlashOption({
      name: 'older_than_days',
      description: 'Clear data older than X days',
      required: false,
      type: ApplicationCommandOptionType.Integer,
      minValue: 30,
    })
    olderThanDays: number = 90,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Confirm action
      const confirmEmbed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle('⚠️ Confirm Data Deletion')
        .setDescription(`Are you sure you want to clear ${dataType.replace('_', ' ')} older than ${olderThanDays} days?`)
        .addFields([
          { name: 'Data Type', value: dataType, inline: true },
          { name: 'Age Threshold', value: `${olderThanDays} days`, inline: true },
        ])
        .setFooter({ text: 'This action cannot be undone!' });

      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_clear')
        .setLabel('Confirm Deletion')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_clear')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirmButton, cancelButton);

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row],
      });

      const collector = interaction.channel!.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 30000,
        max: 1,
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'cancel_clear') {
          await i.update({
            embeds: [this.createInfoEmbed('Data deletion cancelled')],
            components: [],
          });
          return;
        }

        await i.update({
          embeds: [this.createInfoEmbed('Processing data deletion...')],
          components: [],
        });

        const context = await this.getPermissionContext(interaction);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        let deletedCount = 0;

        switch (dataType) {
          case 'audit_logs':
            // Note: Audit logs should typically not be deleted for compliance
            await i.editReply({
              embeds: [this.createErrorEmbed('Audit logs cannot be deleted for compliance reasons')],
            });
            return;

          case 'closed_cases':
            deletedCount = await this.caseService.archiveOldCases(context, cutoffDate);
            break;

          case 'terminated_staff':
            deletedCount = await this.staffService.purgeTerminatedStaff(context, cutoffDate);
            break;

          case 'old_applications':
            deletedCount = await this.applicationService.purgeOldApplications(context, cutoffDate);
            break;
        }

        const successEmbed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Data Cleared')
          .setDescription(`Successfully cleared ${deletedCount} ${dataType.replace('_', ' ')}`)
          .addFields([
            { name: 'Records Deleted', value: deletedCount.toString(), inline: true },
            { name: 'Older Than', value: `${olderThanDays} days`, inline: true },
          ])
          .setTimestamp();

        await i.editReply({ embeds: [successEmbed] });

        // Log the action
        await this.auditLogService.logAction(AuditAction.CONFIG_CHANGED, {
          guildId: interaction.guildId!,
          actorId: interaction.user.id,
          details: {
            action: 'data_cleared',
            dataType,
            recordsDeleted: deletedCount,
            olderThanDays,
          },
        });
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          interaction.editReply({
            embeds: [this.createInfoEmbed('Data deletion timed out')],
            components: [],
          });
        }
      });
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * /admin permissions - Manage role permissions
   */
  @Slash({ name: 'permissions', description: 'Manage role permissions' })
  async managePermissions(
    @SlashOption({
      name: 'action',
      description: 'Permission action',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice('admin', 'senior-staff', 'case', 'lawyer', 'lead-attorney')
    permissionType: string,
    
    @SlashOption({
      name: 'operation',
      description: 'Operation to perform',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice('add', 'remove', 'view')
    operation: string,
    
    @SlashOption({
      name: 'role',
      description: 'Role to modify',
      required: false,
      type: ApplicationCommandOptionType.Role,
    })
    role: Role | null,
    
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const context = await this.getPermissionContext(interaction);
      const config = await this.guildConfigService.getGuildConfig(context.guildId);

      if (operation === 'view') {
        const currentRoles = config.permissions[permissionType as keyof PermissionConfig] || [];
        const embed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle(`📋 ${permissionType} Permission`)
          .setDescription(
            currentRoles.length > 0
              ? `Roles with this permission:\n${currentRoles.map(r => `<@&${r}>`).join('\n')}`
              : 'No roles have this permission'
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (!role) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Role is required for add/remove operations')],
        });
        return;
      }

      const result = await this.permissionService.updatePermission(
        context,
        permissionType as keyof PermissionConfig,
        operation as 'add' | 'remove',
        role.id
      );

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Permission Updated')
          .setDescription(`Successfully ${operation}ed ${role} ${operation === 'add' ? 'to' : 'from'} ${permissionType} permission`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Log the change
        await this.auditLogService.logAction(
          operation === 'add' ? AuditAction.PERMISSION_GRANTED : AuditAction.PERMISSION_REVOKED,
          {
            guildId: interaction.guildId!,
            actorId: interaction.user.id,
            targetId: role.id,
            targetType: 'role',
            details: {
              permission: permissionType,
              operation,
            },
          }
        );
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to update permission')],
        });
      }
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }
}
```

### 4. Information Commands (`src/presentation/commands/information-commands.ts`)

Manages bot-controlled information messages in Discord channels with rich embed formatting.

```typescript
@Discord()
@SlashGroup({ name: 'info', description: 'Information channel management commands' })
export class InformationCommands {
  /**
   * /info set - Set or update the information message for this channel
   * Opens a modal for rich embed configuration
   */
  @Slash({ name: 'set', description: 'Set or update the information message for this channel' })
  @SlashGroup('info')
  async setInformation(interaction: CommandInteraction): Promise<void> {
    // Permission check: config
    // Modal with fields: title, content, color, thumbnail, footer
    // Creates/updates persisted information message
  }

  /**
   * /info addfield - Add a field to the information message
   * Allows up to 25 fields per Discord embed limit
   */
  @Slash({ name: 'addfield', description: 'Add a field to the information message' })
  @SlashGroup('info')
  async addField(interaction: CommandInteraction): Promise<void> {
    // Requires existing information message
    // Modal with fields: name, value, inline
    // Appends field to existing embed
  }

  /**
   * /info remove - Remove the information message from this channel
   */
  @Slash({ name: 'remove', description: 'Remove the information message from this channel' })
  @SlashGroup('info')
  async removeInformation(interaction: CommandInteraction): Promise<void> {
    // Deletes Discord message and database record
    // Graceful handling if message already deleted
  }

  /**
   * /info list - List all information channels in this server
   */
  @Slash({ name: 'list', description: 'List all information channels in this server' })
  @SlashGroup('info')
  async listInformationChannels(interaction: CommandInteraction): Promise<void> {
    // Shows all configured information channels
    // Displays channel name, title, and last update time
  }

  /**
   * /info sync - Re-sync the information message in this channel
   * Useful if message was accidentally deleted
   */
  @Slash({ name: 'sync', description: 'Re-sync the information message in this channel' })
  @SlashGroup('info')
  async syncInformation(interaction: CommandInteraction): Promise<void> {
    // Recreates message from database if missing
    // Updates existing message with latest data
  }
}
```

**Key Features**:
- Persistent information messages that survive bot restarts
- Rich embed support with all Discord embed features
- Modal-based input for better UX
- Automatic message recreation if deleted
- Per-channel configuration
- Permission-based management (config permission)

### 5. Rules Commands (`src/presentation/commands/rules-commands.ts`)

Manages bot-maintained rules messages with categorized rules and severity levels.

#### Command Structure
- **Group**: `/rules`
- **Permissions**: Requires `config` permission
- **Purpose**: Maintain server rules with structured rule management

#### Available Commands

##### `/rules set`
Creates or updates the rules message in the current channel:
```typescript
// Modal fields:
- title: Rules message title
- content: Introduction/description text
- color: Hex color (optional)
- footer: Footer text (optional)
```

##### `/rules addrule`
Adds a new rule to the rules message:
```typescript
// Modal fields:
- title: Rule title
- description: Full rule description
- category: Rule category (optional)
- severity: low/medium/high/critical (optional)
```

##### `/rules removerule`
Removes a rule from the rules message:
- Shows select menu with existing rules
- Updates message after removal

##### `/rules remove`
Removes the entire rules message from the channel

##### `/rules list`
Lists all rules channels in the server

##### `/rules sync`
Re-syncs the rules message if it was deleted or needs refresh

#### Key Features
- **Categorized Rules**: Rules can be grouped by category
- **Severity Levels**: Rules can have severity (low/medium/high/critical)
- **Auto-numbering**: Optional automatic rule numbering
- **Template System**: Default rules templates for different contexts
- **Rich Embeds**: Rules displayed in formatted Discord embeds
- **Bulk Management**: Easy addition/removal of individual rules

#### Implementation Details
```typescript
@Discord()
@SlashGroup({ name: 'rules', description: 'Rules channel management commands' })
export class RulesCommands {
  // Uses RulesChannelService for business logic
  // Implements modal interactions for rich input
  // Supports automatic rule ordering
  // Handles permission checking via PermissionService
}
```

#### Rule Structure
```typescript
interface Rule {
  id: string;
  title: string;
  description: string;
  category?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  order: number;
}
```

#### Default Templates
The system provides default rule templates:
- **Anarchy Template**: Professional legal firm rules
- **General Template**: Basic Discord server rules

### 6. Other Command Groups

The presentation layer includes additional command groups for:

- **JobCommands**: Job posting creation, management, and application collection
- **ApplicationCommands**: Application review and processing workflows
- **RetainerCommands**: Digital retainer agreement creation and signature
- **FeedbackCommands**: Client feedback submission and analytics
- **ReminderCommands**: Natural language reminder creation and management
- **RoleCommands**: Discord role assignment and synchronization
- **RepairCommands**: System health checks and repairs
- **MetricsCommands**: Performance analytics and reporting

Each follows the same architectural patterns with proper permission checking, input validation, service delegation, and rich Discord embed responses.

## Common Patterns

### Permission Checking

```typescript
private async getPermissionContext(interaction: CommandInteraction): Promise<PermissionContext> {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  return {
    guildId: interaction.guildId!,
    userId: interaction.user.id,
    userRoles: member?.roles.cache.map(role => role.id) || [],
    isGuildOwner: interaction.guild?.ownerId === interaction.user.id,
  };
}

// Usage in commands
const context = await this.getPermissionContext(interaction);
if (!await this.permissionService.hasActionPermission(context, 'required-action')) {
  await interaction.editReply({
    embeds: [this.createErrorEmbed('You do not have permission to perform this action')]
  });
  return;
}
```

### Error Handling

```typescript
private async handleError(interaction: CommandInteraction, error: any): Promise<void> {
  logger.error('Command error:', error);

  const errorEmbed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('❌ An error occurred')
    .setDescription(this.getErrorMessage(error))
    .setTimestamp();

  const method = interaction.deferred ? 'editReply' : 'reply';
  await interaction[method]({
    embeds: [errorEmbed],
    ephemeral: true,
  });
}

private getErrorMessage(error: any): string {
  if (error instanceof BusinessRuleError) {
    return error.message;
  }
  if (error instanceof ValidationError) {
    return error.validationResult.issues
      .map(issue => issue.message)
      .join('\n');
  }
  if (error instanceof PermissionError) {
    return `Missing permission: ${error.requiredPermission}`;
  }
  
  return 'An unexpected error occurred. Please try again later.';
}
```

### Embed Utilities

```typescript
export class EmbedUtils {
  static createAALegalEmbed(options: {
    title: string;
    description?: string;
    color?: ColorResolvable;
  }): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(options.title)
      .setDescription(options.description || '')
      .setColor(options.color || Colors.Blue)
      .setFooter({
        text: 'Anarchy & Associates Legal Firm',
        iconURL: 'https://example.com/logo.png',
      })
      .setTimestamp();
  }

  static createSuccessEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(`✅ ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  static createErrorEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(`❌ ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  static createInfoEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(`ℹ️ ${title}`)
      .setDescription(description)
      .setTimestamp();
  }
}
```

### Pagination

```typescript
export class PaginationHelper {
  static createPaginationButtons(
    currentPage: number,
    hasNext: boolean,
    customIdPrefix: string
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`${customIdPrefix}_prev_${currentPage - 1}`)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 1),
        new ButtonBuilder()
          .setCustomId(`${customIdPrefix}_next_${currentPage + 1}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!hasNext)
      );
  }

  static async handlePaginationInteraction(
    interaction: ButtonInteraction,
    handler: (page: number) => Promise<void>
  ): Promise<void> {
    const [, , pageStr] = interaction.customId.split('_');
    const page = parseInt(pageStr);
    
    await interaction.deferUpdate();
    await handler(page);
  }
}
```

### Modal Interactions

```typescript
export class ModalHelper {
  static createConfirmationModal(
    customId: string,
    title: string,
    confirmText: string = 'Type "CONFIRM" to proceed'
  ): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(customId)
      .setTitle(title)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('confirmation')
            .setLabel('Confirmation')
            .setPlaceholder(confirmText)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
  }

  static async awaitConfirmation(
    interaction: CommandInteraction,
    modal: ModalBuilder,
    expectedText: string = 'CONFIRM'
  ): Promise<boolean> {
    await interaction.showModal(modal);
    
    try {
      const submission = await interaction.awaitModalSubmit({
        time: 60000,
        filter: i => i.customId === modal.data.custom_id,
      });
      
      const confirmed = submission.fields
        .getTextInputValue('confirmation')
        .toUpperCase() === expectedText.toUpperCase();
      
      await submission.deferUpdate();
      return confirmed;
    } catch {
      return false;
    }
  }
}
```

### Autocomplete

```typescript
export class AutocompleteHelper {
  static async handleCaseAutocomplete(
    interaction: AutocompleteInteraction,
    caseService: CaseService
  ): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const context = await this.getPermissionContext(interaction);
    
    const cases = await caseService.searchCases(context, {
      searchTerm: focusedValue,
      page: 1,
      pageSize: 25,
    });

    const choices = cases.items.map(c => ({
      name: `${c.caseNumber} - ${c.title.substring(0, 50)}`,
      value: c.caseNumber,
    }));

    await interaction.respond(choices);
  }

  static async handleStaffAutocomplete(
    interaction: AutocompleteInteraction,
    staffService: StaffService
  ): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const context = await this.getPermissionContext(interaction);
    
    const staff = await staffService.searchStaff(context, {
      searchTerm: focusedValue,
      page: 1,
      pageSize: 25,
    });

    const choices = staff.items.map(s => ({
      name: `${s.robloxUsername} - ${s.role}`,
      value: s.userId,
    }));

    await interaction.respond(choices);
  }
}
```

## Guards and Middleware

### Permission Guards

```typescript
export function AdminGuard(
  interaction: CommandInteraction,
  client: Client,
  next: Next
): Promise<void> {
  const context = {
    guildId: interaction.guildId!,
    userId: interaction.user.id,
    userRoles: interaction.member?.roles.cache.map(r => r.id) || [],
    isGuildOwner: interaction.guild?.ownerId === interaction.user.id,
  };

  const permissionService = ServiceContainer.get(PermissionService);
  
  if (!permissionService.hasAdminPermission(context)) {
    interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle('❌ Access Denied')
          .setDescription('This command requires administrator permissions')
          .setTimestamp()
      ],
      ephemeral: true,
    });
    return;
  }

  return next();
}

export function StaffGuard(minRole?: StaffRole): GuardFunction {
  return async (interaction: CommandInteraction, client: Client, next: Next) => {
    const staffService = ServiceContainer.get(StaffService);
    const context = await getPermissionContext(interaction);
    
    const staff = await staffService.getStaffMember(context, interaction.user.id);
    
    if (!staff || staff.status !== 'active') {
      await interaction.reply({
        embeds: [createErrorEmbed('Access Denied', 'You must be an active staff member')],
        ephemeral: true,
      });
      return;
    }

    if (minRole && RoleUtils.getRoleLevel(staff.role) < RoleUtils.getRoleLevel(minRole)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Insufficient Role', `This command requires ${minRole} or higher`)],
        ephemeral: true,
      });
      return;
    }

    return next();
  };
}
```

### Rate Limiting

```typescript
export function RateLimitGuard(
  points: number = 5,
  duration: number = 60
): GuardFunction {
  const rateLimiter = new RateLimiter({ points, duration });
  
  return async (interaction: CommandInteraction, client: Client, next: Next) => {
    const key = `${interaction.guildId}:${interaction.user.id}`;
    
    try {
      await rateLimiter.consume(key);
      return next();
    } catch (error) {
      const retryAfter = Math.round(error.msBeforeNext / 1000) || duration;
      
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('⏱️ Rate Limited')
            .setDescription(`Please wait ${retryAfter} seconds before using this command again`)
            .setTimestamp()
        ],
        ephemeral: true,
      });
    }
  };
}
```

## Component Interactions

### Button Handlers

```typescript
@ButtonComponent({ id: /^staff_list_/ })
async handleStaffListPagination(interaction: ButtonInteraction): Promise<void> {
  const [, , action, pageStr, role, status] = interaction.customId.split('_');
  const page = parseInt(pageStr);
  
  await interaction.deferUpdate();
  
  // Re-execute list command with new page
  const context = await this.getPermissionContext(interaction);
  const result = await this.staffService.getStaffMembers(context, {
    page,
    pageSize: 10,
    role: role !== 'All' ? role as StaffRole : undefined,
    status: status !== 'All' ? status as 'active' | 'terminated' : undefined,
  });
  
  // Update message with new embed and buttons
  const embed = this.createStaffListEmbed(result);
  const buttons = PaginationHelper.createPaginationButtons(page, result.hasNext, 'staff_list');
  
  await interaction.editReply({ embeds: [embed], components: [buttons] });
}
```

### Select Menu Handlers

```typescript
@SelectMenuComponent({ id: 'role_select' })
async handleRoleSelection(interaction: StringSelectMenuInteraction): Promise<void> {
  const selectedRole = interaction.values[0] as StaffRole;
  
  await interaction.deferReply({ ephemeral: true });
  
  // Process role selection
  const context = await this.getPermissionContext(interaction);
  const result = await this.staffService.updateStaffRole(
    context,
    interaction.user.id,
    selectedRole
  );
  
  if (result.success) {
    await interaction.editReply({
      embeds: [createSuccessEmbed('Role Updated', `Your role has been updated to ${selectedRole}`)],
    });
  } else {
    await interaction.editReply({
      embeds: [createErrorEmbed('Update Failed', result.error)],
    });
  }
}
```

## Testing

### Command Testing

```typescript
describe('StaffCommands', () => {
  let staffCommands: StaffCommands;
  let mockInteraction: CommandInteraction;
  let mockStaffService: jest.Mocked<StaffService>;
  
  beforeEach(() => {
    mockStaffService = createMock<StaffService>();
    ServiceContainer.set(StaffService, mockStaffService);
    
    staffCommands = new StaffCommands();
    mockInteraction = createMockInteraction();
  });
  
  describe('hireStaff', () => {
    it('should hire staff member with valid permissions', async () => {
      // Arrange
      mockStaffService.hireStaff.mockResolvedValue({
        success: true,
        staff: createMockStaff(),
      });
      
      // Act
      await staffCommands.hireStaff(
        createMockUser(),
        StaffRole.PARALEGAL,
        'TestUser123',
        'Test hire',
        mockInteraction
      );
      
      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Staff Member Hired'),
              }),
            }),
          ]),
        })
      );
    });
    
    it('should handle permission errors', async () => {
      // Arrange
      mockStaffService.hireStaff.mockResolvedValue({
        success: false,
        error: 'Insufficient permissions',
      });
      
      // Act
      await staffCommands.hireStaff(
        createMockUser(),
        StaffRole.PARALEGAL,
        'TestUser123',
        'Test hire',
        mockInteraction
      );
      
      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Error'),
                description: 'Insufficient permissions',
              }),
            }),
          ]),
        })
      );
    });
  });
});
```

## Conclusion

The Presentation Layer provides a comprehensive command interface for the Anarchy & Associates Discord bot, handling all user interactions through well-structured slash commands. It maintains clean separation of concerns by delegating business logic to the application layer while focusing on input parsing, response formatting, and Discord-specific interaction patterns. The consistent use of embeds, modals, buttons, and other Discord components creates a rich and intuitive user experience.