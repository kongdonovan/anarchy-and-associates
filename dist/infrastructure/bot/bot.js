"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bot = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const mongo_client_1 = require("../database/mongo-client");
const reminder_service_1 = require("../../application/services/reminder-service");
const role_tracking_service_1 = require("../../application/services/role-tracking-service");
const reminder_repository_1 = require("../repositories/reminder-repository");
const case_repository_1 = require("../repositories/case-repository");
const staff_repository_1 = require("../repositories/staff-repository");
const logger_1 = require("../logger");
const importer_1 = require("@discordx/importer");
class Bot {
    constructor() {
        this.reminderService = null;
        this.roleTrackingService = null;
        this.mongoClient = mongo_client_1.MongoDbClient.getInstance();
        this.client = new discordx_1.Client({
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildMessages,
                discord_js_1.GatewayIntentBits.GuildMembers,
                discord_js_1.GatewayIntentBits.MessageContent,
            ],
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.client.once('ready', async () => {
            if (!this.client.user)
                return;
            logger_1.logger.info(`Bot logged in as ${this.client.user.tag}`);
            // Set bot activity
            this.client.user.setActivity('Managing Legal Operations', {
                type: discord_js_1.ActivityType.Watching,
            });
            // Initialize reminder service with Discord client (only if it exists)
            if (this.reminderService) {
                this.reminderService.setDiscordClient(this.client);
            }
            // Initialize role tracking service
            if (this.roleTrackingService) {
                this.roleTrackingService.initializeTracking(this.client);
                logger_1.logger.info('Role tracking service initialized');
            }
            // Initialize slash commands - this is the proper place according to discordx docs
            await this.initializeCommands();
        });
        this.client.on('guildCreate', (guild) => {
            logger_1.logger.info(`Bot added to guild: ${guild.name} (${guild.id})`);
        });
        this.client.on('guildDelete', (guild) => {
            logger_1.logger.info(`Bot removed from guild: ${guild.name} (${guild.id})`);
        });
        this.client.on('interactionCreate', async (interaction) => {
            try {
                this.client.executeInteraction(interaction);
            }
            catch (error) {
                logger_1.logger.error('Error executing interaction:', error);
            }
        });
    }
    async initializeCommands() {
        try {
            logger_1.logger.info('Initializing application commands...');
            // Smart command registration - check for existing commands first
            let existingCommands;
            try {
                existingCommands = await this.client.application?.commands.fetch();
                logger_1.logger.info(`Found ${existingCommands?.size || 0} existing commands on Discord`);
            }
            catch (fetchError) {
                logger_1.logger.warn('Could not fetch existing commands, proceeding with normal initialization:', fetchError);
                existingCommands = null;
            }
            // Get the commands that discordx wants to register
            const localCommands = this.client.applicationCommands;
            logger_1.logger.info(`Found ${localCommands.length} local commands to register`);
            if (existingCommands && existingCommands.size > 0) {
                // Check if commands are already registered and up to date
                const needsUpdate = localCommands.some(localCmd => {
                    const existingCmd = existingCommands.find(cmd => cmd.name === localCmd.name);
                    if (!existingCmd) {
                        logger_1.logger.info(`New command found: ${localCmd.name}`);
                        return true;
                    }
                    // Check if command description changed
                    if (existingCmd.description !== localCmd.description) {
                        logger_1.logger.info(`Command ${localCmd.name} description changed`);
                        return true;
                    }
                    return false;
                });
                // Check for orphaned commands
                const orphanedCommands = existingCommands.filter(discordCmd => !localCommands.some(localCmd => localCmd.name === discordCmd.name));
                if (orphanedCommands.size > 0) {
                    logger_1.logger.info(`Found ${orphanedCommands.size} orphaned commands that will be removed`);
                }
                if (!needsUpdate && orphanedCommands.size === 0) {
                    logger_1.logger.info('All commands are already up to date, skipping registration');
                }
                else {
                    logger_1.logger.info('Command differences detected, updating commands...');
                    await this.client.initApplicationCommands();
                    logger_1.logger.info('Slash commands updated successfully');
                }
            }
            else {
                // No existing commands or couldn't fetch them, proceed with normal registration
                logger_1.logger.info('No existing commands found, registering all commands...');
                await this.client.initApplicationCommands();
                logger_1.logger.info('Slash commands initialized successfully');
            }
        }
        catch (error) {
            logger_1.logger.error('Error initializing commands:', error);
            // Don't throw - continue with bot startup even if commands fail
        }
    }
    async start() {
        try {
            // Connect to MongoDB first
            await this.mongoClient.connect();
            logger_1.logger.info('MongoDB connected successfully');
            // Initialize services that depend on database connection
            this.initializeServices();
            // Import command modules before login
            logger_1.logger.info('Importing command modules...');
            await (0, importer_1.importx)(`${__dirname}/../../../dist/presentation/commands/**/*.js`);
            logger_1.logger.info('Command modules imported successfully');
            // Login to Discord
            const token = process.env.DISCORD_BOT_TOKEN;
            if (!token) {
                throw new Error('DISCORD_BOT_TOKEN environment variable is required');
            }
            await this.client.login(token);
        }
        catch (error) {
            logger_1.logger.error('Failed to start bot:', error);
            throw error;
        }
    }
    // Clear all commands (useful for development)
    async clearAllCommands() {
        try {
            logger_1.logger.info('Clearing all application commands...');
            // Clear global commands
            await this.client.clearApplicationCommands();
            logger_1.logger.info('All commands cleared successfully');
        }
        catch (error) {
            logger_1.logger.error('Error clearing commands:', error);
            throw error;
        }
    }
    initializeServices() {
        // Initialize repositories and services after database connection
        const reminderRepository = new reminder_repository_1.ReminderRepository();
        const caseRepository = new case_repository_1.CaseRepository();
        const staffRepository = new staff_repository_1.StaffRepository();
        this.reminderService = new reminder_service_1.ReminderService(reminderRepository, caseRepository, staffRepository);
        this.roleTrackingService = new role_tracking_service_1.RoleTrackingService();
        logger_1.logger.info('Services initialized successfully');
    }
    async stop() {
        try {
            // Simple shutdown without aggressive command clearing
            await this.client.destroy();
            await this.mongoClient.disconnect();
            logger_1.logger.info('Bot stopped successfully');
        }
        catch (error) {
            logger_1.logger.error('Error stopping bot:', error);
            throw error;
        }
    }
    // Force clear all commands (useful for development reset)
    async forceResetCommands() {
        try {
            logger_1.logger.info('Force clearing all commands...');
            await this.client.clearApplicationCommands();
            logger_1.logger.info('All commands cleared. Next startup will re-register all commands.');
        }
        catch (error) {
            logger_1.logger.error('Error force clearing commands:', error);
            throw error;
        }
    }
    getClient() {
        return this.client;
    }
}
exports.Bot = Bot;
//# sourceMappingURL=bot.js.map