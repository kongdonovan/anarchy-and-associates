import { 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ApplicationCommandOptionType, 
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { Discord, Slash, SlashOption, SlashGroup, ButtonComponent, SelectMenuComponent, ModalComponent, Guard } from 'discordx';
import { JobService, JobCreateRequest, JobUpdateRequest } from '../../application/services/job-service';
import { JobQuestionService } from '../../application/services/job-question-service';
import { JobCleanupService } from '../../application/services/job-cleanup-service';
import { ApplicationService, ApplicationSubmissionRequest } from '../../application/services/application-service';
import { JobRepository, JobSearchFilters } from '../../infrastructure/repositories/job-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { PermissionService } from '../../application/services/permission-service';
import { RobloxService } from '../../infrastructure/external/roblox-service';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { PermissionUtils } from '../../infrastructure/utils/permission-utils';
import { StaffRole, RoleUtils } from '../../domain/entities/staff-role';
import { DEFAULT_JOB_QUESTIONS } from '../../domain/entities/job';
import { Job } from '../../domain/entities/job';
import { Application, ApplicationAnswer } from '../../domain/entities/application';
import { logger } from '../../infrastructure/logger';

@Discord()
@SlashGroup({ description: 'Job management and application commands', name: 'jobs' })
@SlashGroup('jobs')
@Guard(
  async (interaction: any, _client, next) => {
    logger.debug('Job command guard triggered', {
      commandName: interaction.commandName,
      isChatInputCommand: interaction.isChatInputCommand(),
      userId: interaction.user.id,
      guildId: interaction.guildId,
      commandNameEquals: interaction.commandName === 'jobs',
      actualCommandName: JSON.stringify(interaction.commandName),
      interactionType: interaction.constructor.name
    });
    
    // Allow all apply-related interactions to proceed without HR permission checks
    // This includes: apply slash command, job selection dropdowns, and application modals
    if (interaction.isChatInputCommand() && interaction.commandName === 'jobs') {
      logger.debug('Checking conditions for jobs command', {
        isChatInputCommand: interaction.isChatInputCommand(),
        commandNameMatches: interaction.commandName === 'jobs',
        actualCommandName: interaction.commandName
      });
      
      let subcommand: string | null = null;
      
      try {
        subcommand = interaction.options.getSubcommand();
        logger.debug('Detected subcommand:', subcommand);
      } catch (error) {
        logger.warn('Failed to get subcommand', { error: error instanceof Error ? error.message : error });
      }
      
      // Handle apply command with completely separate logic
      if (subcommand === 'apply') {
        logger.debug('Processing apply subcommand - bypassing all HR permission checks');
        
        // Check if user is an active staff member
        const staffRepository = new StaffRepository();
        try {
          const staffMember = await staffRepository.findByUserId(
            interaction.guildId!,
            interaction.user.id
          );
          
          logger.debug('Staff member lookup result', { 
            userId: interaction.user.id,
            hasStaffRecord: !!staffMember,
            status: staffMember?.status 
          });
          
          // If they are active staff, block them from applying
          if (staffMember && staffMember.status === 'active') {
            logger.info('Blocking active staff member from applying for job', { userId: interaction.user.id });
            await interaction.reply({
              content: '❌ Staff members cannot apply for jobs. Please contact HR if you wish to transfer to a different position.',
              ephemeral: true,
            });
            return; // Early exit - don't continue to next()
          }
          
          // For non-staff or inactive staff - allow through with no further checks
          logger.info('Allowing user to apply for job - proceeding without HR permission check', { 
            userId: interaction.user.id,
            isStaff: !!staffMember,
            status: staffMember?.status || 'non-staff'
          });
          
          await next(); // Allow the apply command to proceed
          return; // Early exit - don't fall through to HR check
          
        } catch (error) {
          logger.error('Error checking staff status for job application:', error);
          await interaction.reply({
            content: '❌ Unable to verify your employment status. Please try again later.',
            ephemeral: true,
          });
          return; // Early exit on error
        }
      }
      
      // For non-apply slash commands, check HR permissions
      logger.debug('Non-apply job command - checking HR permissions', { 
        commandName: interaction.commandName,
        subcommand: subcommand,
        userId: interaction.user.id 
      });
      
      const guildConfigRepository = new GuildConfigRepository();
      const permissionService = new PermissionService(guildConfigRepository);
      const context = PermissionUtils.createPermissionContext(interaction);
      const hasPermission = await permissionService.hasHRPermissionWithContext(context);
      
      logger.debug('HR permission check result', { 
        userId: interaction.user.id,
        hasPermission 
      });
      
      if (!hasPermission) {
        await interaction.reply({
          content: '❌ You do not have permission to manage jobs. HR permission required.',
          ephemeral: true,
        });
        return;
      }
      
      await next();
      return;
    }
    
    // For apply-related component interactions (dropdown selections, modal submissions), 
    // allow them to proceed without permission checks since they're part of the apply flow
    if (interaction.isStringSelectMenu() && interaction.customId === 'apply_job_select') {
      logger.debug('Allowing job selection dropdown interaction to proceed');
      await next();
      return;
    }
    
    if (interaction.isModalSubmit() && interaction.customId.startsWith('apply_modal_')) {
      logger.debug('Allowing job application modal submission to proceed');
      await next();
      return;
    }
    
    // For all other job-related interactions, require HR permissions
    logger.debug('Other job-related interaction - checking HR permissions', { 
      interactionType: interaction.constructor.name,
      customId: 'customId' in interaction ? interaction.customId : 'N/A',
      userId: interaction.user.id 
    });
    
    const guildConfigRepository = new GuildConfigRepository();
    const permissionService = new PermissionService(guildConfigRepository);
    const hasPermission = await permissionService.hasHRPermission(
      interaction.guildId!,
      interaction.user.id
    );
    
    logger.debug('HR permission check result for other interaction', { 
      userId: interaction.user.id,
      hasPermission 
    });
    
    if (!hasPermission) {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ You do not have permission to use this feature. HR permission required.',
          ephemeral: true,
        });
      }
      return;
    }
    
    await next();
  }
)
export class JobsCommands {
  private jobService: JobService;
  private questionService: JobQuestionService;
  private cleanupService: JobCleanupService;
  private applicationService: ApplicationService;
  private jobRepository: JobRepository;
  private guildConfigRepository: GuildConfigRepository;

  constructor() {
    const jobRepository = new JobRepository();
    const auditLogRepository = new AuditLogRepository();
    const staffRepository = new StaffRepository();
    const applicationRepository = new ApplicationRepository();
    const robloxService = RobloxService.getInstance();
    const guildConfigRepository = new GuildConfigRepository();

    this.jobService = new JobService(jobRepository, auditLogRepository, staffRepository);
    this.questionService = new JobQuestionService();
    this.cleanupService = new JobCleanupService(jobRepository, auditLogRepository);
    this.applicationService = new ApplicationService(
      applicationRepository, 
      jobRepository, 
      staffRepository, 
      robloxService
    );
    this.jobRepository = jobRepository;
    this.guildConfigRepository = guildConfigRepository;
  }

  @Slash({
    description: 'Apply for a job position',
    name: 'apply'
  })
  async apply(interaction: CommandInteraction): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      
      // Get open jobs
      const openJobs = await this.jobRepository.findByFilters({ guildId, isOpen: true });
      
      if (openJobs.length === 0) {
        const embed = EmbedUtils.createInfoEmbed(
          'No Open Positions',
          'There are currently no open job positions available. Please check back later.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Create job selection dropdown
      const jobOptions = openJobs.map(job => ({
        label: job.title,
        value: job._id!.toString(),
        description: job.description.length > 100 
          ? job.description.substring(0, 97) + '...' 
          : job.description
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('apply_job_select')
        .setPlaceholder('Select a position to apply for...')
        .addOptions(jobOptions);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

      const embed = EmbedUtils.createAALegalEmbed({
        title: 'Job Application',
        description: `Welcome to Anarchy & Associates! We have **${openJobs.length}** open position${openJobs.length === 1 ? '' : 's'} available.\n\nPlease select the position you'd like to apply for from the dropdown below.`,
        color: 'info'
      });

      await interaction.reply({ 
        embeds: [embed], 
        components: [row], 
        ephemeral: true 
      });

    } catch (error) {
      logger.error('Error in apply command:', error);
      const embed = EmbedUtils.createErrorEmbed(
        'Application Error',
        'An error occurred while loading job applications. Please try again later.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({ name: 'list', description: 'List all jobs with filtering and pagination' })
  async list(
    @SlashOption({
      description: 'Filter by job status (open/closed/all)',
      name: 'status',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    status: string,
    @SlashOption({
      description: 'Filter by staff role',
      name: 'role',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    role: StaffRole,
    @SlashOption({
      description: 'Search term for job title or description',
      name: 'search',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    search: string,
    @SlashOption({
      description: 'Page number (default: 1)',
      name: 'page',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
    })
    page: number,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const currentPage = page || 1;

      const filters: JobSearchFilters = {};
      
      if (status && status !== 'all') {
        if (status !== 'open' && status !== 'closed') {
          await interaction.followUp({
            content: '❌ Invalid status. Must be "open", "closed", or "all".',
            ephemeral: true,
          });
          return;
        }
        filters.isOpen = status === 'open';
      }
      
      if (role) {
        if (!RoleUtils.isValidRole(role)) {
          await interaction.followUp({
            content: `❌ Invalid role. Valid roles are: ${RoleUtils.getAllRoles().join(', ')}`,
            ephemeral: true,
          });
          return;
        }
        filters.staffRole = role as StaffRole;
      }
      
      if (search) {
        filters.searchTerm = search;
      }

      const result = await this.jobService.listJobs(guildId, filters, currentPage, interaction.user.id);

      if (result.jobs.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('📋 Job Listings')
          .setDescription('No jobs found matching your criteria.')
          .setColor('#FFA500')
          .setTimestamp();

        await interaction.followUp({ embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📋 Job Listings')
        .setColor('#0099FF')
        .setTimestamp()
        .setFooter({
          text: `Page ${result.currentPage} of ${result.totalPages} | Total: ${result.total} jobs`,
        });

      let description = '';
      for (const job of result.jobs) {
        const statusIcon = job.isOpen ? '🟢' : '🔴';
        const roleLimit = job.limit ? ` (${job.hiredCount}/${job.limit})` : '';
        description += `${statusIcon} **${job.title}**\n`;
        description += `└ ${job.staffRole}${roleLimit} | Posted by <@${job.postedBy}>\n`;
        description += `└ Applications: ${job.applicationCount} | Hired: ${job.hiredCount}\n`;
        description += `└ ID: \`${job._id?.toHexString()}\`\n\n`;
      }

      embed.setDescription(description);

      const row = new ActionRowBuilder<ButtonBuilder>();
      
      if (result.currentPage > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`job_list_${currentPage - 1}_${JSON.stringify(filters)}`)
            .setLabel('← Previous')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      if (result.currentPage < result.totalPages) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`job_list_${currentPage + 1}_${JSON.stringify(filters)}`)
            .setLabel('Next →')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      const components = row.components.length > 0 ? [row] : [];
      await interaction.followUp({ embeds: [embed], components });

    } catch (error) {
      logger.error('Error in job list command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while fetching jobs.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'add', description: 'Create a new job posting' })
  async add(
    @SlashOption({
      description: 'Job title',
      name: 'title',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    title: string,
    @SlashOption({
      description: 'Job description',
      name: 'description',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    description: string,
    @SlashOption({
      description: 'Staff role for this position',
      name: 'role',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    role: StaffRole,
    @SlashOption({
      description: 'Discord role ID for this position',
      name: 'discord_role',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    discordRole: string,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      if (!RoleUtils.isValidRole(role)) {
        await interaction.followUp({
          content: `❌ Invalid role. Valid roles are: ${RoleUtils.getAllRoles().join(', ')}`,
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.guildId!;
      const request: JobCreateRequest = {
        guildId,
        title,
        description,
        staffRole: role as StaffRole,
        roleId: discordRole,
        postedBy: interaction.user.id,
      };

      const result = await this.jobService.createJob(request);

      if (!result.success) {
        await interaction.followUp({
          content: `❌ Failed to create job: ${result.error}`,
          ephemeral: true,
        });
        return;
      }

      const job = result.job!;
      const embed = new EmbedBuilder()
        .setTitle('✅ Job Created Successfully')
        .setColor('#00FF00')
        .addFields(
          { name: 'Title', value: job.title, inline: true },
          { name: 'Staff Role', value: job.staffRole, inline: true },
          { name: 'Position Limit', value: job.limit?.toString() || 'No limit', inline: true },
          { name: 'Description', value: job.description },
          { name: 'Job ID', value: job._id?.toHexString() || 'Unknown', inline: true },
          { name: 'Discord Role', value: `<@&${job.roleId}>`, inline: true },
          { name: 'Questions', value: `${job.questions.length} questions (${DEFAULT_JOB_QUESTIONS.length} default + ${job.questions.length - DEFAULT_JOB_QUESTIONS.length} custom)`, inline: true }
        )
        .setTimestamp();

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in job add command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while creating the job.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'edit', description: 'Edit an existing job posting' })
  async edit(
    @SlashOption({
      description: 'Job ID to edit',
      name: 'job_id',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    jobId: string,
    @SlashOption({
      description: 'New job title',
      name: 'title',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    title: string,
    @SlashOption({
      description: 'New job description',
      name: 'description',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    description: string,
    @SlashOption({
      description: 'New staff role',
      name: 'role',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    role: StaffRole,
    @SlashOption({
      description: 'New Discord role ID',
      name: 'discord_role',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    discordRole: string,
    @SlashOption({
      description: 'Job status (open/closed)',
      name: 'status',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    status: string,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const updates: JobUpdateRequest = {};

      if (title) updates.title = title;
      if (description) updates.description = description;
      if (role) {
        if (!RoleUtils.isValidRole(role)) {
          await interaction.followUp({
            content: `❌ Invalid role. Valid roles are: ${RoleUtils.getAllRoles().join(', ')}`,
            ephemeral: true,
          });
          return;
        }
        updates.staffRole = role as StaffRole;
      }
      if (discordRole) updates.roleId = discordRole;
      if (status) {
        if (status !== 'open' && status !== 'closed') {
          await interaction.followUp({
            content: '❌ Invalid status. Must be "open" or "closed".',
            ephemeral: true,
          });
          return;
        }
        updates.isOpen = status === 'open';
      }

      if (Object.keys(updates).length === 0) {
        await interaction.followUp({
          content: '❌ No updates provided. Please specify at least one field to update.',
          ephemeral: true,
        });
        return;
      }

      const result = await this.jobService.updateJob(guildId, jobId, updates, interaction.user.id);

      if (!result.success) {
        await interaction.followUp({
          content: `❌ Failed to update job: ${result.error}`,
          ephemeral: true,
        });
        return;
      }

      const job = result.job!;
      const embed = new EmbedBuilder()
        .setTitle('✅ Job Updated Successfully')
        .setColor('#00FF00')
        .addFields(
          { name: 'Title', value: job.title, inline: true },
          { name: 'Staff Role', value: job.staffRole, inline: true },
          { name: 'Status', value: job.isOpen ? '🟢 Open' : '🔴 Closed', inline: true },
          { name: 'Description', value: job.description },
          { name: 'Updated Fields', value: Object.keys(updates).join(', '), inline: true },
          { name: 'Discord Role', value: `<@&${job.roleId}>`, inline: true }
        )
        .setTimestamp();

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in job edit command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while updating the job.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'info', description: 'View detailed information about a specific job' })
  async info(
    @SlashOption({
      description: 'Job ID to view',
      name: 'job_id',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    jobId: string,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const job = await this.jobService.getJobDetails(guildId, jobId, interaction.user.id);

      if (!job) {
        await interaction.followUp({
          content: '❌ Job not found.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 ${job.title}`)
        .setColor(job.isOpen ? '#00FF00' : '#FF0000')
        .addFields(
          { name: 'Status', value: job.isOpen ? '🟢 Open' : '🔴 Closed', inline: true },
          { name: 'Staff Role', value: job.staffRole, inline: true },
          { name: 'Position Limit', value: job.limit?.toString() || 'No limit', inline: true },
          { name: 'Applications', value: job.applicationCount.toString(), inline: true },
          { name: 'Hired', value: job.hiredCount.toString(), inline: true },
          { name: 'Discord Role', value: `<@&${job.roleId}>`, inline: true },
          { name: 'Description', value: job.description },
          { name: 'Posted By', value: `<@${job.postedBy}>`, inline: true },
          { name: 'Created', value: `<t:${Math.floor(job.createdAt!.getTime() / 1000)}:F>`, inline: true }
        );

      if (job.closedAt && job.closedBy) {
        embed.addFields(
          { name: 'Closed By', value: `<@${job.closedBy}>`, inline: true },
          { name: 'Closed At', value: `<t:${Math.floor(job.closedAt.getTime() / 1000)}:F>`, inline: true }
        );
      }

      // Add questions information
      const questionInfo = job.questions.map((q, index) => {
        const required = q.required ? ' (Required)' : ' (Optional)';
        return `${index + 1}. **${q.question}**${required}\n   Type: ${q.type}`;
      }).join('\n');

      embed.addFields({ name: 'Application Questions', value: questionInfo || 'No questions configured' });

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in job info command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while fetching job information.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'close', description: 'Close a job posting (keeps it in database)' })
  async close(
    @SlashOption({
      description: 'Job ID to close',
      name: 'job_id',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    jobId: string,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const result = await this.jobService.closeJob(guildId, jobId, interaction.user.id);

      if (!result.success) {
        await interaction.followUp({
          content: `❌ Failed to close job: ${result.error}`,
          ephemeral: true,
        });
        return;
      }

      const job = result.job!;
      const embed = new EmbedBuilder()
        .setTitle('✅ Job Closed Successfully')
        .setColor('#FF0000')
        .addFields(
          { name: 'Title', value: job.title, inline: true },
          { name: 'Staff Role', value: job.staffRole, inline: true },
          { name: 'Applications Received', value: job.applicationCount.toString(), inline: true },
          { name: 'Total Hired', value: job.hiredCount.toString(), inline: true },
          { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setTimestamp();

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in job close command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while closing the job.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'remove', description: 'Remove a job posting permanently from database' })
  async remove(
    @SlashOption({
      description: 'Job ID to remove',
      name: 'job_id',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    jobId: string,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      
      // Get job info before deletion for confirmation
      const job = await this.jobService.getJobDetails(guildId, jobId, interaction.user.id);
      if (!job) {
        await interaction.followUp({
          content: '❌ Job not found.',
          ephemeral: true,
        });
        return;
      }

      const result = await this.jobService.removeJob(guildId, jobId, interaction.user.id);

      if (!result.success) {
        await interaction.followUp({
          content: `❌ Failed to remove job: ${result.error}`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Job Removed Successfully')
        .setColor('#FF0000')
        .addFields(
          { name: 'Removed Job', value: job.title, inline: true },
          { name: 'Staff Role', value: job.staffRole, inline: true },
          { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setDescription('⚠️ This job has been permanently removed from the database.')
        .setTimestamp();

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in job remove command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while removing the job.',
        ephemeral: true,
      });
    }
  }

  @ButtonComponent({ id: /job_list_\d+_.*/ })
  async handleListPagination(interaction: ButtonInteraction) {
    try {
      await interaction.deferUpdate();

      const customId = interaction.customId;
      if (!customId) {
        await interaction.followUp({
          content: '❌ Invalid button interaction.',
          ephemeral: true,
        });
        return;
      }

      const [, , pageStr, filtersStr] = customId.split('_', 4);
      if (!pageStr || !filtersStr) {
        await interaction.followUp({
          content: '❌ Invalid pagination data.',
          ephemeral: true,
        });
        return;
      }

      const page = parseInt(pageStr);
      const filters = JSON.parse(filtersStr) as JobSearchFilters;

      const guildId = interaction.guildId!;
      const result = await this.jobService.listJobs(guildId, filters, page, interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle('📋 Job Listings')
        .setColor('#0099FF')
        .setTimestamp()
        .setFooter({
          text: `Page ${result.currentPage} of ${result.totalPages} | Total: ${result.total} jobs`,
        });

      let description = '';
      for (const job of result.jobs) {
        const statusIcon = job.isOpen ? '🟢' : '🔴';
        const roleLimit = job.limit ? ` (${job.hiredCount}/${job.limit})` : '';
        description += `${statusIcon} **${job.title}**\n`;
        description += `└ ${job.staffRole}${roleLimit} | Posted by <@${job.postedBy}>\n`;
        description += `└ Applications: ${job.applicationCount} | Hired: ${job.hiredCount}\n`;
        description += `└ ID: \`${job._id?.toHexString()}\`\n\n`;
      }

      embed.setDescription(description);

      const row = new ActionRowBuilder<ButtonBuilder>();
      
      if (result.currentPage > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`job_list_${page - 1}_${filtersStr}`)
            .setLabel('← Previous')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      if (result.currentPage < result.totalPages) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`job_list_${page + 1}_${filtersStr}`)
            .setLabel('Next →')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      const components = row.components.length > 0 ? [row] : [];
      await interaction.editReply({ embeds: [embed], components });

    } catch (error) {
      logger.error('Error in job list pagination:', error);
      await interaction.followUp({
        content: '❌ An error occurred while navigating job list.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'questions', description: 'List available question templates for jobs' })
  async questions(
    @SlashOption({
      description: 'Filter by category',
      name: 'category',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    category: string,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      const templates = this.questionService.getQuestionTemplates(category);
      const categories = this.questionService.getQuestionCategories();

      if (templates.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('📋 Question Templates')
          .setDescription(category ? `No templates found for category "${category}".` : 'No question templates available.')
          .setColor('#FFA500')
          .addFields({ name: 'Available Categories', value: categories.join(', ') })
          .setTimestamp();

        await interaction.followUp({ embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Question Templates${category ? ` - ${category}` : ''}`)
        .setColor('#0099FF')
        .setTimestamp();

      if (!category) {
        embed.addFields({ name: 'Available Categories', value: categories.join(', '), inline: false });
      }

      // Group templates by category for better organization
      const groupedTemplates = templates.reduce((acc, template) => {
        if (!acc[template.category]) {
          acc[template.category] = [];
        }
        acc[template.category]!.push(template);
        return acc;
      }, {} as Record<string, typeof templates>);

      for (const [cat, catTemplates] of Object.entries(groupedTemplates)) {
        const templateList = catTemplates.map(template => {
          const required = template.defaultRequired ? '(Required)' : '(Optional)';
          return `\`${template.id}\` - ${template.question} ${required}`;
        }).join('\n');

        embed.addFields({
          name: `📂 ${cat}`,
          value: templateList.length > 1024 ? templateList.substring(0, 1021) + '...' : templateList,
          inline: false,
        });
      }

      embed.setFooter({ text: `${templates.length} templates available` });

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in job questions command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while fetching question templates.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'question-preview', description: 'Preview a specific question template' })
  async question_preview(
    @SlashOption({
      description: 'Template ID to preview',
      name: 'template_id',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    templateId: string,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      const template = this.questionService.getTemplateById(templateId);
      if (!template) {
        await interaction.followUp({
          content: `❌ Template with ID "${templateId}" not found. Use \`/job questions\` to see available templates.`,
          ephemeral: true,
        });
        return;
      }

      const question = this.questionService.createQuestionFromTemplate(templateId);
      if (!question) {
        await interaction.followUp({
          content: '❌ Failed to create question from template.',
          ephemeral: true,
        });
        return;
      }

      const preview = this.questionService.generateQuestionPreview(question);

      const embed = new EmbedBuilder()
        .setTitle(`📝 Question Preview: ${template.id}`)
        .setDescription(preview)
        .setColor('#0099FF')
        .addFields(
          { name: 'Category', value: template.category, inline: true },
          { name: 'Description', value: template.description, inline: true },
          { name: 'Default Required', value: template.defaultRequired ? 'Yes' : 'No', inline: true }
        )
        .setTimestamp();

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in job question preview command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while previewing the question template.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'add-questions', description: 'Add custom questions to a job using templates' })
  async add_questions(
    @SlashOption({
      description: 'Job ID to add questions to',
      name: 'job_id',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    jobId: string,
    @SlashOption({
      description: 'Comma-separated list of template IDs',
      name: 'template_ids',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    templateIds: string,
    @SlashOption({
      description: 'Make all added questions required (default: use template default)',
      name: 'force_required',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    forceRequired: boolean,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      
      // Get existing job
      const existingJob = await this.jobService.getJobDetails(guildId, jobId, interaction.user.id);
      if (!existingJob) {
        await interaction.followUp({
          content: '❌ Job not found.',
          ephemeral: true,
        });
        return;
      }

      // Parse template IDs
      const templateIdList = templateIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      if (templateIdList.length === 0) {
        await interaction.followUp({
          content: '❌ Please provide at least one template ID.',
          ephemeral: true,
        });
        return;
      }

      // Create questions from templates
      const newQuestions = [];
      const invalidTemplates = [];

      for (const templateId of templateIdList) {
        const question = this.questionService.createQuestionFromTemplate(templateId, 
          forceRequired ? { required: true } : undefined
        );
        
        if (question) {
          // Check if question already exists
          const existingQuestion = existingJob.questions.find(q => q.id === question.id);
          if (!existingQuestion) {
            newQuestions.push(question);
          }
        } else {
          invalidTemplates.push(templateId);
        }
      }

      if (invalidTemplates.length > 0) {
        await interaction.followUp({
          content: `❌ Invalid template IDs: ${invalidTemplates.join(', ')}. Use \`/job questions\` to see available templates.`,
          ephemeral: true,
        });
        return;
      }

      if (newQuestions.length === 0) {
        await interaction.followUp({
          content: '❌ All specified questions already exist in this job.',
          ephemeral: true,
        });
        return;
      }

      // Merge with existing questions
      const allQuestions = [...existingJob.questions, ...newQuestions];

      // Validate the merged question list
      const validation = this.questionService.validateQuestionList(allQuestions);
      if (!validation.valid) {
        await interaction.followUp({
          content: `❌ Question validation failed: ${validation.error}`,
          ephemeral: true,
        });
        return;
      }

      // Update the job
      const result = await this.jobService.updateJob(
        guildId,
        jobId,
        { questions: allQuestions },
        interaction.user.id
      );

      if (!result.success) {
        await interaction.followUp({
          content: `❌ Failed to update job: ${result.error}`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Questions Added Successfully')
        .setColor('#00FF00')
        .addFields(
          { name: 'Job', value: existingJob.title, inline: true },
          { name: 'Questions Added', value: newQuestions.length.toString(), inline: true },
          { name: 'Total Questions', value: allQuestions.length.toString(), inline: true }
        )
        .setDescription(
          `Added questions:\n${newQuestions.map(q => `• ${q.question} (${q.required ? 'Required' : 'Optional'})`).join('\n')}`
        )
        .setTimestamp();

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in add questions command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while adding questions to the job.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'cleanup-roles', description: 'Clean up Discord roles for closed jobs' })
  async cleanup_roles(
    @SlashOption({
      description: 'Perform dry run without making changes',
      name: 'dry_run',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      if (!interaction.guild) {
        await interaction.followUp({
          content: '❌ This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      const guild = interaction.guild;
      const isDryRun = dryRun || false;

      const result = await this.cleanupService.cleanupJobRoles(guild, isDryRun);

      const embed = new EmbedBuilder()
        .setTitle(`${isDryRun ? '🔍 Role Cleanup Preview' : '🧹 Role Cleanup Results'}`)
        .setColor(result.success ? '#00FF00' : '#FFA500')
        .addFields(
          { name: 'Jobs Processed', value: result.jobsProcessed.toString(), inline: true },
          { name: 'Roles Removed', value: result.rolesRemoved.toString(), inline: true },
          { name: 'Errors', value: result.errors.length.toString(), inline: true }
        )
        .setTimestamp();

      if (result.errors.length > 0) {
        const errorText = result.errors.slice(0, 3).join('\n');
        embed.addFields({
          name: '⚠️ Issues Found',
          value: errorText.length > 1024 ? errorText.substring(0, 1021) + '...' : errorText,
          inline: false,
        });
      }

      if (isDryRun && result.rolesRemoved > 0) {
        embed.setDescription(`Preview mode: ${result.rolesRemoved} roles would be removed. Run without dry_run to apply changes.`);
      } else if (!isDryRun && result.rolesRemoved > 0) {
        embed.setDescription(`Successfully cleaned up ${result.rolesRemoved} Discord roles from closed jobs.`);
      } else {
        embed.setDescription('No role cleanup needed at this time.');
      }

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in cleanup roles command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while performing role cleanup.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'cleanup-report', description: 'Get cleanup report for jobs and roles' })
  async cleanup_report(interaction: CommandInteraction) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const report = await this.cleanupService.getCleanupReport(guildId);

      const embed = new EmbedBuilder()
        .setTitle('🧹 Job Cleanup Report')
        .setColor('#0099FF')
        .addFields(
          { name: 'Jobs Needing Cleanup', value: report.jobsNeedingCleanup.length.toString(), inline: true },
          { name: 'Expired Jobs (30+ days)', value: report.expiredJobsCount.toString(), inline: true },
          { name: 'Total Open Jobs', value: report.totalOpenJobs.toString(), inline: true }
        )
        .setTimestamp();

      if (report.oldestOpenJob) {
        embed.addFields({
          name: 'Oldest Open Job',
          value: `"${report.oldestOpenJob.title}" (${report.oldestOpenJob.daysOpen} days old)`,
          inline: false,
        });
      }

      if (report.jobsNeedingCleanup.length > 0) {
        const cleanupList = report.jobsNeedingCleanup.slice(0, 5).map(job => {
          const closedInfo = job.closedAt ? ` (closed ${Math.floor((Date.now() - job.closedAt.getTime()) / (1000 * 60 * 60 * 24))} days ago)` : '';
          return `• ${job.title}${closedInfo}`;
        }).join('\n');

        embed.addFields({
          name: '🔧 Jobs Needing Role Cleanup',
          value: cleanupList + (report.jobsNeedingCleanup.length > 5 ? `\n... and ${report.jobsNeedingCleanup.length - 5} more` : ''),
          inline: false,
        });
      }

      if (report.expiredJobsCount > 0) {
        embed.addFields({
          name: '⏰ Recommendation',
          value: `Consider running \`/job cleanup_expired\` to automatically close ${report.expiredJobsCount} expired job(s).`,
          inline: false,
        });
      }

      if (report.jobsNeedingCleanup.length > 0) {
        embed.addFields({
          name: '🧹 Recommendation',
          value: 'Run `/job cleanup_roles` to clean up Discord roles from closed jobs.',
          inline: false,
        });
      }

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in cleanup report command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while generating cleanup report.',
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'cleanup-expired', description: 'Automatically close expired jobs (30+ days old)' })
  async cleanup_expired(
    @SlashOption({
      description: 'Maximum days a job can stay open (default: 30)',
      name: 'max_days',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
      maxValue: 365,
    })
    maxDays: number,
    @SlashOption({
      description: 'Perform dry run without making changes',
      name: 'dry_run',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean,
    interaction: CommandInteraction
  ) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const maxDaysOpen = maxDays || 30;
      const isDryRun = dryRun || false;

      const result = await this.cleanupService.cleanupExpiredJobs(guildId, maxDaysOpen, isDryRun);

      const embed = new EmbedBuilder()
        .setTitle(`${isDryRun ? '🔍 Expired Job Cleanup Preview' : '⏰ Expired Job Cleanup Results'}`)
        .setColor(result.success ? '#00FF00' : '#FFA500')
        .addFields(
          { name: 'Jobs Processed', value: result.jobsProcessed.toString(), inline: true },
          { name: 'Max Days Open', value: maxDaysOpen.toString(), inline: true },
          { name: 'Errors', value: result.errors.length.toString(), inline: true }
        )
        .setTimestamp();

      if (result.errors.length > 0) {
        const errorText = result.errors.slice(0, 3).join('\n');
        embed.addFields({
          name: '⚠️ Issues Found',
          value: errorText.length > 1024 ? errorText.substring(0, 1021) + '...' : errorText,
          inline: false,
        });
      }

      if (isDryRun && result.jobsProcessed > 0) {
        embed.setDescription(`Preview mode: ${result.jobsProcessed} expired jobs would be closed. Run without dry_run to apply changes.`);
      } else if (!isDryRun && result.jobsProcessed > 0) {
        embed.setDescription(`Successfully closed ${result.jobsProcessed} expired jobs.`);
      } else {
        embed.setDescription('No expired jobs found that need to be closed.');
      }

      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in cleanup expired command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while cleaning up expired jobs.',
        ephemeral: true,
      });
    }
  }

  @SelectMenuComponent({ id: 'apply_job_select' })
  async handleJobSelection(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      const jobId = interaction.values[0];
      if (!jobId) {
        throw new Error('No job selected');
      }
      const job = await this.jobRepository.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }
      
      if (!job.isOpen) {
        const embed = EmbedUtils.createErrorEmbed(
          'Job Unavailable',
          'This job is no longer available for applications.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Create application modal with job-specific questions
      const modal = new ModalBuilder()
        .setCustomId(`apply_modal_${jobId}`)
        .setTitle(`Application: ${job.title}`);

      // Add Roblox username field (always first)
      const robloxInput = new TextInputBuilder()
        .setCustomId('roblox_username')
        .setLabel('Roblox Username')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your exact Roblox username')
        .setRequired(true)
        .setMaxLength(20);

      const robloxRow = new ActionRowBuilder<TextInputBuilder>()
        .addComponents(robloxInput);

      modal.addComponents(robloxRow);

      // Add job-specific questions (up to 4 more fields due to Discord's 5 component limit)
      const questions = job.questions || [];
      const maxQuestions = Math.min(questions.length, 4);

      for (let i = 0; i < maxQuestions; i++) {
        const question = questions[i];
        if (!question) continue;
        const input = new TextInputBuilder()
          .setCustomId(`question_${i}`)
          .setLabel(question.question)
          .setStyle(question.type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(question.required)
          .setMaxLength(question.type === 'paragraph' ? 4000 : 1000);

        if (question.placeholder) {
          input.setPlaceholder(question.placeholder);
        }

        const questionRow = new ActionRowBuilder<TextInputBuilder>()
          .addComponents(input);

        modal.addComponents(questionRow);
      }

      await interaction.showModal(modal);

    } catch (error) {
      logger.error('Error handling job selection:', error);
      const embed = EmbedUtils.createErrorEmbed(
        'Selection Error',
        'An error occurred while processing your job selection. Please try again.'
      );
      
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    }
  }

  @ModalComponent({ id: /^apply_modal_/ })
  async handleApplicationSubmission(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const jobId = interaction.customId.replace('apply_modal_', '');
      const guildId = interaction.guildId!;
      const applicantId = interaction.user.id;

      // Extract form data
      const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
      const answers: ApplicationAnswer[] = [];

      // Get job to validate questions
      const job = await this.jobRepository.findById(jobId);
      if (!job) {
        const embed = EmbedUtils.createErrorEmbed(
          'Job Not Found',
          'The job you applied for could not be found.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      
      if (!job.isOpen) {
        const embed = EmbedUtils.createErrorEmbed(
          'Job Unavailable',
          'This job is no longer available for applications.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Extract answers for job questions
      const questions = job.questions || [];
      const maxQuestions = Math.min(questions.length, 4);

      for (let i = 0; i < maxQuestions; i++) {
        const questionId = `question_${i}`;
        try {
          const answer = interaction.fields.getTextInputValue(questionId);
          const currentQuestion = questions[i];
          if (currentQuestion) {
            answers.push({
              questionId: currentQuestion.id,
              answer: answer
            });
          }
        } catch {
          // Question field not found - skip
        }
      }

      // Submit application
      const applicationRequest: ApplicationSubmissionRequest = {
        guildId,
        jobId,
        applicantId,
        robloxUsername,
        answers
      };

      const application = await this.applicationService.submitApplication(applicationRequest);

      // Send confirmation to applicant
      const confirmationEmbed = EmbedUtils.createSuccessEmbed(
        'Application Submitted',
        `Your application for **${job.title}** has been submitted successfully!\n\n` +
        `**Application ID:** \`${application._id}\`\n` +
        `**Position:** ${job.title}\n` +
        `**Roblox Username:** ${robloxUsername}\n\n` +
        `Our HR team will review your application and contact you soon. Thank you for your interest in Anarchy & Associates!`
      );

      await interaction.reply({ embeds: [confirmationEmbed], ephemeral: true });

      // Post to application review channel
      await this.postApplicationForReview(application, job, interaction);

    } catch (error) {
      logger.error('Error submitting application:', error);
      
      let errorMessage = 'An unexpected error occurred while submitting your application.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      const embed = EmbedUtils.createErrorEmbed(
        'Application Failed',
        errorMessage
      );
      
      if (interaction.replied) {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  }

  private async postApplicationForReview(application: Application, job: Job, interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const guildConfig = await this.guildConfigRepository.findByGuildId(application.guildId);
      
      if (!guildConfig?.applicationChannelId) {
        logger.warn('Application channel not configured, cannot post application for review', {
          guildId: application.guildId,
          applicationId: application._id
        });
        return;
      }

      const guild = await interaction.client.guilds.fetch(application.guildId);
      const channel = await guild.channels.fetch(guildConfig.applicationChannelId);
      
      if (!channel || !channel.isTextBased()) {
        logger.warn('Application channel not found or not text-based', {
          guildId: application.guildId,
          channelId: guildConfig.applicationChannelId
        });
        return;
      }

      // Create application review embed
      const reviewEmbed = EmbedUtils.createAALegalEmbed({
        title: '📝 New Job Application',
        color: 'info'
      });

      reviewEmbed.addFields(
        { name: '👤 Applicant', value: `<@${application.applicantId}>`, inline: true },
        { name: '💼 Position', value: job.title, inline: true },
        { name: '🎮 Roblox Username', value: application.robloxUsername, inline: true },
        { name: '🆔 Application ID', value: `\`${application._id}\``, inline: false }
      );

      // Add answers
      if (application.answers.length > 0) {
        const questions = job.questions || [];
        const answersText = application.answers
          .map(answer => {
            const question = questions.find(q => q.id === answer.questionId);
            const questionText = question?.question || 'Unknown Question';
            return `**${questionText}**\n${answer.answer}`;
          })
          .join('\n\n');

        EmbedUtils.addFieldSafe(reviewEmbed, '📋 Application Responses', answersText);
      }

      // Create action buttons
      const acceptButton = new ButtonBuilder()
        .setCustomId(`app_accept_${application._id}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const declineButton = new ButtonBuilder()
        .setCustomId(`app_decline_${application._id}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(acceptButton, declineButton);

      await channel.send({
        embeds: [reviewEmbed],
        components: [row]
      });

      logger.info('Application posted for review', {
        applicationId: application._id,
        channelId: guildConfig.applicationChannelId
      });

    } catch (error) {
      logger.error('Error posting application for review:', error);
    }
  }

  @ButtonComponent({ id: /^app_accept_/ })
  async handleApplicationAccept(interaction: ButtonInteraction): Promise<void> {
    try {
      const applicationId = interaction.customId.replace('app_accept_', '');
      
      // Review the application
      const application = await this.applicationService.reviewApplication({
        applicationId,
        reviewerId: interaction.user.id,
        approved: true
      });

      // Update the embed to show it's been accepted
      const originalEmbed = interaction.message.embeds[0];
      if (!originalEmbed) {
        throw new Error('Original embed not found');
      }
      
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0x00FF41) // Green
        .addFields({ name: '✅ Status', value: `Accepted by <@${interaction.user.id}>`, inline: false });

      // Disable buttons
      const originalComponent = interaction.message.components[0];
      if (!originalComponent) {
        throw new Error('Original component not found');
      }

      const acceptButton = new ButtonBuilder()
        .setCustomId('disabled_accept')
        .setLabel('Accepted')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true);

      const declineButton = new ButtonBuilder()
        .setCustomId('disabled_decline')
        .setLabel('Decline')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const disabledRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(acceptButton, declineButton);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [disabledRow]
      });

      // Get job information for role assignment
      const job = await this.jobRepository.findById(application.jobId);
      if (!job) {
        logger.error('Job not found for accepted application', { 
          applicationId: application._id,
          jobId: application.jobId 
        });
      }

      // Assign Discord role to the accepted applicant
      if (job && interaction.guild) {
        try {
          const guild = interaction.guild;
          const member = await guild.members.fetch(application.applicantId);
          const role = await guild.roles.fetch(job.roleId);
          
          if (role && member) {
            await member.roles.add(role);
            logger.info('Role assigned to accepted applicant', {
              applicantId: application.applicantId,
              roleId: job.roleId,
              roleName: role.name,
              jobTitle: job.title
            });
          } else {
            logger.warn('Could not assign role - role or member not found', {
              applicantId: application.applicantId,
              roleId: job.roleId,
              memberFound: !!member,
              roleFound: !!role
            });
          }
        } catch (roleError) {
          logger.error('Error assigning role to accepted applicant', {
            applicantId: application.applicantId,
            roleId: job.roleId,
            error: roleError
          });
        }
      }

      // Send DM to applicant
      try {
        const applicant = await interaction.client.users.fetch(application.applicantId);
        const dmEmbed = EmbedUtils.createSuccessEmbed(
          'Application Accepted! 🎉',
          `Congratulations! Your application for a position at Anarchy & Associates has been **accepted**!\n\n` +
          `**Application ID:** \`${application._id}\`\n` +
          (job ? `**Position:** ${job.title}\n` : '') +
          `\nWelcome to the team! You should have received your role automatically. If you have any questions, please contact our HR team.`
        );

        await applicant.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        logger.warn('Could not send DM to accepted applicant', { 
          applicantId: application.applicantId,
          error: dmError
        });
      }

    } catch (error) {
      logger.error('Error accepting application:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Accept Failed',
        'An error occurred while accepting this application.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @ButtonComponent({ id: /^app_decline_/ })
  async handleApplicationDecline(interaction: ButtonInteraction): Promise<void> {
    try {
      const applicationId = interaction.customId.replace('app_decline_', '');
      
      // Show modal for decline reason
      const modal = new ModalBuilder()
        .setCustomId(`decline_reason_${applicationId}`)
        .setTitle('Decline Application');

      const reasonInput = new TextInputBuilder()
        .setCustomId('decline_reason')
        .setLabel('Reason for declining (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Provide feedback for the applicant...')
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
        'An error occurred while declining this application.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @ModalComponent({ id: /^decline_reason_/ })
  async handleDeclineReason(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const applicationId = interaction.customId.replace('decline_reason_', '');
      const reason = interaction.fields.getTextInputValue('decline_reason') || undefined;
      
      // Review the application
      const application = await this.applicationService.reviewApplication({
        applicationId,
        reviewerId: interaction.user.id,
        approved: false,
        reason
      });

      // Note: For decline reason modal, we need to find and update the original application message
      // This is a simplified approach - in production, you might want to store message IDs in the database
      await interaction.reply({
        content: '✅ Application declined successfully.',
        ephemeral: true
      });

      // Send DM to applicant
      try {
        const applicant = await interaction.client.users.fetch(application.applicantId);
        const dmEmbed = EmbedUtils.createErrorEmbed(
          'Application Update',
          `Thank you for your interest in Anarchy & Associates. Unfortunately, your application has been **declined** at this time.\n\n` +
          `**Application ID:** \`${application._id}\`\n` +
          (reason ? `**Feedback:** ${reason}\n\n` : '\n') +
          `We encourage you to apply again in the future. Keep improving your skills and don't give up!`
        );

        await applicant.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        logger.warn('Could not send DM to declined applicant', { 
          applicantId: application.applicantId,
          error: dmError
        });
      }

    } catch (error) {
      logger.error('Error processing decline reason:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Decline Failed',
        'An error occurred while processing the decline reason.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}