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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const discordx_1 = require("discordx");
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const importer_1 = require("@discordx/importer");
const node_path_1 = __importDefault(require("node:path"));
const node_watch_1 = __importDefault(require("node-watch"));
const logger_1 = require("./infrastructure/logger");
const mongo_client_1 = require("./infrastructure/database/mongo-client");
const reminder_service_1 = require("./application/services/reminder-service");
const role_tracking_service_1 = require("./application/services/role-tracking-service");
const reminder_repository_1 = require("./infrastructure/repositories/reminder-repository");
const case_repository_1 = require("./infrastructure/repositories/case-repository");
const staff_repository_1 = require("./infrastructure/repositories/staff-repository");
// Load environment variables
(0, dotenv_1.config)();
// Parse configuration from environment or command line
const config = {
    hotReload: process.env.DEV_HOT_RELOAD !== 'false' && process.argv.includes('--hot'),
    guildCommands: process.env.DEV_GUILD_COMMANDS !== 'false'
};
// Get __dirname equivalent for CommonJS
const currentDirname = __dirname;
// Import pattern for command files
const importPattern = node_path_1.default.posix.join(currentDirname.replace(/\\/g, "/"), "presentation", "commands", "**", "*.js" // We import the compiled JS files
);
// Bot instances
let client = null;
let mongoClient = null;
let reminderService = null;
let roleTrackingService = null;
/**
 * Initialize MongoDB connection
 */
async function initializeDatabase() {
    if (!mongoClient) {
        mongoClient = mongo_client_1.MongoDbClient.getInstance();
        await mongoClient.connect();
        logger_1.logger.info('MongoDB connected successfully');
        // Ensure the connection is globally available for command files
        global.__mongoClient = mongoClient;
    }
}
/**
 * Initialize all bot services after database connection
 */
function initializeServices() {
    const reminderRepository = new reminder_repository_1.ReminderRepository();
    const caseRepository = new case_repository_1.CaseRepository();
    const staffRepository = new staff_repository_1.StaffRepository();
    reminderService = new reminder_service_1.ReminderService(reminderRepository, caseRepository, staffRepository);
    roleTrackingService = new role_tracking_service_1.RoleTrackingService();
    logger_1.logger.info('Services initialized successfully');
}
/**
 * Load all command files matching the pattern
 */
async function loadFiles(src) {
    await (0, importer_1.importx)(src);
    logger_1.logger.info('Command modules imported successfully');
}
/**
 * Initialize commands safely, checking for duplicates
 */
async function initializeCommandsSafely(client) {
    try {
        logger_1.logger.info('Initializing application commands...');
        if (config.guildCommands) {
            // Use guild-specific commands for faster development
            const guildIds = Array.from(client.guilds.cache.keys());
            logger_1.logger.info(`Registering guild commands for ${guildIds.length} guilds`);
            client.botGuilds = guildIds;
        }
        else {
            logger_1.logger.info('Registering global commands');
            client.botGuilds = undefined;
        }
        // Check for existing commands first
        let existingCommands;
        try {
            existingCommands = await client.application?.commands.fetch();
            logger_1.logger.info(`Found ${existingCommands?.size || 0} existing commands on Discord`);
        }
        catch (fetchError) {
            logger_1.logger.warn('Could not fetch existing commands, proceeding with normal initialization:', fetchError);
            existingCommands = null;
        }
        // Get the commands that discordx wants to register
        const localCommands = client.applicationCommands;
        logger_1.logger.info(`Found ${localCommands.length} local commands to register`);
        if (existingCommands && existingCommands.size > 0 && config.hotReload) {
            // In hot reload mode, check if commands need updating
            const needsUpdate = localCommands.some((localCmd) => {
                const existingCmd = existingCommands.find((cmd) => cmd.name === localCmd.name);
                if (!existingCmd) {
                    logger_1.logger.info(`New command found: ${localCmd.name}`);
                    return true;
                }
                if (existingCmd.description !== localCmd.description) {
                    logger_1.logger.info(`Command ${localCmd.name} description changed`);
                    return true;
                }
                return false;
            });
            const orphanedCommands = existingCommands.filter((discordCmd) => !localCommands.some((localCmd) => localCmd.name === discordCmd.name));
            if (orphanedCommands.size > 0) {
                logger_1.logger.info(`Found ${orphanedCommands.size} orphaned commands that will be removed`);
            }
            if (!needsUpdate && orphanedCommands.size === 0) {
                logger_1.logger.info('All commands are already up to date, skipping registration');
                return;
            }
        }
        // Initialize commands
        await client.initApplicationCommands();
        logger_1.logger.info('Slash commands initialized successfully');
    }
    catch (error) {
        logger_1.logger.error('Error initializing commands:', error);
    }
}
/**
 * Initialize the Discord client
 */
async function initializeClient() {
    if (client) {
        return; // Already initialized
    }
    client = new discordx_1.Client({
        intents: [
            discord_js_1.GatewayIntentBits.Guilds,
            discord_js_1.GatewayIntentBits.GuildMessages,
            discord_js_1.GatewayIntentBits.GuildMembers,
            discord_js_1.GatewayIntentBits.MessageContent,
        ],
        silent: false,
    });
    client.once('ready', async () => {
        if (!client || !client.user)
            return;
        logger_1.logger.info(`Bot logged in as ${client.user.tag}`);
        // Set bot activity
        client.user.setActivity('Managing Legal Operations', {
            type: discord_js_1.ActivityType.Watching,
        });
        // Initialize reminder service with Discord client
        if (reminderService) {
            reminderService.setDiscordClient(client);
            logger_1.logger.info('Reminder service integrated with Discord client');
        }
        // Initialize role tracking service
        if (roleTrackingService) {
            roleTrackingService.initializeTracking(client);
            logger_1.logger.info('Role tracking service initialized');
        }
        // Initialize slash commands with smart duplicate prevention
        await initializeCommandsSafely(client);
    });
    client.on('interactionCreate', async (interaction) => {
        try {
            if (client) {
                client.executeInteraction(interaction);
            }
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
}
/**
 * Reload discordx metadata and events (for hot reload)
 */
async function reload() {
    try {
        logger_1.logger.info("> Reloading modules");
        if (client) {
            // Clear existing metadata
            discordx_1.MetadataStorage.clear();
            discordx_1.DIService.engine.clearAllServices();
        }
        // Reload command files
        await loadFiles(importPattern);
        if (client) {
            // Rebuild metadata
            await discordx_1.MetadataStorage.instance.build();
            // Re-initialize commands safely
            await initializeCommandsSafely(client);
            logger_1.logger.info("> Reload success");
        }
    }
    catch (error) {
        logger_1.logger.error('> Reload failed:', error);
    }
}
/**
 * Main entrypoint for development server
 */
async function runDevServer() {
    try {
        logger_1.logger.info('Starting development server with config:', config);
        // Initialize database first (critical for command file imports)
        await initializeDatabase();
        // Initialize services that depend on database connection
        initializeServices();
        // Load initial command files
        await loadFiles(importPattern);
        // Initialize Discord client
        await initializeClient();
        // Setup hot reload if enabled
        if (config.hotReload) {
            logger_1.logger.info("> Hot-Module-Reload enabled. Project will rebuild and reload on changes.");
            logger_1.logger.info("Watching src/ for changes...");
            (0, node_watch_1.default)("src", { recursive: true }, async (evt, filename) => {
                if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
                    logger_1.logger.info(`[${evt}] ${filename}`);
                    try {
                        // Rebuild the entire project before reload
                        const { exec } = await Promise.resolve().then(() => __importStar(require("child_process")));
                        await new Promise((resolve, reject) => {
                            exec("npm run build", (err, stdout, stderr) => {
                                if (err) {
                                    logger_1.logger.error("[build error]", stderr);
                                    reject(err);
                                }
                                else {
                                    if (stdout)
                                        logger_1.logger.info(stdout);
                                    resolve(undefined);
                                }
                            });
                        });
                        // Small delay to ensure build is complete
                        setTimeout(async () => {
                            await reload();
                        }, 1000);
                    }
                    catch (err) {
                        logger_1.logger.error('Hot reload error:', err);
                    }
                }
            });
        }
        else {
            logger_1.logger.info('Hot reload disabled. Restart server to see changes.');
        }
        logger_1.logger.info('Development server started successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to start development server:', error);
        process.exit(1);
    }
}
/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
    logger_1.logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
        if (client) {
            await client.destroy();
        }
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
}
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
// Start the development server
void runDevServer();
//# sourceMappingURL=dev-server.js.map