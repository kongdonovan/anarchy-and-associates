"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const discordx_1 = require("discordx");
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const importer_1 = require("@discordx/importer");
const logger_1 = require("./infrastructure/logger");
const mongo_client_1 = require("./infrastructure/database/mongo-client");
const reminder_service_1 = require("./application/services/reminder-service");
const role_tracking_service_1 = require("./application/services/role-tracking-service");
const reminder_repository_1 = require("./infrastructure/repositories/reminder-repository");
const case_repository_1 = require("./infrastructure/repositories/case-repository");
const staff_repository_1 = require("./infrastructure/repositories/staff-repository");
// import path from 'path'; // Not needed
// Load environment variables
(0, dotenv_1.config)();
let mongoClient = null;
let reminderService = null;
let roleTrackingService = null;
/**
 * Initialize MongoDB connection and ensure global availability
 */
async function initializeDatabase() {
    if (!mongoClient) {
        mongoClient = mongo_client_1.MongoDbClient.getInstance();
        await mongoClient.connect();
        logger_1.logger.info('MongoDB connected successfully');
        // Ensure the connection is globally available for when command files are imported
        global.__mongoClient = mongoClient;
    }
}
/**
 * Initialize all bot services after database connection
 */
function initializeServices() {
    // Initialize repositories and services after database connection
    const reminderRepository = new reminder_repository_1.ReminderRepository();
    const caseRepository = new case_repository_1.CaseRepository();
    const staffRepository = new staff_repository_1.StaffRepository();
    reminderService = new reminder_service_1.ReminderService(reminderRepository, caseRepository, staffRepository);
    roleTrackingService = new role_tracking_service_1.RoleTrackingService();
    logger_1.logger.info('Services initialized successfully');
}
/**
 * Main function to start the bot
 */
async function start() {
    try {
        // CRITICAL: Initialize database BEFORE importing commands
        // Command classes instantiate repositories in their constructors
        await initializeDatabase();
        // Initialize services that depend on database connection
        initializeServices();
        // Import commands AFTER database is connected
        logger_1.logger.info('Importing command modules...');
        // When running with ts-node-dev, __dirname is in src/, so we need to go to dist/
        const commandPath = `${__dirname}/../dist/presentation/commands/**/*.js`;
        logger_1.logger.info(`Attempting to import from: ${commandPath}`);
        // First let's see what files exist
        const { resolve } = await Promise.resolve().then(() => __importStar(require("@discordx/importer")));
        const files = await resolve(commandPath);
        logger_1.logger.info(`Found ${files.length} command files:`, files);
        await (0, importer_1.importx)(commandPath);
        logger_1.logger.info('Command modules imported successfully');
        // Create Discord client AFTER commands are imported
        // Use guild-specific commands for faster development
        const client = new discordx_1.Client({
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildMessages,
                discord_js_1.GatewayIntentBits.GuildMembers,
                discord_js_1.GatewayIntentBits.MessageContent,
            ],
            silent: false,
            // Use guild commands for faster updates and to avoid global command conflicts
            // Will be set dynamically after client is ready
        });
        // Setup ready event
        client.once('ready', async () => {
            if (!client.user)
                return;
            logger_1.logger.info(`Bot logged in as ${client.user.tag}`);
            // Set bot activity
            client.user.setActivity('Managing Legal Operations', {
                type: discord_js_1.ActivityType.Watching,
            });
            // Initialize reminder service with Discord client (only if it exists)
            if (reminderService) {
                reminderService.setDiscordClient(client);
                logger_1.logger.info('Reminder service integrated with Discord client');
            }
            // Initialize role tracking service
            if (roleTrackingService) {
                roleTrackingService.initializeTracking(client);
                logger_1.logger.info('Role tracking service initialized');
            }
            // Debug: Check how many commands are registered
            logger_1.logger.info(`Found ${client.applicationCommands.length} application commands in client`);
            client.applicationCommands.forEach((cmd, index) => {
                logger_1.logger.info(`Command ${index + 1}: ${cmd.name} (${cmd.description})`);
            });
            // Check if we're running in guild-specific mode or global
            logger_1.logger.info('Bot configuration:', {
                botId: client.botId,
                botGuilds: client.botGuilds,
                guildCount: client.guilds.cache.size
            });
            // Initialize slash commands as guild commands for all guilds
            try {
                logger_1.logger.info('Initializing guild-specific commands...');
                // Get all guild IDs where the bot is present
                const guildIds = Array.from(client.guilds.cache.keys());
                logger_1.logger.info(`Registering commands for ${guildIds.length} guilds`);
                // Set botGuilds dynamically and initialize commands
                client.botGuilds = guildIds;
                // Initialize commands (will use the botGuilds we just set)
                await client.initApplicationCommands();
                logger_1.logger.info('✅ Guild commands initialized successfully');
                // Debug: Check registered commands per guild
                for (const guildId of guildIds) {
                    try {
                        const guild = client.guilds.cache.get(guildId);
                        if (guild) {
                            const guildCommands = await guild.commands.fetch();
                            logger_1.logger.info(`Guild ${guild.name}: ${guildCommands.size} commands registered`);
                        }
                    }
                    catch (guildError) {
                        logger_1.logger.warn(`Could not fetch commands for guild ${guildId}:`, guildError);
                    }
                }
            }
            catch (error) {
                logger_1.logger.error('Error initializing commands:', error);
                // Try to continue without failing the entire bot
                if (error instanceof Error && error.message.includes('timed out')) {
                    logger_1.logger.warn('Command initialization timed out, but bot will continue running');
                }
            }
        });
        // Setup interaction handling
        client.on('interactionCreate', async (interaction) => {
            try {
                client.executeInteraction(interaction);
            }
            catch (error) {
                logger_1.logger.error('Error executing interaction:', error);
            }
        });
        // Login to Discord
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            throw new Error('DISCORD_BOT_TOKEN environment variable is required');
        }
        await client.login(token);
        // Setup graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger_1.logger.info(`Received ${signal}, shutting down gracefully...`);
            try {
                await client.destroy();
                if (mongoClient) {
                    await mongoClient.disconnect();
                }
                logger_1.logger.info('Graceful shutdown completed');
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        };
        // Handle process termination signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        // Handle uncaught exceptions and rejections
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught exception:', error);
            gracefulShutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection');
        });
        logger_1.logger.info('Bot started successfully with discordx');
    }
    catch (error) {
        logger_1.logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}
// Start the bot
void start();
//# sourceMappingURL=simple-dev.js.map