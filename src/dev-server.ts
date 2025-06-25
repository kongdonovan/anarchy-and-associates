import 'reflect-metadata';
import { DIService, MetadataStorage } from "discordx";
import { config as envConfig } from "dotenv";
import path from "node:path";
import watch from "node-watch";
// import { fileURLToPath } from "url"; // Not needed for CommonJS
import { logger } from './infrastructure/logger';
import { MongoDbClient } from './infrastructure/database/mongo-client';

// Get __dirname equivalent for CommonJS (since we're compiling to CommonJS)
const currentDirname = __dirname;

// Import pattern for command files
const importPattern = path.posix.join(
  currentDirname.replace(/\\/g, "/"),
  "presentation",
  "commands",
  "**",
  "*.js"  // We import the compiled JS files
);

// Bot client instance
let client: any = null;
let mongoClient: MongoDbClient | null = null;

/**
 * Load all files matching the pattern
 */
async function loadFiles(src: string): Promise<void> {
  const { importx } = await import("@discordx/importer");
  await importx(src);
}

/**
 * Initialize MongoDB connection
 */
async function initializeDatabase(): Promise<void> {
  if (!mongoClient) {
    mongoClient = MongoDbClient.getInstance();
    await mongoClient.connect();
    logger.info('MongoDB connected successfully');
  }
}

/**
 * Initialize commands safely, checking for duplicates
 */
async function initializeCommandsSafely(client: any): Promise<void> {
  try {
    logger.info('Initializing application commands...');
    
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
    
    if (existingCommands && existingCommands.size > 0) {
      // Check if commands are already registered and up to date
      const needsUpdate = localCommands.some((localCmd: any) => {
        const existingCmd = existingCommands.find((cmd: any) => cmd.name === localCmd.name);
        if (!existingCmd) {
          logger.info(`New command found: ${localCmd.name}`);
          return true;
        }
        
        // Check if command description changed
        if (existingCmd.description !== localCmd.description) {
          logger.info(`Command ${localCmd.name} description changed`);
          return true;
        }
        
        return false;
      });
      
      // Check for orphaned commands
      const orphanedCommands = existingCommands.filter((discordCmd: any) => 
        !localCommands.some((localCmd: any) => localCmd.name === discordCmd.name)
      );
      
      if (orphanedCommands.size > 0) {
        logger.info(`Found ${orphanedCommands.size} orphaned commands that will be removed`);
      }
      
      if (!needsUpdate && orphanedCommands.size === 0) {
        logger.info('All commands are already up to date, skipping registration');
      } else {
        logger.info('Command differences detected, updating commands...');
        await client.initApplicationCommands();
        logger.info('Slash commands updated successfully');
      }
    } else {
      // No existing commands or couldn't fetch them, proceed with normal registration
      logger.info('No existing commands found, registering all commands...');
      await client.initApplicationCommands();
      logger.info('Slash commands initialized successfully');
    }
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

  const { Client } = await import("discordx");
  const { GatewayIntentBits } = await import("discord.js");

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
    if (!client.user) return;
    
    logger.info(`Bot logged in as ${client.user.tag}`);
    
    // Initialize slash commands with smart duplicate prevention
    await initializeCommandsSafely(client);
  });

  client.on('interactionCreate', async (interaction: any) => {
    try {
      client.executeInteraction(interaction);
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
 * Reload discordx metadata and events
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
      
      // Re-initialize commands safely (checking for duplicates)
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
    // Load environment variables
    envConfig();
    
    // Initialize database first
    await initializeDatabase();
    
    // Load initial command files
    await loadFiles(importPattern);
    
    // Initialize Discord client
    await initializeClient();

    // Setup hot reload in development
    if (process.env.NODE_ENV !== "production") {
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