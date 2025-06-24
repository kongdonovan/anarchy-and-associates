import {
  CommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  ApplicationCommandOptionType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  User,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  CategoryChannel,
  EmbedBuilder
} from 'discord.js';
import { Discord, Slash, SlashOption, SlashGroup, ButtonComponent, ModalComponent, Guard } from 'discordx';
import { CaseService } from '../../application/services/case-service';
import { PermissionService } from '../../application/services/permission-service';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { 
  Case, 
  CaseStatus, 
  CasePriority, 
  CaseResult, 
  CaseCreationRequest,
  CaseAssignmentRequest,
  CaseClosureRequest
} from '../../domain/entities/case';
import { logger } from '../../infrastructure/logger';

@Discord()
@SlashGroup({ description: 'Case management commands', name: 'case' })
@SlashGroup('case')
export class CaseCommands {
  private caseService: CaseService;
  private caseRepository: CaseRepository;

  constructor() {
    const caseRepository = new CaseRepository();
    const caseCounterRepository = new CaseCounterRepository();
    const guildConfigRepository = new GuildConfigRepository();

    this.caseService = new CaseService(caseRepository, caseCounterRepository, guildConfigRepository);
    this.caseRepository = caseRepository;
  }

  @Slash({
    description: 'Request a case review (client-facing)',
    name: 'review'
  })
  async reviewCase(
    @SlashOption({
      description: 'Brief description of your legal matter',
      name: 'details',
      type: ApplicationCommandOptionType.String,
      required: true
    })
    details: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const clientId = interaction.user.id;
      const clientUsername = interaction.user.username;

      // Check if case review category is configured
      const caseReviewCategoryId = await this.caseService.getCaseReviewCategoryId(guildId);
      if (!caseReviewCategoryId) {
        const embed = EmbedUtils.createErrorEmbed(
          'Configuration Required',
          'Case review category must be configured before requesting case reviews. Please contact an administrator.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Create the case
      const caseRequest: CaseCreationRequest = {
        guildId,
        clientId,
        clientUsername,
        title: `Legal consultation request`,
        description: details,
        priority: CasePriority.MEDIUM
      };

      const newCase = await this.caseService.createCase(caseRequest);

      // Create case channel
      await this.createCaseChannel(newCase, interaction);

      // Confirm to client
      const confirmationEmbed = EmbedUtils.createSuccessEmbed(
        'Case Review Requested',
        `Your case review request has been submitted successfully!\n\n` +
        `**Case Number:** \`${newCase.caseNumber}\`\n` +
        `**Description:** ${details}\n\n` +
        `A private case channel has been created where our legal team will review your request. You'll be notified once a lawyer accepts your case.`
      );

      await interaction.reply({ embeds: [confirmationEmbed], ephemeral: true });

    } catch (error) {
      logger.error('Error creating case review:', error);
      
      let errorMessage = 'An unexpected error occurred while submitting your case review request.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      const embed = EmbedUtils.createErrorEmbed(
        'Case Review Failed',
        errorMessage
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({
    description: 'Assign a lawyer to a case (staff only)',
    name: 'assign'
  })
  @Guard(
    async (interaction: CommandInteraction, _client, next) => {
      const guildConfigRepository = new GuildConfigRepository();
      const permissionService = new PermissionService(guildConfigRepository);
      const hasPermission = await permissionService.hasActionPermission(
        {
          guildId: interaction.guildId!,
          userId: interaction.user.id,
          userRoles: [], // Should be populated with actual roles
          isGuildOwner: false
        },
        'case'
      );
      
      if (!hasPermission) {
        await interaction.reply({
          content: '❌ You do not have permission to manage cases. Case permission required.',
          ephemeral: true,
        });
        return;
      }
      
      await next();
    }
  )
  async assignCase(
    @SlashOption({
      description: 'The lawyer to assign to the case',
      name: 'lawyer',
      type: ApplicationCommandOptionType.User,
      required: true
    })
    lawyer: User,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      // This command only works within case channels
      const caseData = await this.getCaseFromChannel(interaction.channelId!);
      if (!caseData) {
        const embed = EmbedUtils.createErrorEmbed(
          'Invalid Channel',
          'This command can only be used within case channels.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const assignmentRequest: CaseAssignmentRequest = {
        caseId: caseData._id!.toString(),
        lawyerId: lawyer.id,
        assignedBy: interaction.user.id
      };

      const updatedCase = await this.caseService.assignLawyer(assignmentRequest);

      const embed = EmbedUtils.createSuccessEmbed(
        'Lawyer Assigned',
        `${lawyer.displayName} has been assigned to case **${updatedCase.caseNumber}**.\n\n` +
        `${updatedCase.leadAttorneyId === lawyer.id ? '**Lead Attorney:** Yes' : '**Lead Attorney:** No'}\n` +
        `**Total Assigned Lawyers:** ${updatedCase.assignedLawyerIds.length}`
      );

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error assigning lawyer to case:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Assignment Failed',
        error instanceof Error ? error.message : 'Failed to assign lawyer to case.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({
    description: 'Close a case with outcome',
    name: 'close'
  })
  async closeCase(
    @SlashOption({
      description: 'Case result',
      name: 'result',
      type: ApplicationCommandOptionType.String,
      required: true
    })
    result: string,
    @SlashOption({
      description: 'Additional notes about the case outcome',
      name: 'notes',
      type: ApplicationCommandOptionType.String,
      required: false
    })
    notes: string | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      // This command works within case channels or staff can specify case ID
      const caseData = await this.getCaseFromChannel(interaction.channelId!);
      if (!caseData) {
        const embed = EmbedUtils.createErrorEmbed(
          'Invalid Channel',
          'This command can only be used within case channels.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check permissions: only client or lead counsel can close cases
      const isClient = caseData.clientId === interaction.user.id;
      const isLeadCounsel = caseData.leadAttorneyId === interaction.user.id;

      if (!isClient && !isLeadCounsel) {
        const embed = EmbedUtils.createErrorEmbed(
          'Permission Denied',
          'Only the client or lead counsel can close cases.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const closureRequest: CaseClosureRequest = {
        caseId: caseData._id!.toString(),
        result: result as CaseResult,
        resultNotes: notes,
        closedBy: interaction.user.id
      };

      const closedCase = await this.caseService.closeCase(closureRequest);

      // Archive the channel
      await this.archiveCaseChannel(closedCase, interaction);

      const embed = EmbedUtils.createSuccessEmbed(
        'Case Closed',
        `Case **${closedCase.caseNumber}** has been closed successfully.\n\n` +
        `**Result:** ${result.charAt(0).toUpperCase() + result.slice(1)}\n` +
        `**Closed by:** ${interaction.user.displayName}\n` +
        `${notes ? `**Notes:** ${notes}` : ''}\n\n` +
        `The case channel will be moved to the archive category.`
      );

      await interaction.reply({ embeds: [embed] });

      // Update the original message containing the case overview to remove the close button
      await this.updateCaseOverviewMessage(closedCase, interaction.guildId!, interaction);

    } catch (error) {
      logger.error('Error closing case:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Case Closure Failed',
        error instanceof Error ? error.message : 'Failed to close case.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({
    description: 'List cases with filtering options',
    name: 'list'
  })
  async listCases(
    @SlashOption({
      description: 'Filter by case status',
      name: 'status',
      type: ApplicationCommandOptionType.String,
      required: false
    })
    status: string | undefined,
    @SlashOption({
      description: 'Filter by assigned lawyer',
      name: 'lawyer',
      type: ApplicationCommandOptionType.User,
      required: false
    })
    lawyer: User | undefined,
    @SlashOption({
      description: 'Search in case titles',
      name: 'search',
      type: ApplicationCommandOptionType.String,
      required: false
    })
    search: string | undefined,
    @SlashOption({
      description: 'Page number (default: 1)',
      name: 'page',
      type: ApplicationCommandOptionType.Integer,
      required: false
    })
    page: number | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const pageSize = 5;
      const currentPage = Math.max(1, page || 1);
      const skip = (currentPage - 1) * pageSize;

      // Build filters
      const filters: any = { guildId };
      if (status) filters.status = status as CaseStatus;
      if (lawyer) filters.assignedLawyerId = lawyer.id;
      if (search) filters.title = search;

      // Get cases with pagination
      const cases = await this.caseService.searchCases(
        filters,
        { field: 'createdAt', direction: 'desc' },
        { limit: pageSize, skip }
      );

      // Get total count for pagination info
      const allCases = await this.caseService.searchCases(filters);
      const totalPages = Math.ceil(allCases.length / pageSize);

      const embed = EmbedUtils.createAALegalEmbed({
        title: '📋 Case List',
        color: 'info'
      });

      embed.addFields({
        name: '📊 Summary',
        value: `**Total Cases:** ${allCases.length}\n**Page:** ${currentPage}/${totalPages || 1}`,
        inline: true
      });

      if (cases.length > 0) {
        const caseList = cases.map(c => {
          const statusEmoji = {
            [CaseStatus.PENDING]: '⏳',
            [CaseStatus.OPEN]: '🟢',
            [CaseStatus.IN_PROGRESS]: '🔄',
            [CaseStatus.CLOSED]: '✅'
          }[c.status];

          const leadAttorney = c.leadAttorneyId ? `<@${c.leadAttorneyId}>` : 'Unassigned';
          
          return `${statusEmoji} **${c.caseNumber}**\n` +
                 `**Client:** <@${c.clientId}>\n` +
                 `**Lead Attorney:** ${leadAttorney}\n` +
                 `**Title:** ${c.title}\n` +
                 `**Created:** ${c.createdAt?.toDateString() || 'Unknown'}`;
        }).join('\n\n');

        EmbedUtils.addFieldSafe(embed, '🗂️ Cases', caseList);
      } else {
        embed.addFields({
          name: 'No Cases Found',
          value: 'No cases match the specified criteria.',
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing cases:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'List Failed',
        'An error occurred while retrieving the case list.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({
    description: 'View detailed case information with tabbed interface',
    name: 'info'
  })
  async caseInfo(
    @SlashOption({
      description: 'Case number (optional if used in case channel)',
      name: 'casenumber',
      type: ApplicationCommandOptionType.String,
      required: false
    })
    caseNumber: string | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      let caseData: Case | null = null;

      if (caseNumber) {
        // Find case by case number
        caseData = await this.caseService.getCaseByCaseNumber(caseNumber);
      } else {
        // Try to get case from current channel
        caseData = await this.getCaseFromChannel(interaction.channelId!);
      }

      if (!caseData) {
        const embed = EmbedUtils.createErrorEmbed(
          'Case Not Found',
          caseNumber 
            ? `Case **${caseNumber}** not found.`
            : 'No case found. Please specify a case number or use this command in a case channel.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Show overview tab by default
      await this.showCaseInfoTab(interaction, caseData, 'overview');

    } catch (error) {
      logger.error('Error displaying case info:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Info Failed',
        'An error occurred while retrieving case information.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async showCaseInfoTab(
    interaction: CommandInteraction | ButtonInteraction, 
    caseData: Case, 
    tab: 'overview' | 'documents' | 'notes' | 'timeline'
  ): Promise<void> {
    const embed = EmbedUtils.createAALegalEmbed({
      title: `📋 Case Information - ${caseData.caseNumber}`,
      color: 'info'
    });

    // Create tab buttons
    const overviewButton = new ButtonBuilder()
      .setCustomId(`case_tab_overview_${caseData._id}`)
      .setLabel('Overview')
      .setStyle(tab === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📋');

    const documentsButton = new ButtonBuilder()
      .setCustomId(`case_tab_documents_${caseData._id}`)
      .setLabel('Documents')
      .setStyle(tab === 'documents' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📄');

    const notesButton = new ButtonBuilder()
      .setCustomId(`case_tab_notes_${caseData._id}`)
      .setLabel('Notes')
      .setStyle(tab === 'notes' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📝');

    const timelineButton = new ButtonBuilder()
      .setCustomId(`case_tab_timeline_${caseData._id}`)
      .setLabel('Timeline')
      .setStyle(tab === 'timeline' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('⏰');

    const tabRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(overviewButton, documentsButton, notesButton, timelineButton);

    // Build content based on selected tab
    switch (tab) {
      case 'overview':
        this.buildOverviewTab(embed, caseData);
        break;
      case 'documents':
        this.buildDocumentsTab(embed, caseData);
        break;
      case 'notes':
        this.buildNotesTab(embed, caseData);
        break;
      case 'timeline':
        this.buildTimelineTab(embed, caseData);
        break;
    }

    const components = [tabRow];

    if (interaction instanceof CommandInteraction) {
      await interaction.reply({ embeds: [embed], components });
    } else {
      await interaction.update({ embeds: [embed], components });
    }
  }

  private buildOverviewTab(embed: EmbedBuilder, caseData: Case): void {
    const statusEmoji = {
      [CaseStatus.PENDING]: '⏳',
      [CaseStatus.OPEN]: '🟢',
      [CaseStatus.IN_PROGRESS]: '🔄',
      [CaseStatus.CLOSED]: '✅'
    }[caseData.status];

    const priorityEmoji = {
      [CasePriority.LOW]: '🟢',
      [CasePriority.MEDIUM]: '🟡',
      [CasePriority.HIGH]: '🟠',
      [CasePriority.URGENT]: '🔴'
    }[caseData.priority];

    embed.addFields(
      { name: '🆔 Case Number', value: caseData.caseNumber, inline: true },
      { name: '👤 Client', value: `<@${caseData.clientId}>`, inline: true },
      { name: `${statusEmoji} Status`, value: caseData.status.charAt(0).toUpperCase() + caseData.status.slice(1), inline: true },
      { name: `${priorityEmoji} Priority`, value: caseData.priority.charAt(0).toUpperCase() + caseData.priority.slice(1), inline: true },
      { name: '📅 Created', value: caseData.createdAt?.toDateString() || 'Unknown', inline: true },
      { name: '⚖️ Lead Attorney', value: caseData.leadAttorneyId ? `<@${caseData.leadAttorneyId}>` : 'Unassigned', inline: true }
    );

    if (caseData.assignedLawyerIds.length > 0) {
      const assignedLawyers = caseData.assignedLawyerIds.map(id => `<@${id}>`).join(', ');
      embed.addFields({ name: '👥 Assigned Lawyers', value: assignedLawyers, inline: false });
    }

    embed.addFields({ name: '📝 Description', value: caseData.description, inline: false });

    if (caseData.status === CaseStatus.CLOSED && caseData.result) {
      const resultEmoji = {
        [CaseResult.WIN]: '🏆',
        [CaseResult.LOSS]: '❌',
        [CaseResult.SETTLEMENT]: '🤝',
        [CaseResult.DISMISSED]: '🚫',
        [CaseResult.WITHDRAWN]: '↩️'
      }[caseData.result];

      embed.addFields(
        { name: `${resultEmoji} Result`, value: caseData.result.charAt(0).toUpperCase() + caseData.result.slice(1), inline: true },
        { name: '📅 Closed', value: caseData.closedAt?.toDateString() || 'Unknown', inline: true },
        { name: '👨‍⚖️ Closed By', value: caseData.closedBy ? `<@${caseData.closedBy}>` : 'Unknown', inline: true }
      );

      if (caseData.resultNotes) {
        EmbedUtils.addFieldSafe(embed, '📄 Closure Notes', caseData.resultNotes);
      }
    }
  }

  private buildDocumentsTab(embed: EmbedBuilder, caseData: Case): void {
    embed.addFields({ name: '📄 Documents', value: `Case: ${caseData.caseNumber}`, inline: false });

    if (caseData.documents.length > 0) {
      const documentsList = caseData.documents
        .slice(0, 10) // Limit to 10 documents
        .map(doc => 
          `**${doc.title}**\n` +
          `Created by: <@${doc.createdBy}>\n` +
          `Date: ${doc.createdAt.toDateString()}\n` +
          `Content: ${doc.content.length > 100 ? doc.content.substring(0, 97) + '...' : doc.content}`
        )
        .join('\n\n');

      EmbedUtils.addFieldSafe(embed, '📋 Document List', documentsList);

      if (caseData.documents.length > 10) {
        embed.addFields({ 
          name: 'Note', 
          value: `Showing first 10 of ${caseData.documents.length} documents.`, 
          inline: false 
        });
      }
    } else {
      embed.addFields({ name: 'No Documents', value: 'No documents have been added to this case yet.', inline: false });
    }
  }

  private buildNotesTab(embed: EmbedBuilder, caseData: Case): void {
    embed.addFields({ name: '📝 Notes', value: `Case: ${caseData.caseNumber}`, inline: false });

    if (caseData.notes.length > 0) {
      const notesList = caseData.notes
        .slice(0, 10) // Limit to 10 notes
        .map(note => {
          const typeEmoji = note.isInternal ? '🔒' : '📝';
          return `${typeEmoji} **${note.isInternal ? 'Internal' : 'General'} Note**\n` +
                 `By: <@${note.createdBy}>\n` +
                 `Date: ${note.createdAt.toDateString()}\n` +
                 `Content: ${note.content.length > 150 ? note.content.substring(0, 147) + '...' : note.content}`;
        })
        .join('\n\n');

      EmbedUtils.addFieldSafe(embed, '📋 Notes List', notesList);

      if (caseData.notes.length > 10) {
        embed.addFields({ 
          name: 'Note', 
          value: `Showing first 10 of ${caseData.notes.length} notes.`, 
          inline: false 
        });
      }
    } else {
      embed.addFields({ name: 'No Notes', value: 'No notes have been added to this case yet.', inline: false });
    }
  }

  private buildTimelineTab(embed: EmbedBuilder, caseData: Case): void {
    embed.addFields({ name: '⏰ Timeline', value: `Case: ${caseData.caseNumber}`, inline: false });

    const timelineEvents: { date: Date; event: string }[] = [];

    // Add case creation
    if (caseData.createdAt) {
      timelineEvents.push({
        date: caseData.createdAt,
        event: `📋 Case created by <@${caseData.clientId}>`
      });
    }

    // Add lead attorney assignment
    if (caseData.leadAttorneyId && caseData.status !== CaseStatus.PENDING) {
      timelineEvents.push({
        date: caseData.updatedAt || caseData.createdAt || new Date(),
        event: `⚖️ Lead attorney assigned: <@${caseData.leadAttorneyId}>`
      });
    }

    // Add document additions
    caseData.documents.forEach(doc => {
      timelineEvents.push({
        date: doc.createdAt,
        event: `📄 Document added: "${doc.title}" by <@${doc.createdBy}>`
      });
    });

    // Add notes (non-internal only for timeline)
    caseData.notes.filter(note => !note.isInternal).forEach(note => {
      timelineEvents.push({
        date: note.createdAt,
        event: `📝 Note added by <@${note.createdBy}>`
      });
    });

    // Add case closure
    if (caseData.status === CaseStatus.CLOSED && caseData.closedAt) {
      const resultEmoji = caseData.result ? {
        [CaseResult.WIN]: '🏆',
        [CaseResult.LOSS]: '❌',
        [CaseResult.SETTLEMENT]: '🤝',
        [CaseResult.DISMISSED]: '🚫',
        [CaseResult.WITHDRAWN]: '↩️'
      }[caseData.result] : '✅';

      timelineEvents.push({
        date: caseData.closedAt,
        event: `${resultEmoji} Case closed${caseData.result ? ` (${caseData.result})` : ''} by <@${caseData.closedBy}>`
      });
    }

    // Sort by date and display
    timelineEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (timelineEvents.length > 0) {
      const timelineText = timelineEvents
        .slice(0, 15) // Limit to 15 events
        .map(event => `**${event.date.toDateString()}** - ${event.event}`)
        .join('\n');

      EmbedUtils.addFieldSafe(embed, '📅 Events', timelineText);

      if (timelineEvents.length > 15) {
        embed.addFields({ 
          name: 'Note', 
          value: `Showing first 15 of ${timelineEvents.length} timeline events.`, 
          inline: false 
        });
      }
    } else {
      embed.addFields({ name: 'No Events', value: 'No timeline events found for this case.', inline: false });
    }
  }

  @ButtonComponent({ id: /^case_tab_/ })
  async handleTabNavigation(interaction: ButtonInteraction): Promise<void> {
    try {
      // Parse the button custom ID: case_tab_{tab}_{caseId}
      const parts = interaction.customId.split('_');
      const tab = parts[2] as 'overview' | 'documents' | 'notes' | 'timeline';
      const caseId = parts[3];

      if (!caseId) {
        const embed = EmbedUtils.createErrorEmbed(
          'Invalid Request',
          'Unable to parse case information from button interaction.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const caseData = await this.caseService.getCaseById(caseId);
      if (!caseData) {
        const embed = EmbedUtils.createErrorEmbed(
          'Case Not Found',
          'The case information could not be retrieved.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      await this.showCaseInfoTab(interaction, caseData, tab);

    } catch (error) {
      logger.error('Error handling tab navigation:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Navigation Failed',
        'An error occurred while switching tabs.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async createCaseChannel(caseData: Case, interaction: CommandInteraction): Promise<void> {
    try {
      const guild = await interaction.client.guilds.fetch(caseData.guildId);
      const caseReviewCategoryId = await this.caseService.getCaseReviewCategoryId(caseData.guildId);
      
      if (!caseReviewCategoryId) {
        throw new Error('Case review category not configured');
      }

      const category = await guild.channels.fetch(caseReviewCategoryId) as CategoryChannel;
      if (!category) {
        throw new Error('Case review category not found');
      }

      const channelName = this.caseService.generateChannelName(caseData.caseNumber);
      
      // Create channel with proper permissions
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: caseData.clientId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }
          // Staff permissions would be added here based on role configuration
        ]
      });

      // Update case with channel ID
      await this.caseService.updateCase({
        caseId: caseData._id!.toString(),
        status: CaseStatus.PENDING,
        channelId: channel.id
      });

      // Send case overview with accept/decline buttons
      await this.sendCaseOverview(caseData, channel);

      logger.info('Case channel created', {
        caseId: caseData._id,
        channelId: channel.id,
        channelName
      });

    } catch (error) {
      logger.error('Error creating case channel:', error);
      throw error;
    }
  }

  private async sendCaseOverview(caseData: Case, channel: TextChannel): Promise<void> {
    const embed = EmbedUtils.createAALegalEmbed({
      title: '📋 New Case Review Request',
      color: 'info'
    });

    embed.addFields(
      { name: '📋 Case Number', value: caseData.caseNumber, inline: true },
      { name: '👤 Client', value: `<@${caseData.clientId}>`, inline: true },
      { name: '📅 Requested', value: caseData.createdAt?.toDateString() || 'Unknown', inline: true },
      { name: '📝 Description', value: caseData.description, inline: false },
      { name: '⚖️ Status', value: 'Pending Review', inline: true },
      { name: '🏷️ Priority', value: caseData.priority.charAt(0).toUpperCase() + caseData.priority.slice(1), inline: true }
    );

    // Create accept/decline buttons
    const acceptButton = new ButtonBuilder()
      .setCustomId(`case_accept_${caseData._id}`)
      .setLabel('Accept Case')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');

    const declineButton = new ButtonBuilder()
      .setCustomId(`case_decline_${caseData._id}`)
      .setLabel('Decline Case')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌');

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(acceptButton, declineButton);

    await channel.send({
      embeds: [embed],
      components: [row]
    });
  }

  @ButtonComponent({ id: /^case_accept_/ })
  async handleCaseAccept(interaction: ButtonInteraction): Promise<void> {
    try {
      const caseId = interaction.customId.replace('case_accept_', '');
      
      // Accept the case and assign the accepting user as lead attorney
      const acceptedCase = await this.caseService.acceptCase(caseId, interaction.user.id);

      // Update the original message
      const embed = EmbedUtils.createSuccessEmbed(
        '✅ Case Accepted',
        `This case has been accepted by ${interaction.user.displayName}.\n\n` +
        `**Case Number:** ${acceptedCase.caseNumber}\n` +
        `**Lead Attorney:** <@${acceptedCase.leadAttorneyId}>\n` +
        `**Status:** Open\n\n` +
        `The case is now active and ready for legal work.`
      );

      // Replace with close case button
      const closeButton = new ButtonBuilder()
        .setCustomId(`case_close_${acceptedCase._id}`)
        .setLabel('Close Case')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒');

      const closeRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(closeButton);

      await interaction.update({
        embeds: [embed],
        components: [closeRow]
      });

    } catch (error) {
      logger.error('Error accepting case:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Accept Failed',
        error instanceof Error ? error.message : 'Failed to accept case.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @ButtonComponent({ id: /^case_close_/ })
  async handleCaseClose(interaction: ButtonInteraction): Promise<void> {
    try {
      const caseId = interaction.customId.replace('case_close_', '');
      
      // Show modal for case closure
      const modal = new ModalBuilder()
        .setCustomId(`case_close_modal_${caseId}`)
        .setTitle('Close Case');

      const resultInput = new TextInputBuilder()
        .setCustomId('case_result')
        .setLabel('Case Result')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('win, loss, settlement, dismissed, withdrawn')
        .setRequired(true)
        .setMaxLength(20);

      const notesInput = new TextInputBuilder()
        .setCustomId('case_notes')
        .setLabel('Closure Notes (Optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Any additional notes about the case outcome...')
        .setRequired(false)
        .setMaxLength(1000);

      const resultRow = new ActionRowBuilder<TextInputBuilder>()
        .addComponents(resultInput);
      
      const notesRow = new ActionRowBuilder<TextInputBuilder>()
        .addComponents(notesInput);

      modal.addComponents(resultRow, notesRow);

      await interaction.showModal(modal);

    } catch (error) {
      logger.error('Error showing case close modal:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Close Failed',
        'An error occurred while preparing the case closure form.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @ButtonComponent({ id: /^case_decline_/ })
  async handleCaseDecline(interaction: ButtonInteraction): Promise<void> {
    try {
      const caseId = interaction.customId.replace('case_decline_', '');
      
      // Show modal for decline reason
      const modal = new ModalBuilder()
        .setCustomId(`case_decline_reason_${caseId}`)
        .setTitle('Decline Case');

      const reasonInput = new TextInputBuilder()
        .setCustomId('decline_reason')
        .setLabel('Reason for declining (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Provide feedback for the client...')
        .setRequired(false)
        .setMaxLength(1000);

      const row = new ActionRowBuilder<TextInputBuilder>()
        .addComponents(reasonInput);

      modal.addComponents(row);

      await interaction.showModal(modal);

    } catch (error) {
      logger.error('Error showing decline modal:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Decline Failed',
        'An error occurred while declining the case.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @ModalComponent({ id: /^case_close_modal_/ })
  async handleCaseCloseModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const caseId = interaction.customId.replace('case_close_modal_', '');
      const result = interaction.fields.getTextInputValue('case_result').toLowerCase();
      const notes = interaction.fields.getTextInputValue('case_notes') || undefined;
      
      // Validate result
      const validResults = ['win', 'loss', 'settlement', 'dismissed', 'withdrawn'];
      if (!validResults.includes(result)) {
        const embed = EmbedUtils.createErrorEmbed(
          'Invalid Result',
          `Please enter one of: ${validResults.join(', ')}`
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check permissions - only client and lead counsel
      const caseData = await this.caseService.getCaseById(caseId);
      if (!caseData) {
        const embed = EmbedUtils.createErrorEmbed(
          'Case Not Found',
          'The case could not be found.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const isClient = interaction.user.id === caseData.clientId;
      const isLeadCounsel = interaction.user.id === caseData.leadAttorneyId;
      
      if (!isClient && !isLeadCounsel) {
        const embed = EmbedUtils.createErrorEmbed(
          'Permission Denied',
          'Only the client or lead counsel can close this case.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const closureRequest: CaseClosureRequest = {
        caseId: caseId,
        result: result as CaseResult,
        resultNotes: notes,
        closedBy: interaction.user.id
      };

      const closedCase = await this.caseService.closeCase(closureRequest);

      // Archive the channel
      await this.archiveCaseChannel(closedCase, interaction);

      const embed = EmbedUtils.createSuccessEmbed(
        'Case Closed',
        `Case **${closedCase.caseNumber}** has been closed successfully.\n\n` +
        `**Result:** ${result.charAt(0).toUpperCase() + result.slice(1)}\n` +
        `**Closed by:** ${interaction.user.displayName}\n` +
        `${notes ? `**Notes:** ${notes}` : ''}\n\n` +
        `The case channel will be moved to the archive category.`
      );

      await interaction.reply({ embeds: [embed] });

      // Update the original message containing the case overview to remove the close button
      await this.updateCaseOverviewMessage(closedCase, interaction.guildId!, interaction);

    } catch (error) {
      logger.error('Error processing case close modal:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Close Failed',
        error instanceof Error ? error.message : 'Failed to close case.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @ModalComponent({ id: /^case_decline_reason_/ })
  async handleDeclineReason(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const caseId = interaction.customId.replace('case_decline_reason_', '');
      const reason = interaction.fields.getTextInputValue('decline_reason') || 'No reason provided';
      
      // Decline the case
      const declinedCase = await this.caseService.declineCase(caseId, interaction.user.id, reason);

      const embed = EmbedUtils.createErrorEmbed(
        '❌ Case Declined',
        `This case has been declined by ${interaction.user.displayName}.\n\n` +
        `**Case Number:** ${declinedCase.caseNumber}\n` +
        `**Reason:** ${reason}\n\n` +
        `The client has been notified of the decision.`
      );

      // Disable buttons
      const disabledAccept = new ButtonBuilder()
        .setCustomId('disabled_accept')
        .setLabel('Accept')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const disabledDecline = new ButtonBuilder()
        .setCustomId('disabled_decline')
        .setLabel('Declined')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true);

      const disabledRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(disabledAccept, disabledDecline);

      await interaction.reply({
        embeds: [embed],
        components: [disabledRow]
      });

      // Archive the channel since case is declined
      await this.archiveCaseChannel(declinedCase, interaction);

    } catch (error) {
      logger.error('Error processing case decline:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Decline Failed',
        error instanceof Error ? error.message : 'Failed to decline case.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async archiveCaseChannel(caseData: Case, interaction: CommandInteraction | ModalSubmitInteraction | ButtonInteraction): Promise<void> {
    try {
      const guild = await interaction.client.guilds.fetch(caseData.guildId);
      const archiveCategoryId = await this.caseService.getCaseArchiveCategoryId(caseData.guildId);
      
      if (!archiveCategoryId) {
        logger.warn('Archive category not configured, channel will remain in current category', {
          caseId: caseData._id,
          guildId: caseData.guildId
        });
        return;
      }

      const archiveCategory = await guild.channels.fetch(archiveCategoryId) as CategoryChannel;
      if (!archiveCategory) {
        logger.warn('Archive category not found', {
          archiveCategoryId,
          guildId: caseData.guildId
        });
        return;
      }

      const channel = await guild.channels.fetch(interaction.channelId!) as TextChannel;
      if (channel) {
        await channel.setParent(archiveCategory, { reason: `Case ${caseData.caseNumber} closed` });
        logger.info('Case channel archived', {
          caseId: caseData._id,
          channelId: channel.id,
          archiveCategoryId
        });
      }

    } catch (error) {
      logger.error('Error archiving case channel:', error);
      // Don't throw error as this shouldn't block case closure
    }
  }

  private async getCaseFromChannel(channelId: string): Promise<Case | null> {
    // This would typically involve parsing the channel name or maintaining a mapping
    // For now, we'll implement a simple approach by checking all cases for this channel
    // In production, you might want to maintain a channel -> case mapping
    try {
      // Find case by channel ID
      const cases = await this.caseRepository.findByFilters({ channelId });
      return cases.length > 0 ? (cases[0] || null) : null;
    } catch {
      return null;
    }
  }

  private async updateCaseOverviewMessage(closedCase: Case, guildId: string, interaction: CommandInteraction | ModalSubmitInteraction): Promise<void> {
    try {
      const guild = await interaction.client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(closedCase.channelId!) as TextChannel;
      
      if (!channel) {
        logger.warn('Could not find case channel to update overview message', {
          caseId: closedCase._id,
          channelId: closedCase.channelId
        });
        return;
      }

      // Fetch recent messages to find the one with the close button
      const messages = await channel.messages.fetch({ limit: 50 });
      const caseOverviewMessage = messages.find(msg => 
        msg.author.id === interaction.client.user?.id &&
        msg.components.length > 0 &&
        msg.components[0] &&
        'components' in msg.components[0] &&
        msg.components[0].components.some((component: any) => 
          component.customId?.startsWith('case_close_')
        )
      );

      if (!caseOverviewMessage) {
        logger.warn('Could not find case overview message to update', {
          caseId: closedCase._id,
          channelId: closedCase.channelId
        });
        return;
      }

      // Create updated embed showing the case is closed
      const embed = EmbedUtils.createAALegalEmbed({
        title: `🔒 Case Closed: ${closedCase.caseNumber}`,
        description: `**Client:** <@${closedCase.clientId}>\n` +
                    `**Lead Attorney:** <@${closedCase.leadAttorneyId}>\n` +
                    `**Status:** Closed\n` +
                    `**Result:** ${closedCase.result ? closedCase.result.charAt(0).toUpperCase() + closedCase.result.slice(1) : 'Unknown'}\n` +
                    `**Closed Date:** ${closedCase.closedAt ? new Date(closedCase.closedAt).toLocaleDateString() : 'Unknown'}\n` +
                    `**Closed By:** <@${closedCase.closedBy}>\n\n` +
                    `${closedCase.resultNotes ? `**Notes:** ${closedCase.resultNotes}\n\n` : ''}` +
                    `This case has been completed and archived.`
      });

      // Update the message without any buttons
      await caseOverviewMessage.edit({
        embeds: [embed],
        components: []
      });

      logger.info('Case overview message updated successfully', {
        caseId: closedCase._id,
        messageId: caseOverviewMessage.id
      });

    } catch (error) {
      logger.error('Error updating case overview message:', error);
      // Don't throw error as this shouldn't block case closure
    }
  }
}