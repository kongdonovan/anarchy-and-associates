import 'reflect-metadata';
import { Client, DIService, MetadataStorage } from "discordx";
import { GatewayIntentBits, ActivityType } from "discord.js";
import { config as envConfig } from "dotenv";
import { importx } from "@discordx/importer";
import path from "node:path";
import watch from "node-watch";
import { logger } from './infrastructure/logger';
import { MongoDbClient } from './infrastructure/database/mongo-client';
import { ReminderService } from './application/services/reminder-service';
import { RoleTrackingService } from './application/services/role-tracking-service';
import { ReminderRepository } from './infrastructure/repositories/reminder-repository';
import { CaseRepository } from './infrastructure/repositories/case-repository';
import { StaffRepository } from './infrastructure/repositories/staff-repository';

// Load environment variables
envConfig();

// Configuration options
interface DevServerConfig {
  hotReload: boolean;
  guildCommands: boolean;
}

// Parse configuration from environment or command line
const config: DevServerConfig = {
  hotReload: process.env.DEV_HOT_RELOAD !== 'false' && process.argv.includes('--hot'),
  guildCommands: process.env.DEV_GUILD_COMMANDS !== 'false'
};

// Get __dirname equivalent for CommonJS
const currentDirname = __dirname;

// Import pattern for command files
const importPattern = path.posix.join(
  currentDirname.replace(/\\/g, "/"),
  "presentation",
  "commands",
  "**",
  "*.js"  // We import the compiled JS files
);

// Bot instances
let client: Client | null = null;
let mongoClient: MongoDbClient | null = null;
let reminderService: ReminderService | null = null;
let roleTrackingService: RoleTrackingService | null = null;

/**
 * Initialize MongoDB connection
 */
async function initializeDatabase(): Promise<void> {
  if (!mongoClient) {
    mongoClient = MongoDbClient.getInstance();
    await mongoClient.connect();
    logger.info('MongoDB connected successfully');
    
    // Ensure the connection is globally available for command files
    (global as any).__mongoClient = mongoClient;
  }
}

/**
 * Initialize all bot services after database connection
 */
function initializeServices(): void {
  const reminderRepository = new ReminderRepository();
  const caseRepository = new CaseRepository();
  const staffRepository = new StaffRepository();
  reminderService = new ReminderService(reminderRepository, caseRepository, staffRepository);
  roleTrackingService = new RoleTrackingService();
  
  logger.info('Services initialized successfully');
}

/**
 * Load all command files matching the pattern
 */
async function loadFiles(src: string): Promise<void> {
  await importx(src);
  logger.info('Command modules imported successfully');
}

/**
 * Initialize commands safely, checking for duplicates
 */
async function initializeCommandsSafely(client: Client): Promise<void> {
  try {
    logger.info('Initializing application commands...');
    
    if (config.guildCommands) {
      // Use guild-specific commands for faster development
      const guildIds = Array.from(client.guilds.cache.keys());
      logger.info(`Registering guild commands for ${guildIds.length} guilds`);
      (client as any).botGuilds = guildIds;
    } else {
      logger.info('Registering global commands');
      (client as any).botGuilds = undefined;
    }
    
    // Check for existing commands first
    let existingCommands;
    try {
      existingCommands = await client.application?.commands.fetch();
      logger.info(`Found ${existingCommands?.size || 0} existing commands on Discord`);
    } catch (fetchError) {
      logger.warn('Could not fetch existing commands, proceeding with normal initialization:', fetchError);
      existingCommands = null;
    }

    // Get the commands that discordx wants to register
    const localCommands = client.applicationCommands;
    logger.info(`Found ${localCommands.length} local commands to register`);
    
    if (existingCommands && existingCommands.size > 0 && config.hotReload) {
      // In hot reload mode, check if commands need updating
      const needsUpdate = localCommands.some((localCmd: any) => {
        const existingCmd = existingCommands.find((cmd: any) => cmd.name === localCmd.name);
        if (!existingCmd) {
          logger.info(`New command found: ${localCmd.name}`);
          return true;
        }
        
        if (existingCmd.description !== localCmd.description) {
          logger.info(`Command ${localCmd.name} description changed`);
          return true;
        }
        
        return false;
      });
      
      const orphanedCommands = existingCommands.filter((discordCmd: any) => 
        !localCommands.some((localCmd: any) => localCmd.name === discordCmd.name)
      );
      
      if (orphanedCommands.size > 0) {
        logger.info(`Found ${orphanedCommands.size} orphaned commands that will be removed`);
      }
      
      if (!needsUpdate && orphanedCommands.size === 0) {
        logger.info('All commands are already up to date, skipping registration');
        return;
      }
    }
    
    // Initialize commands
    await client.initApplicationCommands();
    logger.info('Slash commands initialized successfully');
    
  } catch (error) {
    logger.error('Error initializing commands:', error);
  }
}

/**
 * Initialize the Discord client
 */
async function initializeClient(): Promise<void> {
  if (client) {
    return; // Already initialized
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
    ],
    silent: false,
  });

  client.once('ready', async () => {
    if (!client || !client.user) return;
    
    logger.info(`Bot logged in as ${client.user.tag}`);
    
    // Set bot activity
    client.user.setActivity('Managing Legal Operations', {
      type: ActivityType.Watching,
    });

    // Initialize reminder service with Discord client
    if (reminderService) {
      reminderService.setDiscordClient(client);
      logger.info('Reminder service integrated with Discord client');
    }

    // Initialize role tracking service
    if (roleTrackingService) {
      roleTrackingService.initializeTracking(client);
      logger.info('Role tracking service initialized');
    }
    
    // Initialize slash commands with smart duplicate prevention
    await initializeCommandsSafely(client);
  });

  client.on('interactionCreate', async (interaction: any) => {
    try {
      if (client) {
        client.executeInteraction(interaction);
      }
    } catch (error) {
      logger.error('Error executing interaction:', error);
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
async function reload(): Promise<void> {
  try {
    logger.info("> Reloading modules");
    
    if (client) {
      // Clear existing metadata
      MetadataStorage.clear();
      DIService.engine.clearAllServices();
    }
    
    // Reload command files
    await loadFiles(importPattern);
    
    if (client) {
      // Rebuild metadata
      await MetadataStorage.instance.build();
      
      // Re-initialize commands safely
      await initializeCommandsSafely(client);
      
      logger.info("> Reload success");
    }
  } catch (error) {
    logger.error('> Reload failed:', error);
  }
}

/**
 * Main entrypoint for development server
 */
async function runDevServer(): Promise<void> {
  try {
    logger.info('Starting development server with config:', config);
    
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
      logger.info("> Hot-Module-Reload enabled. Project will rebuild and reload on changes.");
      logger.info("Watching src/ for changes...");
      
      watch(
        "src",
        { recursive: true },
        async (evt, filename) => {
          if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
            logger.info(`[${evt}] ${filename}`);
            try {
              // Rebuild the entire project before reload
              const { exec } = await import("child_process");
              await new Promise((resolve, reject) => {
                exec("npm run build", (err, stdout, stderr) => {
                  if (err) {
                    logger.error("[build error]", stderr);
                    reject(err);
                  } else {
                    if (stdout) logger.info(stdout);
                    resolve(undefined);
                  }
                });
              });
              
              // Small delay to ensure build is complete
              setTimeout(async () => {
                await reload();
              }, 1000);
              
            } catch (err) {
              logger.error('Hot reload error:', err);
            }
          }
        }
      );
    } else {
      logger.info('Hot reload disabled. Restart server to see changes.');
    }

    logger.info('Development server started successfully');
    
  } catch (error) {
    logger.error('Failed to start development server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    if (client) {
      await client.destroy();
    }
    if (mongoClient) {
      await mongoClient.disconnect();
    }
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle process termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the development server
void runDevServer();