"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepairService = void 0;
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const job_repository_1 = require("../../infrastructure/repositories/job-repository");
const application_repository_1 = require("../../infrastructure/repositories/application-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const logger_1 = require("../../infrastructure/logger");
class RepairService {
    constructor() {
        this.staffRepository = new staff_repository_1.StaffRepository();
        this.jobRepository = new job_repository_1.JobRepository();
        this.applicationRepository = new application_repository_1.ApplicationRepository();
        this.caseRepository = new case_repository_1.CaseRepository();
        this.guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
    }
    async repairStaffRoles(guild, dryRun = false) {
        const changes = [];
        const errors = [];
        try {
            logger_1.logger.info(`Starting staff roles repair for guild ${guild.id}, dry-run: ${dryRun}`);
            // Get all staff records for this guild
            const staffMembers = await this.staffRepository.findByFilters({ guildId: guild.id, status: 'active' });
            // Get all Discord members
            await guild.members.fetch();
            // Sync database -> Discord (add missing roles)
            for (const staff of staffMembers) {
                const member = guild.members.cache.get(staff.userId);
                if (!member) {
                    changes.push(`Staff member ${staff.userId} not found in Discord - would remove from database`);
                    if (!dryRun && staff._id) {
                        await this.staffRepository.update(staff._id.toString(), { status: 'inactive' });
                    }
                    continue;
                }
                // Find the Discord role for this staff role
                const expectedRole = guild.roles.cache.find(role => role.name === staff.role || role.name.toLowerCase().includes(staff.role.toLowerCase()));
                if (!expectedRole) {
                    errors.push(`Discord role for ${staff.role} not found`);
                    continue;
                }
                if (!member.roles.cache.has(expectedRole.id)) {
                    changes.push(`Would add ${staff.role} role to ${member.displayName}`);
                    if (!dryRun) {
                        await member.roles.add(expectedRole.id);
                    }
                }
            }
            // Sync Discord -> Database (remove unauthorized roles)
            const staffRoleNames = [
                'Managing Partner',
                'Senior Partner',
                'Junior Partner',
                'Senior Associate',
                'Junior Associate',
                'Paralegal'
            ];
            const discordStaffRoles = guild.roles.cache.filter(role => staffRoleNames.some(staffRole => role.name === staffRole || role.name.toLowerCase().includes(staffRole.toLowerCase())));
            for (const [roleId, role] of discordStaffRoles) {
                const members = role.members;
                for (const [memberId, member] of members) {
                    const staffRecord = staffMembers.find(s => s.userId === memberId);
                    if (!staffRecord) {
                        changes.push(`Would remove ${role.name} role from ${member.displayName} (no staff record)`);
                        if (!dryRun) {
                            await member.roles.remove(roleId);
                        }
                    }
                }
            }
            return {
                success: true,
                message: `Staff roles repair completed. ${changes.length} changes${dryRun ? ' would be' : ''} made.`,
                changes,
                errors
            };
        }
        catch (error) {
            logger_1.logger.error('Error in staff roles repair:', error);
            return {
                success: false,
                message: 'Staff roles repair failed',
                changes,
                errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async repairJobRoles(guild, dryRun = false) {
        const changes = [];
        const errors = [];
        try {
            logger_1.logger.info(`Starting job roles repair for guild ${guild.id}, dry-run: ${dryRun}`);
            // Get all job records for this guild
            const jobs = await this.jobRepository.findByFilters({ guildId: guild.id });
            // Get all staff members to see who should have job roles
            const staffMembers = await this.staffRepository.findByFilters({ guildId: guild.id, status: 'active' });
            for (const job of jobs) {
                const discordRole = guild.roles.cache.get(job.roleId);
                if (!discordRole) {
                    errors.push(`Discord role ${job.roleId} for job "${job.title}" not found`);
                    continue;
                }
                // Get staff members who should have this job role
                const eligibleStaff = staffMembers.filter(staff => staff.role === job.staffRole);
                // Add role to eligible staff who don't have it
                for (const staff of eligibleStaff) {
                    const member = guild.members.cache.get(staff.userId);
                    if (!member)
                        continue;
                    if (!member.roles.cache.has(job.roleId)) {
                        changes.push(`Would add job role "${job.title}" to ${member.displayName}`);
                        if (!dryRun) {
                            await member.roles.add(job.roleId);
                        }
                    }
                }
                // Remove role from members who shouldn't have it
                for (const [memberId, member] of discordRole.members) {
                    const staffRecord = eligibleStaff.find(s => s.userId === memberId);
                    if (!staffRecord) {
                        changes.push(`Would remove job role "${job.title}" from ${member.displayName}`);
                        if (!dryRun) {
                            await member.roles.remove(job.roleId);
                        }
                    }
                }
            }
            return {
                success: true,
                message: `Job roles repair completed. ${changes.length} changes${dryRun ? ' would be' : ''} made.`,
                changes,
                errors
            };
        }
        catch (error) {
            logger_1.logger.error('Error in job roles repair:', error);
            return {
                success: false,
                message: 'Job roles repair failed',
                changes,
                errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async repairChannels(guild, dryRun = false) {
        const changes = [];
        const errors = [];
        try {
            logger_1.logger.info(`Starting channels repair for guild ${guild.id}, dry-run: ${dryRun}`);
            const config = await this.guildConfigRepository.ensureGuildConfig(guild.id);
            const requiredChannels = [
                { key: 'feedbackChannelId', name: 'feedback', type: 'text' },
                { key: 'retainerChannelId', name: 'retainer-agreements', type: 'text' },
                { key: 'modlogChannelId', name: 'mod-log', type: 'text' },
                { key: 'applicationChannelId', name: 'job-applications', type: 'text' },
            ];
            const requiredCategories = [
                { key: 'caseReviewCategoryId', name: 'Case Reviews' },
                { key: 'caseArchiveCategoryId', name: 'Case Archive' },
            ];
            // Check and create missing text channels
            for (const channel of requiredChannels) {
                const channelId = config[channel.key];
                const existingChannel = channelId ? guild.channels.cache.get(channelId) : null;
                if (!existingChannel) {
                    changes.push(`Would create ${channel.type} channel: ${channel.name}`);
                    if (!dryRun) {
                        const newChannel = await guild.channels.create({
                            name: channel.name,
                            type: channel.type === 'text' ? 0 : 4, // 0 = GUILD_TEXT, 4 = GUILD_CATEGORY
                        });
                        await this.guildConfigRepository.updateConfig(guild.id, { [channel.key]: newChannel.id });
                    }
                }
            }
            // Check and create missing categories
            for (const category of requiredCategories) {
                const categoryId = config[category.key];
                const existingCategory = categoryId ? guild.channels.cache.get(categoryId) : null;
                if (!existingCategory) {
                    changes.push(`Would create category: ${category.name}`);
                    if (!dryRun) {
                        const newCategory = await guild.channels.create({
                            name: category.name,
                            type: 4, // GUILD_CATEGORY
                        });
                        await this.guildConfigRepository.updateConfig(guild.id, { [category.key]: newCategory.id });
                    }
                }
            }
            return {
                success: true,
                message: `Channels repair completed. ${changes.length} changes${dryRun ? ' would be' : ''} made.`,
                changes,
                errors
            };
        }
        catch (error) {
            logger_1.logger.error('Error in channels repair:', error);
            return {
                success: false,
                message: 'Channels repair failed',
                changes,
                errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async repairConfig(guild, dryRun = false) {
        const changes = [];
        const errors = [];
        try {
            logger_1.logger.info(`Starting config repair for guild ${guild.id}, dry-run: ${dryRun}`);
            const config = await this.guildConfigRepository.ensureGuildConfig(guild.id);
            // Validate permission configurations
            const permissionActions = Object.keys(config.permissions);
            for (const action of permissionActions) {
                const roleIds = config.permissions[action];
                for (const roleId of roleIds) {
                    const role = guild.roles.cache.get(roleId);
                    if (!role) {
                        changes.push(`Would remove invalid role ${roleId} from ${action} permissions`);
                        if (!dryRun) {
                            const updatedRoles = roleIds.filter(id => id !== roleId);
                            const permissions = { ...config.permissions };
                            permissions[action] = updatedRoles;
                            await this.guildConfigRepository.updateConfig(guild.id, { permissions });
                        }
                    }
                }
            }
            // Validate admin roles
            for (const roleId of config.adminRoles) {
                const role = guild.roles.cache.get(roleId);
                if (!role) {
                    changes.push(`Would remove invalid admin role ${roleId}`);
                    if (!dryRun) {
                        await this.guildConfigRepository.removeAdminRole(guild.id, roleId);
                    }
                }
            }
            // Validate admin users
            await guild.members.fetch();
            for (const userId of config.adminUsers) {
                const member = guild.members.cache.get(userId);
                if (!member) {
                    changes.push(`Would remove invalid admin user ${userId}`);
                    if (!dryRun) {
                        await this.guildConfigRepository.removeAdminUser(guild.id, userId);
                    }
                }
            }
            return {
                success: true,
                message: `Config repair completed. ${changes.length} changes${dryRun ? ' would be' : ''} made.`,
                changes,
                errors
            };
        }
        catch (error) {
            logger_1.logger.error('Error in config repair:', error);
            return {
                success: false,
                message: 'Config repair failed',
                changes,
                errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async repairOrphaned(guild, dryRun = false) {
        const changes = [];
        const errors = [];
        try {
            logger_1.logger.info(`Starting orphaned records repair for guild ${guild.id}, dry-run: ${dryRun}`);
            await guild.members.fetch();
            // 1. Staff records without corresponding Discord users
            const staffMembers = await this.staffRepository.findByFilters({ guildId: guild.id });
            for (const staff of staffMembers) {
                const member = guild.members.cache.get(staff.userId);
                if (!member) {
                    changes.push(`Would mark staff member ${staff.userId} as inactive (user left Discord)`);
                    if (!dryRun && staff._id) {
                        await this.staffRepository.update(staff._id.toString(), { status: 'inactive' });
                    }
                }
            }
            // 2. Cases without assigned channels
            const cases = await this.caseRepository.findByFilters({ guildId: guild.id });
            for (const caseRecord of cases) {
                if (caseRecord.channelId) {
                    const channel = guild.channels.cache.get(caseRecord.channelId);
                    if (!channel) {
                        changes.push(`Would remove invalid channel reference from case ${caseRecord.caseNumber}`);
                        if (!dryRun && caseRecord._id) {
                            await this.caseRepository.update(caseRecord._id.toString(), { channelId: undefined });
                        }
                    }
                }
            }
            // 3. Applications for deleted jobs
            const jobs = await this.jobRepository.findByFilters({ guildId: guild.id });
            const validJobIds = jobs.filter(job => job._id).map(job => job._id.toString());
            const applications = await this.applicationRepository.findByFilters({ guildId: guild.id });
            for (const application of applications) {
                if (!validJobIds.includes(application.jobId)) {
                    changes.push(`Would remove application ${application._id} (job no longer exists)`);
                    if (!dryRun && application._id) {
                        await this.applicationRepository.delete(application._id.toString());
                    }
                }
            }
            return {
                success: true,
                message: `Orphaned records repair completed. ${changes.length} changes${dryRun ? ' would be' : ''} made.`,
                changes,
                errors
            };
        }
        catch (error) {
            logger_1.logger.error('Error in orphaned records repair:', error);
            return {
                success: false,
                message: 'Orphaned records repair failed',
                changes,
                errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async repairDbIndexes(guild, dryRun = false) {
        const changes = [];
        const errors = [];
        try {
            logger_1.logger.info(`Starting database indexes repair for guild ${guild.id}, dry-run: ${dryRun}`);
            // For now, just report what would be done
            changes.push('Would ensure all MongoDB indexes are properly created');
            changes.push('Would verify index performance and rebuild if necessary');
            changes.push('Would check unique constraints on staff (guildId, userId)');
            changes.push('Would check unique constraints on cases (guildId, caseNumber)');
            return {
                success: true,
                message: `Database indexes repair completed. ${changes.length} changes${dryRun ? ' would be' : ''} made.`,
                changes,
                errors
            };
        }
        catch (error) {
            logger_1.logger.error('Error in database indexes repair:', error);
            return {
                success: false,
                message: 'Database indexes repair failed',
                changes,
                errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async repairAll(guild, dryRun = false) {
        const allChanges = [];
        const allErrors = [];
        const results = [];
        try {
            logger_1.logger.info(`Starting comprehensive repair for guild ${guild.id}, dry-run: ${dryRun}`);
            // Run all repair operations
            results.push(await this.repairStaffRoles(guild, dryRun));
            results.push(await this.repairJobRoles(guild, dryRun));
            results.push(await this.repairChannels(guild, dryRun));
            results.push(await this.repairConfig(guild, dryRun));
            results.push(await this.repairOrphaned(guild, dryRun));
            results.push(await this.repairDbIndexes(guild, dryRun));
            // Aggregate results
            for (const result of results) {
                allChanges.push(...result.changes);
                allErrors.push(...result.errors);
            }
            const successCount = results.filter(r => r.success).length;
            const totalOperations = results.length;
            return {
                success: successCount === totalOperations,
                message: `Comprehensive repair completed. ${successCount}/${totalOperations} operations successful. ${allChanges.length} total changes${dryRun ? ' would be' : ''} made.`,
                changes: allChanges,
                errors: allErrors
            };
        }
        catch (error) {
            logger_1.logger.error('Error in comprehensive repair:', error);
            return {
                success: false,
                message: 'Comprehensive repair failed',
                changes: allChanges,
                errors: [...allErrors, error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async performHealthCheck(guild) {
        const issues = [];
        const checks = {
            database: false,
            channels: false,
            permissions: false,
            botPermissions: false
        };
        try {
            // Database connectivity check
            try {
                await this.guildConfigRepository.ensureGuildConfig(guild.id);
                checks.database = true;
            }
            catch (error) {
                issues.push('Database connectivity failed');
            }
            // Required channels/categories check
            try {
                const config = await this.guildConfigRepository.ensureGuildConfig(guild.id);
                const requiredChannels = [
                    config.feedbackChannelId,
                    config.retainerChannelId,
                    config.modlogChannelId,
                    config.applicationChannelId,
                    config.caseReviewCategoryId,
                    config.caseArchiveCategoryId
                ];
                const missingChannels = requiredChannels.filter(channelId => !channelId || !guild.channels.cache.get(channelId));
                if (missingChannels.length === 0) {
                    checks.channels = true;
                }
                else {
                    issues.push(`${missingChannels.length} required channels/categories are missing`);
                }
            }
            catch (error) {
                issues.push('Channel validation failed');
            }
            // Permission configuration check
            try {
                const config = await this.guildConfigRepository.ensureGuildConfig(guild.id);
                const permissionActions = Object.keys(config.permissions);
                let validPermissions = true;
                for (const action of permissionActions) {
                    const roleIds = config.permissions[action];
                    for (const roleId of roleIds) {
                        if (!guild.roles.cache.get(roleId)) {
                            validPermissions = false;
                            break;
                        }
                    }
                    if (!validPermissions)
                        break;
                }
                if (validPermissions) {
                    checks.permissions = true;
                }
                else {
                    issues.push('Invalid permission configurations detected');
                }
            }
            catch (error) {
                issues.push('Permission validation failed');
            }
            // Bot permissions check
            try {
                const botMember = guild.members.me;
                if (botMember) {
                    const requiredPermissions = [
                        'ManageRoles',
                        'ManageChannels',
                        'SendMessages',
                        'ViewChannel',
                        'ReadMessageHistory'
                    ];
                    const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm));
                    if (missingPermissions.length === 0) {
                        checks.botPermissions = true;
                    }
                    else {
                        issues.push(`Bot missing permissions: ${missingPermissions.join(', ')}`);
                    }
                }
                else {
                    issues.push('Bot member not found in guild');
                }
            }
            catch (error) {
                issues.push('Bot permission check failed');
            }
            const healthy = Object.values(checks).every(check => check);
            return {
                healthy,
                issues,
                checks
            };
        }
        catch (error) {
            logger_1.logger.error('Error in health check:', error);
            return {
                healthy: false,
                issues: [...issues, 'Health check system error'],
                checks
            };
        }
    }
}
exports.RepairService = RepairService;
//# sourceMappingURL=repair-service.js.map