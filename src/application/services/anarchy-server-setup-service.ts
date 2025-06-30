import { Guild, PermissionFlagsBits, ChannelType } from 'discord.js';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { Bot } from '../../infrastructure/bot/bot';
import { logger } from '../../infrastructure/logger';
import { 
  ANARCHY_SERVER_CONFIG, 
  DEFAULT_ROLE_PERMISSIONS,
  CATEGORY_PERMISSIONS,
  AnarchyServerConfig 
} from '../../config/server-setup.config';
import { DEFAULT_JOB_QUESTIONS } from '../../domain/entities/job'; // Keep constants
import { Job } from '../../validation';

export interface AnarchySetupResult {
  success: boolean;
  message: string;
  created: {
    roles: string[];
    channels: string[];
    categories: string[];
    jobs: number;
  };
  wiped: {
    collections: string[];
    channels: number;
    roles: number;
  };
  errors: string[];
}

export class AnarchyServerSetupService {
  private guildConfigRepository: GuildConfigRepository;
  private staffRepository: StaffRepository;
  private jobRepository: JobRepository;
  private applicationRepository: ApplicationRepository;
  private caseRepository: CaseRepository;
  private feedbackRepository: FeedbackRepository;
  private retainerRepository: RetainerRepository;
  private reminderRepository: ReminderRepository;
  private auditLogRepository: AuditLogRepository;
  private caseCounterRepository: CaseCounterRepository;

  constructor() {
    this.guildConfigRepository = new GuildConfigRepository();
    this.staffRepository = new StaffRepository();
    this.jobRepository = new JobRepository();
    this.applicationRepository = new ApplicationRepository();
    this.caseRepository = new CaseRepository();
    this.feedbackRepository = new FeedbackRepository();
    this.retainerRepository = new RetainerRepository();
    this.reminderRepository = new ReminderRepository();
    this.auditLogRepository = new AuditLogRepository();
    this.caseCounterRepository = new CaseCounterRepository();
  }

  async setupAnarchyServer(guild: Guild, customConfig?: AnarchyServerConfig): Promise<AnarchySetupResult> {
    const config = customConfig || ANARCHY_SERVER_CONFIG;
    const created = {
      roles: [] as string[],
      channels: [] as string[],
      categories: [] as string[],
      jobs: 0
    };
    const errors: string[] = [];

    try {
      logger.info(`Starting Anarchy & Associates server setup for guild ${guild.id}`);

      // First, wipe existing setup
      const wipeResult = await this.wipeServer(guild);
      if (!wipeResult.success) {
        errors.push(...wipeResult.errors);
      }

      // 1. Create roles in hierarchy order (first = highest)
      const roleMap = new Map<string, string>();
      for (const roleConfig of config.roles) {
        try {
          const role = await guild.roles.create({
            name: roleConfig.name,
            color: this.parseColor(roleConfig.color),
            permissions: roleConfig.permissions,
            hoist: roleConfig.hoist,
            mentionable: roleConfig.mentionable
          });
          
          created.roles.push(role.name);
          roleMap.set(roleConfig.name, role.id);
          logger.info(`Created role: ${role.name} for guild ${guild.id}`);
        } catch (error) {
          errors.push(`Failed to create role ${roleConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 2. Create categories and channels
      const categoryMap = new Map<string, string>();
      const channelMap = new Map<string, string>();

      for (const categoryConfig of config.categories) {
        try {
          // Create category
          const category = await guild.channels.create({
            name: categoryConfig.name,
            type: ChannelType.GuildCategory,
            permissionOverwrites: this.getCategoryPermissions(categoryConfig.name, guild, roleMap)
          });
          
          created.categories.push(category.name);
          categoryMap.set(categoryConfig.name, category.id);
          logger.info(`Created category: ${category.name} for guild ${guild.id}`);

          // Create channels within the category
          for (const channelConfig of categoryConfig.channels) {
            try {
              const channel = await guild.channels.create({
                name: channelConfig.name,
                type: channelConfig.type,
                parent: category.id,
                permissionOverwrites: this.getChannelPermissions(channelConfig.name, categoryConfig.name, guild, roleMap)
              } as any);
              
              created.channels.push(channel.name);
              channelMap.set(channelConfig.name, channel.id);
              logger.info(`Created channel: ${channel.name} in ${category.name} for guild ${guild.id}`);
            } catch (error) {
              errors.push(`Failed to create channel ${channelConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        } catch (error) {
          errors.push(`Failed to create category ${categoryConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3. Setup guild configuration
      await this.setupGuildConfig(guild, channelMap, categoryMap, roleMap);

      // 4. Setup role permissions
      await this.setupRolePermissions(guild, roleMap);

      // 5. Create default information message in welcome channel
      const welcomeChannelId = channelMap.get('welcome');
      logger.info(`Welcome channel ID: ${welcomeChannelId}, All channels: ${Array.from(channelMap.entries()).map(([k,v]) => `${k}:${v}`).join(', ')}`);
      if (welcomeChannelId) {
        try {
          // Import first to ensure the static method is available
          const { InformationChannelService } = await import('./information-channel-service');
          const informationChannelService = Bot.getInformationChannelService();
          const template = InformationChannelService.generateDefaultTemplate(guild.name, 'welcome');
          
          // Enhance the content with channel links
          const enhancedContent = template.content!.replace(
            '1. Review our Terms of Service and Community Guidelines',
            `1. Review our <#${channelMap.get('rules')}> Terms of Service and Community Guidelines`
          ).replace(
            '2. Submit inquiries through designated channels',
            `2. Submit inquiries through our <#${channelMap.get('bot-commands')}> designated channels`
          ).replace(
            '3. Consult with our legal professionals via appointment',
            `3. Join our <#${channelMap.get('general-chat')}> community lobby for initial consultations`
          );

          await informationChannelService.updateInformationChannel({
            guildId: guild.id,
            channelId: welcomeChannelId,
            title: template.title || 'Welcome to Anarchy & Associates',
            content: enhancedContent,
            color: template.color,
            footer: template.footer,
            updatedBy: guild.ownerId
          });
          logger.info(`Created default information message in welcome channel for guild ${guild.id}`);
        } catch (error) {
          logger.error(`Failed to create default information message in welcome channel for guild ${guild.id}:`, error);
          errors.push(`Failed to create default information message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 6. Create default rules message in rules channel
      const rulesChannelId = channelMap.get('rules');
      if (rulesChannelId) {
        try {
          const rulesChannelService = Bot.getRulesChannelService();
          const { RulesChannelService } = await import('./rules-channel-service');
          const template = RulesChannelService.generateDefaultRules('anarchy');
          
          await rulesChannelService.updateRulesChannel({
            guildId: guild.id,
            channelId: rulesChannelId,
            title: template.title || '📜 Anarchy & Associates Server Rules',
            content: template.content || 'Please follow these rules.',
            rules: template.rules || [],
            color: template.color,
            footer: template.footer,
            showNumbers: template.showNumbers,
            additionalFields: template.additionalFields,
            updatedBy: guild.ownerId
          });
          logger.info(`Created default rules message in rules channel for guild ${guild.id}`);
        } catch (error) {
          errors.push(`Failed to create default rules message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 7. Create jobs (renumbered from 6)
      let jobsCreated = 0;
      for (const jobConfig of config.defaultJobs) {
        if (!jobConfig.autoCreateOnSetup) continue;
        
        try {
          const roleId = roleMap.get(jobConfig.roleName);
          if (!roleId) {
            errors.push(`Role ${jobConfig.roleName} not found for job ${jobConfig.title}`);
            continue;
          }

          const roleConfig = config.roles.find(r => r.name === jobConfig.roleName);
          const limit = roleConfig?.maxCount;

          const job: Partial<Job> = {
            guildId: guild.id,
            title: jobConfig.title,
            description: jobConfig.description,
            staffRole: jobConfig.roleName as any,
            roleId: roleId,
            limit: limit,
            isOpen: jobConfig.isOpenByDefault,
            questions: [...DEFAULT_JOB_QUESTIONS, ...jobConfig.customQuestions],
            postedBy: guild.ownerId,
            applicationCount: 0,
            hiredCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          await this.jobRepository.add(job as any);
          jobsCreated++;
          logger.info(`Created job: ${jobConfig.title} for role ${jobConfig.roleName} in guild ${guild.id}`);
        } catch (error) {
          errors.push(`Failed to create job ${jobConfig.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      created.jobs = jobsCreated;

      const totalCreated = created.roles.length + created.channels.length + created.categories.length + created.jobs;

      return {
        success: errors.length === 0,
        message: `Anarchy & Associates server setup completed. Created ${totalCreated} items${errors.length > 0 ? ` with ${errors.length} errors` : ''}.`,
        created,
        wiped: wipeResult.wiped,
        errors
      };

    } catch (error) {
      logger.error('Error in Anarchy server setup:', error);
      return {
        success: false,
        message: 'Anarchy server setup failed',
        created,
        wiped: { collections: [], channels: 0, roles: 0 },
        errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private async wipeServer(guild: Guild) {
    const wiped = {
      collections: [] as string[],
      channels: 0,
      roles: 0
    };
    const errors: string[] = [];

    try {
      logger.info(`Starting server wipe for guild ${guild.id}`);

      // 1. Wipe database collections (except guildConfig)
      const collections = [
        { name: 'staff', repository: this.staffRepository },
        { name: 'jobs', repository: this.jobRepository },
        { name: 'applications', repository: this.applicationRepository },
        { name: 'cases', repository: this.caseRepository },
        { name: 'feedback', repository: this.feedbackRepository },
        { name: 'retainers', repository: this.retainerRepository },
        { name: 'reminders', repository: this.reminderRepository },
        { name: 'auditLogs', repository: this.auditLogRepository },
        { name: 'caseCounters', repository: this.caseCounterRepository }
      ];

      for (const collection of collections) {
        try {
          const records = await collection.repository.findByFilters({ guildId: guild.id });
          let deleteCount = 0;
          
          for (const record of records) {
            try {
              if (record._id) {
                await collection.repository.delete(record._id.toString());
                deleteCount++;
              }
            } catch (deleteError) {
              logger.warn(`Failed to delete individual record from ${collection.name}:`, deleteError);
            }
          }
          
          wiped.collections.push(`${collection.name} (${deleteCount} records)`);
          logger.info(`Wiped ${deleteCount} records from ${collection.name} for guild ${guild.id}`);
        } catch (error) {
          errors.push(`Failed to wipe ${collection.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 2. Delete ALL channels and categories (except system channels)
      const allChannels = guild.channels.cache.filter(channel => {
        return channel.id !== guild.systemChannelId && channel.id !== guild.rulesChannelId;
      });

      for (const [, channel] of allChannels) {
        try {
          await channel.delete('Complete server wipe for Anarchy setup');
          wiped.channels++;
          logger.info(`Deleted channel/category: ${channel.name} for guild ${guild.id}`);
        } catch (error) {
          errors.push(`Failed to delete channel ${channel.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3. Delete ALL roles (except protected ones)
      const allRoles = guild.roles.cache.filter(role => {
        if (role.id === guild.id) return false; // @everyone
        if (role.position >= guild.members.me!.roles.highest.position) return false; // Higher than bot
        if (role.managed) return false; // Bot roles, booster roles, etc.
        return true;
      });

      for (const [, role] of allRoles) {
        try {
          await role.delete('Complete server wipe for Anarchy setup');
          wiped.roles++;
          logger.info(`Deleted role: ${role.name} for guild ${guild.id}`);
        } catch (error) {
          errors.push(`Failed to delete role ${role.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 4. Reset guild configuration
      try {
        const config = await this.guildConfigRepository.ensureGuildConfig(guild.id);
        if (config._id) {
          await this.guildConfigRepository.update(config._id.toString(), {
            feedbackChannelId: undefined,
            retainerChannelId: undefined,
            caseReviewCategoryId: undefined,
            caseArchiveCategoryId: undefined,
            modlogChannelId: undefined,
            applicationChannelId: undefined,
            clientRoleId: undefined,
            permissions: {
              admin: [],
              'senior-staff': [],
              case: [],
              config: [],
              lawyer: [],
              'lead-attorney': [],
              repair: []
            },
            adminRoles: [],
            adminUsers: []
          });
        }
      } catch (error) {
        errors.push(`Failed to reset guild config: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return {
        success: errors.length === 0,
        message: `COMPLETE server wipe finished. Destroyed ${wiped.channels} channels/categories, ${wiped.roles} roles, wiped ${wiped.collections.length} database collections${errors.length > 0 ? ` with ${errors.length} errors` : ''}.`,
        wiped,
        errors
      };

    } catch (error) {
      logger.error('Error in server wipe:', error);
      return {
        success: false,
        message: 'Server wipe failed',
        wiped,
        errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private parseColor(color: string): number {
    const colorMap: Record<string, number> = {
      'DarkRed': 0x8B0000,
      'Red': 0xFF0000,
      'Blue': 0x0000FF,
      'Aqua': 0x00FFFF,
      'Purple': 0x800080,
      'Green': 0x008000,
      'Orange': 0xFFA500,
      'DarkGreen': 0x006400,
      'Yellow': 0xFFFF00,
      'Pink': 0xFFC0CB,
      'Grey': 0x808080,
      'LightGrey': 0xD3D3D3
    };

    if (color.startsWith('#')) {
      return parseInt(color.replace('#', ''), 16);
    }

    return colorMap[color] || 0x99AAB5; // Default Discord grey
  }

  private getCategoryPermissions(categoryName: string, guild: Guild, roleMap: Map<string, string>) {
    const permissions = [];
    const categoryConfig = CATEGORY_PERMISSIONS[categoryName as keyof typeof CATEGORY_PERMISSIONS];

    if (!categoryConfig) {
      // Default: Hide from @everyone if no config found
      permissions.push({
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      });
      return permissions;
    }

    // Apply @everyone permissions
    if (categoryConfig.everyone) {
      const everyoneConfig = categoryConfig.everyone as any;
      permissions.push({
        id: guild.id,
        allow: everyoneConfig.allow || [],
        deny: everyoneConfig.deny || []
      });
    }

    // Apply staff permissions for Information category
    if (categoryName === 'Information' && 'staff' in categoryConfig) {
      // Give senior staff permission to manage information channels
      const staffConfig = (categoryConfig as any).staff;
      const staffRoles = ['Managing Partner', 'Senior Partner', 'Partner'];
      for (const roleName of staffRoles) {
        const roleId = roleMap.get(roleName);
        if (roleId) {
          permissions.push({
            id: roleId,
            allow: staffConfig.allow || []
          });
        }
      }
    }

    // Apply role-specific permissions based on category config
    if ('legalRoles' in categoryConfig && categoryConfig.legalRoles) {
      for (const roleName of categoryConfig.legalRoles) {
        const roleId = roleMap.get(roleName);
        if (roleId) {
          permissions.push({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          });
        }
      }
    }

    if ('staffRoles' in categoryConfig && categoryConfig.staffRoles) {
      for (const roleName of categoryConfig.staffRoles) {
        const roleId = roleMap.get(roleName);
        if (roleId) {
          permissions.push({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          });
        }
      }
    }

    if ('adminRoles' in categoryConfig && categoryConfig.adminRoles) {
      for (const roleName of categoryConfig.adminRoles) {
        const roleId = roleMap.get(roleName);
        if (roleId) {
          permissions.push({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
          });
        }
      }
    }

    if ('archiveViewRoles' in categoryConfig && categoryConfig.archiveViewRoles) {
      for (const roleName of categoryConfig.archiveViewRoles) {
        const roleId = roleMap.get(roleName);
        if (roleId) {
          permissions.push({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages] // View-only for archives
          });
        }
      }
    }

    return permissions;
  }

  private getChannelPermissions(channelName: string, categoryName: string, guild: Guild, roleMap: Map<string, string>) {
    const permissions = [];
    
    // Start with category permissions as base
    const categoryPerms = this.getCategoryPermissions(categoryName, guild, roleMap);
    permissions.push(...categoryPerms);

    // Channel-specific overrides
    switch (channelName) {
      case 'announcements':
      case 'rules':
      case 'welcome':
        // Everyone can view, only management can send
        permissions[0] = {
          id: guild.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages]
        };
        const managingPartnerId = roleMap.get('Managing Partner');
        const seniorPartnerId = roleMap.get('Senior Partner');
        if (managingPartnerId) {
          permissions.push({
            id: managingPartnerId,
            allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
          });
        }
        if (seniorPartnerId) {
          permissions.push({
            id: seniorPartnerId,
            allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
          });
        }
        break;

      case 'feedback':
        // Clients can send, read-only for others
        const clientId = roleMap.get('Client');
        if (clientId) {
          permissions.push({
            id: clientId,
            allow: [PermissionFlagsBits.SendMessages]
          });
        }
        break;

      case 'modlog':
        // View only, no sending
        permissions.forEach((perm: any) => {
          if (perm.allow && Array.isArray(perm.allow)) {
            perm.allow = perm.allow.filter((p: any) => p !== PermissionFlagsBits.SendMessages);
          }
        });
        break;
    }

    return permissions;
  }

  private async setupGuildConfig(guild: Guild, channelMap: Map<string, string>, categoryMap: Map<string, string>, roleMap: Map<string, string>) {
    const config = await this.guildConfigRepository.ensureGuildConfig(guild.id);
    
    if (config._id) {
      await this.guildConfigRepository.update(config._id.toString(), {
        feedbackChannelId: channelMap.get('feedback'),
        defaultInformationChannelId: channelMap.get('welcome'),
        defaultRulesChannelId: channelMap.get('rules'),
        retainerChannelId: channelMap.get('signed-retainers'),
        modlogChannelId: channelMap.get('modlog'),
        applicationChannelId: channelMap.get('applications'),
        caseReviewCategoryId: categoryMap.get('Case Reviews'),
        caseArchiveCategoryId: categoryMap.get('Case Archives'),
        clientRoleId: roleMap.get('Client'),
        permissions: {
          admin: [],
          'senior-staff': [],
          case: [],
          config: [],
          lawyer: [],
          'lead-attorney': [],
          repair: []
        },
        adminRoles: [],
        adminUsers: [guild.ownerId] // Guild owner is always admin
      });
    }

    logger.info(`Guild configuration updated for guild ${guild.id}`);
  }

  private async setupRolePermissions(guild: Guild, roleMap: Map<string, string>) {
    try {
      for (const [roleName, actions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        const roleId = roleMap.get(roleName);
        if (!roleId) continue;

        for (const action of actions) {
          try {
            await this.guildConfigRepository.setPermissionRole(guild.id, action as any, roleId);
            logger.info(`Set ${action} permission for role ${roleName} in guild ${guild.id}`);
          } catch (error) {
            logger.warn(`Failed to set ${action} permission for role ${roleName}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error setting up role permissions:', error);
    }
  }
}