import 'reflect-metadata';
import { Client } from "discordx";
import { GatewayIntentBits, ActivityType } from "discord.js";
import { config as envConfig } from "dotenv";
import { importx } from "@discordx/importer";
import { logger } from './infrastructure/logger';
import { MongoDbClient } from './infrastructure/database/mongo-client';
import { ReminderService } from './application/services/reminder-service';
import { RoleTrackingService } from './application/services/role-tracking-service';
import { ReminderRepository } from './infrastructure/repositories/reminder-repository';
import { CaseRepository } from './infrastructure/repositories/case-repository';
import { StaffRepository } from './infrastructure/repositories/staff-repository';
// import path from 'path'; // Not needed

// Load environment variables
envConfig();

let mongoClient: MongoDbClient | null = null;
let reminderService: ReminderService | null = null;
let roleTrackingService: RoleTrackingService | null = null;

/**
 * Initialize MongoDB connection and ensure global availability
 */
async function initializeDatabase(): Promise<void> {
  if (!mongoClient) {
    mongoClient = MongoDbClient.getInstance();
    await mongoClient.connect();
    logger.info('MongoDB connected successfully');
    
    // Ensure the connection is globally available for when command files are imported
    (global as any).__mongoClient = mongoClient;
  }
}

/**
 * Initialize all bot services after database connection
 */
function initializeServices(): void {
  // Initialize repositories and services after database connection
  const reminderRepository = new ReminderRepository();
  const caseRepository = new CaseRepository();
  const staffRepository = new StaffRepository();
  reminderService = new ReminderService(reminderRepository, caseRepository, staffRepository);
  roleTrackingService = new RoleTrackingService();
  
  logger.info('Services initialized successfully');
}

/**
 * Main function to start the bot
 */
async function start(): Promise<void> {
  try {
    // CRITICAL: Initialize database BEFORE importing commands
    // Command classes instantiate repositories in their constructors
    await initializeDatabase();
    
    // Initialize services that depend on database connection
    initializeServices();

    // Import commands AFTER database is connected
    logger.info('Importing command modules...');
    // When running with ts-node-dev, __dirname is in src/, so we need to go to dist/
    const commandPath = `${__dirname}/../dist/presentation/commands/**/*.js`;
    logger.info(`Attempting to import from: ${commandPath}`);
    
    // First let's see what files exist
    const { resolve } = await import("@discordx/importer");
    const files = await resolve(commandPath);
    logger.info(`Found ${files.length} command files:`, files);
    
    await importx(commandPath);
    
    logger.info('Command modules imported successfully');

    // Create Discord client AFTER commands are imported
    // Use guild-specific commands for faster development
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
      silent: false,
      // Register commands for specific guild(s) in development for faster updates
      botGuilds: process.env.NODE_ENV !== 'production' ? 
        (process.env.DEV_GUILD_ID ? [process.env.DEV_GUILD_ID] : undefined) : 
        undefined
    });

    // Setup ready event
    client.once('ready', async () => {
      if (!client.user) return;
      
      logger.info(`Bot logged in as ${client.user.tag}`);
      
      // Set bot activity
      client.user.setActivity('Managing Legal Operations', {
        type: ActivityType.Watching,
      });

      // Initialize reminder service with Discord client (only if it exists)
      if (reminderService) {
        reminderService.setDiscordClient(client);
        logger.info('Reminder service integrated with Discord client');
      }

      // Initialize role tracking service
      if (roleTrackingService) {
        roleTrackingService.initializeTracking(client);
        logger.info('Role tracking service initialized');
      }
      
      // Debug: Check how many commands are registered
      logger.info(`Found ${client.applicationCommands.length} application commands in client`);
      client.applicationCommands.forEach((cmd, index) => {
        logger.info(`Command ${index + 1}: ${cmd.name} (${cmd.description})`);
      });
      
      // Check if we're running in guild-specific mode or global
      logger.info('Bot configuration:', {
        botId: client.botId,
        botGuilds: (client as any).botGuilds,
        guildCount: client.guilds.cache.size
      });
      
      // Initialize slash commands with timeout
      try {
        logger.info('Initializing application commands...');
        
        // Add timeout wrapper for initApplicationCommands
        const initWithTimeout = Promise.race([
          client.initApplicationCommands(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('initApplicationCommands timed out after 30 seconds')), 30000)
          )
        ]);
        
        await initWithTimeout;
        logger.info('Slash commands initialized successfully');
        
        // Debug: Check what commands were actually registered on Discord
        try {
          const registeredCommands = await client.application?.commands.fetch();
          logger.info(`Registered ${registeredCommands?.size || 0} commands on Discord:`);
          registeredCommands?.forEach(cmd => {
            logger.info(`- ${cmd.name}: ${cmd.description}`);
          });
        } catch (fetchError) {
          logger.warn('Could not fetch registered commands for verification:', fetchError);
        }
        
      } catch (error) {
        logger.error('Error initializing commands:', error);
        
        // Try to continue without failing the entire bot
        if (error instanceof Error && error.message.includes('timed out')) {
          logger.warn('Command initialization timed out, but bot will continue running');
        }
      }
    });

    // Setup interaction handling
    client.on('interactionCreate', async (interaction) => {
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

    // Setup graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await client.destroy();
        if (mongoClient) {
          await mongoClient.disconnect();
        }
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

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

    logger.info('Bot started successfully with discordx');

  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the bot
void start();