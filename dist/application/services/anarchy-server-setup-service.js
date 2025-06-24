"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnarchyServerSetupService = void 0;
const discord_js_1 = require("discord.js");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const job_repository_1 = require("../../infrastructure/repositories/job-repository");
const application_repository_1 = require("../../infrastructure/repositories/application-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const feedback_repository_1 = require("../../infrastructure/repositories/feedback-repository");
const retainer_repository_1 = require("../../infrastructure/repositories/retainer-repository");
const reminder_repository_1 = require("../../infrastructure/repositories/reminder-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const logger_1 = require("../../infrastructure/logger");
const server_setup_config_1 = require("../../config/server-setup.config");
const job_1 = require("../../domain/entities/job");
class AnarchyServerSetupService {
    constructor() {
        this.guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        this.staffRepository = new staff_repository_1.StaffRepository();
        this.jobRepository = new job_repository_1.JobRepository();
        this.applicationRepository = new application_repository_1.ApplicationRepository();
        this.caseRepository = new case_repository_1.CaseRepository();
        this.feedbackRepository = new feedback_repository_1.FeedbackRepository();
        this.retainerRepository = new retainer_repository_1.RetainerRepository();
        this.reminderRepository = new reminder_repository_1.ReminderRepository();
        this.auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        this.caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
    }
    async setupAnarchyServer(guild, customConfig) {
        const config = customConfig || server_setup_config_1.ANARCHY_SERVER_CONFIG;
        const created = {
            roles: [],
            channels: [],
            categories: [],
            jobs: 0
        };
        const errors = [];
        try {
            logger_1.logger.info(`Starting Anarchy & Associates server setup for guild ${guild.id}`);
            // First, wipe existing setup
            const wipeResult = await this.wipeServer(guild);
            if (!wipeResult.success) {
                errors.push(...wipeResult.errors);
            }
            // 1. Create roles in hierarchy order (first = highest)
            const roleMap = new Map();
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
                    logger_1.logger.info(`Created role: ${role.name} for guild ${guild.id}`);
                }
                catch (error) {
                    errors.push(`Failed to create role ${roleConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            // 2. Create categories and channels
            const categoryMap = new Map();
            const channelMap = new Map();
            for (const categoryConfig of config.categories) {
                try {
                    // Create category
                    const category = await guild.channels.create({
                        name: categoryConfig.name,
                        type: discord_js_1.ChannelType.GuildCategory,
                        permissionOverwrites: this.getCategoryPermissions(categoryConfig.name, guild, roleMap)
                    });
                    created.categories.push(category.name);
                    categoryMap.set(categoryConfig.name, category.id);
                    logger_1.logger.info(`Created category: ${category.name} for guild ${guild.id}`);
                    // Create channels within the category
                    for (const channelConfig of categoryConfig.channels) {
                        try {
                            const channel = await guild.channels.create({
                                name: channelConfig.name,
                                type: channelConfig.type,
                                parent: category.id,
                                permissionOverwrites: this.getChannelPermissions(channelConfig.name, categoryConfig.name, guild, roleMap)
                            });
                            created.channels.push(channel.name);
                            channelMap.set(channelConfig.name, channel.id);
                            logger_1.logger.info(`Created channel: ${channel.name} in ${category.name} for guild ${guild.id}`);
                        }
                        catch (error) {
                            errors.push(`Failed to create channel ${channelConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                    }
                }
                catch (error) {
                    errors.push(`Failed to create category ${categoryConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            // 3. Setup guild configuration
            await this.setupGuildConfig(guild, channelMap, categoryMap, roleMap);
            // 4. Setup role permissions
            await this.setupRolePermissions(guild, roleMap);
            // 5. Create jobs
            let jobsCreated = 0;
            for (const jobConfig of config.defaultJobs) {
                if (!jobConfig.autoCreateOnSetup)
                    continue;
                try {
                    const roleId = roleMap.get(jobConfig.roleName);
                    if (!roleId) {
                        errors.push(`Role ${jobConfig.roleName} not found for job ${jobConfig.title}`);
                        continue;
                    }
                    const roleConfig = config.roles.find(r => r.name === jobConfig.roleName);
                    const limit = roleConfig?.maxCount;
                    const job = {
                        guildId: guild.id,
                        title: jobConfig.title,
                        description: jobConfig.description,
                        staffRole: jobConfig.roleName,
                        roleId: roleId,
                        limit: limit,
                        isOpen: jobConfig.isOpenByDefault,
                        questions: [...job_1.DEFAULT_JOB_QUESTIONS, ...jobConfig.customQuestions],
                        postedBy: guild.ownerId,
                        applicationCount: 0,
                        hiredCount: 0,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    await this.jobRepository.add(job);
                    jobsCreated++;
                    logger_1.logger.info(`Created job: ${jobConfig.title} for role ${jobConfig.roleName} in guild ${guild.id}`);
                }
                catch (error) {
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
        }
        catch (error) {
            logger_1.logger.error('Error in Anarchy server setup:', error);
            return {
                success: false,
                message: 'Anarchy server setup failed',
                created,
                wiped: { collections: [], channels: 0, roles: 0 },
                errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async wipeServer(guild) {
        const wiped = {
            collections: [],
            channels: 0,
            roles: 0
        };
        const errors = [];
        try {
            logger_1.logger.info(`Starting server wipe for guild ${guild.id}`);
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
                        }
                        catch (deleteError) {
                            logger_1.logger.warn(`Failed to delete individual record from ${collection.name}:`, deleteError);
                        }
                    }
                    wiped.collections.push(`${collection.name} (${deleteCount} records)`);
                    logger_1.logger.info(`Wiped ${deleteCount} records from ${collection.name} for guild ${guild.id}`);
                }
                catch (error) {
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
                    logger_1.logger.info(`Deleted channel/category: ${channel.name} for guild ${guild.id}`);
                }
                catch (error) {
                    errors.push(`Failed to delete channel ${channel.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            // 3. Delete ALL roles (except protected ones)
            const allRoles = guild.roles.cache.filter(role => {
                if (role.id === guild.id)
                    return false; // @everyone
                if (role.position >= guild.members.me.roles.highest.position)
                    return false; // Higher than bot
                if (role.managed)
                    return false; // Bot roles, booster roles, etc.
                return true;
            });
            for (const [, role] of allRoles) {
                try {
                    await role.delete('Complete server wipe for Anarchy setup');
                    wiped.roles++;
                    logger_1.logger.info(`Deleted role: ${role.name} for guild ${guild.id}`);
                }
                catch (error) {
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
                            hr: [],
                            case: [],
                            config: [],
                            retainer: [],
                            repair: []
                        },
                        adminRoles: [],
                        adminUsers: []
                    });
                }
            }
            catch (error) {
                errors.push(`Failed to reset guild config: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            return {
                success: errors.length === 0,
                message: `COMPLETE server wipe finished. Destroyed ${wiped.channels} channels/categories, ${wiped.roles} roles, wiped ${wiped.collections.length} database collections${errors.length > 0 ? ` with ${errors.length} errors` : ''}.`,
                wiped,
                errors
            };
        }
        catch (error) {
            logger_1.logger.error('Error in server wipe:', error);
            return {
                success: false,
                message: 'Server wipe failed',
                wiped,
                errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    parseColor(color) {
        const colorMap = {
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
    getCategoryPermissions(categoryName, guild, roleMap) {
        const permissions = [];
        // Default: Hide from @everyone
        permissions.push({
            id: guild.id,
            deny: [discord_js_1.PermissionFlagsBits.ViewChannel]
        });
        // Category-specific permissions
        switch (categoryName) {
            case 'Information':
                // Everyone can view information channels
                permissions[0] = {
                    id: guild.id,
                    allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.ReadMessageHistory],
                    deny: []
                };
                break;
            case 'Client Services':
                // Clients and staff can access
                const clientRoleId = roleMap.get('Client');
                if (clientRoleId) {
                    permissions.push({
                        id: clientRoleId,
                        allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.ReadMessageHistory]
                    });
                }
                break;
            case 'Legal Team':
                // Only legal staff (not clients/hiring staff)
                const legalRoles = ['Managing Partner', 'Senior Partner', 'Partner', 'Senior Associate', 'Associate', 'Paralegal'];
                for (const roleName of legalRoles) {
                    const roleId = roleMap.get(roleName);
                    if (roleId) {
                        permissions.push({
                            id: roleId,
                            allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory]
                        });
                    }
                }
                break;
            case 'Staff':
                // All staff roles
                const staffRoles = ['Managing Partner', 'Senior Partner', 'Partner', 'Senior Associate', 'Associate', 'Paralegal', 'Hiring Staff'];
                for (const roleName of staffRoles) {
                    const roleId = roleMap.get(roleName);
                    if (roleId) {
                        permissions.push({
                            id: roleId,
                            allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory]
                        });
                    }
                }
                break;
            case 'Administration':
                // Only management roles
                const adminRoles = ['Managing Partner', 'Senior Partner', 'Partner'];
                for (const roleName of adminRoles) {
                    const roleId = roleMap.get(roleName);
                    if (roleId) {
                        permissions.push({
                            id: roleId,
                            allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory, discord_js_1.PermissionFlagsBits.ManageMessages]
                        });
                    }
                }
                break;
        }
        return permissions;
    }
    getChannelPermissions(channelName, categoryName, guild, roleMap) {
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
                    allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.ReadMessageHistory],
                    deny: [discord_js_1.PermissionFlagsBits.SendMessages]
                };
                const managingPartnerId = roleMap.get('Managing Partner');
                const seniorPartnerId = roleMap.get('Senior Partner');
                if (managingPartnerId) {
                    permissions.push({
                        id: managingPartnerId,
                        allow: [discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ManageMessages]
                    });
                }
                if (seniorPartnerId) {
                    permissions.push({
                        id: seniorPartnerId,
                        allow: [discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ManageMessages]
                    });
                }
                break;
            case 'feedback':
                // Clients can send, read-only for others
                const clientId = roleMap.get('Client');
                if (clientId) {
                    permissions.push({
                        id: clientId,
                        allow: [discord_js_1.PermissionFlagsBits.SendMessages]
                    });
                }
                break;
            case 'modlog':
                // View only, no sending
                permissions.forEach(perm => {
                    if (perm.allow && Array.isArray(perm.allow)) {
                        perm.allow = perm.allow.filter(p => p !== discord_js_1.PermissionFlagsBits.SendMessages);
                    }
                });
                break;
        }
        return permissions;
    }
    async setupGuildConfig(guild, channelMap, categoryMap, roleMap) {
        const config = await this.guildConfigRepository.ensureGuildConfig(guild.id);
        if (config._id) {
            await this.guildConfigRepository.update(config._id.toString(), {
                feedbackChannelId: channelMap.get('feedback'),
                retainerChannelId: channelMap.get('signed-retainers'),
                modlogChannelId: channelMap.get('modlog'),
                applicationChannelId: channelMap.get('applications'),
                caseReviewCategoryId: categoryMap.get('Case Reviews'),
                caseArchiveCategoryId: categoryMap.get('Case Archives'),
                clientRoleId: roleMap.get('Client'),
                permissions: {
                    admin: [],
                    hr: [],
                    case: [],
                    config: [],
                    retainer: [],
                    repair: []
                },
                adminRoles: [],
                adminUsers: [guild.ownerId] // Guild owner is always admin
            });
        }
        logger_1.logger.info(`Guild configuration updated for guild ${guild.id}`);
    }
    async setupRolePermissions(guild, roleMap) {
        try {
            for (const [roleName, actions] of Object.entries(server_setup_config_1.DEFAULT_ROLE_PERMISSIONS)) {
                const roleId = roleMap.get(roleName);
                if (!roleId)
                    continue;
                for (const action of actions) {
                    try {
                        await this.guildConfigRepository.setPermissionRole(guild.id, action, roleId);
                        logger_1.logger.info(`Set ${action} permission for role ${roleName} in guild ${guild.id}`);
                    }
                    catch (error) {
                        logger_1.logger.warn(`Failed to set ${action} permission for role ${roleName}:`, error);
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error setting up role permissions:', error);
        }
    }
}
exports.AnarchyServerSetupService = AnarchyServerSetupService;
//# sourceMappingURL=anarchy-server-setup-service.js.map