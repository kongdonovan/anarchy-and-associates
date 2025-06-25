import { GatewayIntentBits, ActivityType } from 'discord.js';
import { Client } from 'discordx';
import { MongoDbClient } from '../database/mongo-client';
import { ReminderService } from '../../application/services/reminder-service';
import { RoleTrackingService } from '../../application/services/role-tracking-service';
import { ReminderRepository } from '../repositories/reminder-repository';
import { CaseRepository } from '../repositories/case-repository';
import { StaffRepository } from '../repositories/staff-repository';
import { logger } from '../logger';
import { importx } from '@discordx/importer';

export class Bot {
  private client: Client;
  private mongoClient: MongoDbClient;
  private reminderService: ReminderService | null = null;
  private roleTrackingService: RoleTrackingService | null = null;

  constructor() {
    this.mongoClient = MongoDbClient.getInstance();
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      if (!this.client.user) return;
      
      logger.info(`Bot logged in as ${this.client.user.tag}`);
      
      // Set bot activity
      this.client.user.setActivity('Managing Legal Operations', {
        type: ActivityType.Watching,
      });

      // Initialize reminder service with Discord client (only if it exists)
      if (this.reminderService) {
        this.reminderService.setDiscordClient(this.client);
      }

      // Initialize role tracking service
      if (this.roleTrackingService) {
        this.roleTrackingService.initializeTracking(this.client);
        logger.info('Role tracking service initialized');
      }

      // Initialize slash commands - this is the proper place according to discordx docs
      await this.initializeCommands();
    });

    this.client.on('guildCreate', async (guild) => {
      logger.info(`Bot added to guild: ${guild.name} (${guild.id})`);
      
      // Register commands for the new guild
      try {
        logger.info(`Registering commands for new guild: ${guild.name} (${guild.id})`);
        
        // Update botGuilds to include all current guilds
        const allGuildIds = Array.from(this.client.guilds.cache.keys());
        (this.client as any).botGuilds = allGuildIds;
        
        // Re-register commands for all guilds (including the new one)
        await this.client.initApplicationCommands();
        
        logger.info(`Successfully registered commands for new guild: ${guild.name} (${guild.id})`);
      } catch (error) {
        logger.error(`Failed to register commands for new guild: ${guild.name} (${guild.id})`, error);
      }
    });

    this.client.on('guildDelete', (guild) => {
      logger.info(`Bot removed from guild: ${guild.name} (${guild.id})`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        this.client.executeInteraction(interaction);
      } catch (error) {
        logger.error('Error executing interaction:', error);
      }
    });
  }

  private async initializeCommands(): Promise<void> {
    try {
      logger.info('Initializing guild-specific application commands...');
      
      // Get all guilds the bot is in
      const guilds = this.client.guilds.cache;
      logger.info(`Bot is in ${guilds.size} guild(s), registering commands for each guild`);
      
      if (guilds.size === 0) {
        logger.warn('Bot is not in any guilds, skipping command registration');
        return;
      }

      // Get the commands that discordx wants to register
      const localCommands = this.client.applicationCommands;
      logger.info(`Found ${localCommands.length} local commands to register per guild`);
      
      // Set botGuilds property and register commands for all guilds at once
      const guildIds = Array.from(guilds.keys());
      
      // Configure client for guild-specific commands
      (this.client as any).botGuilds = guildIds;
      
      logger.info(`Registering commands for guilds: ${guildIds.map(id => {
        const guild = guilds.get(id);
        return `${guild?.name} (${id})`;
      }).join(', ')}`);
      
      // Register commands for all configured guilds
      await this.client.initApplicationCommands();
      
      logger.info('✅ Guild commands initialized successfully for all guilds');
      
      // Debug: Verify registration for each guild
      for (const guildId of guildIds) {
        try {
          const guild = guilds.get(guildId);
          if (guild) {
            const guildCommands = await guild.commands.fetch();
            logger.info(`✅ Guild ${guild.name}: ${guildCommands.size} commands registered`);
          }
        } catch (verifyError) {
          const guild = guilds.get(guildId);
          logger.warn(`Could not verify commands for guild: ${guild?.name} (${guildId})`, verifyError);
        }
      }
      
    } catch (error) {
      logger.error('Error initializing guild commands:', error);
      // Don't throw - continue with bot startup even if commands fail
    }
  }

  public async start(): Promise<void> {
    try {
      // Connect to MongoDB first
      await this.mongoClient.connect();
      logger.info('MongoDB connected successfully');

      // Initialize services that depend on database connection
      this.initializeServices();

      // Import command modules before login
      logger.info('Importing command modules...');
      await importx(`${__dirname}/../../../dist/presentation/commands/**/*.js`);
      
      logger.info('Command modules imported successfully');

      // Login to Discord
      const token = process.env.DISCORD_BOT_TOKEN;
      if (!token) {
        throw new Error('DISCORD_BOT_TOKEN environment variable is required');
      }

      await this.client.login(token);
    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }
  
  // Clear all commands (useful for development)
  public async clearAllCommands(): Promise<void> {
    try {
      logger.info('Clearing all guild application commands...');
      
      // Get all guilds the bot is in
      const guilds = this.client.guilds.cache;
      logger.info(`Clearing commands for ${guilds.size} guild(s)`);
      
      let successfulClears = 0;
      let failedClears = 0;

      // Set botGuilds and clear commands for all guilds
      const guildIds = Array.from(guilds.keys());
      (this.client as any).botGuilds = guildIds;
      
      try {
        logger.info('Clearing commands for all guilds...');
        await this.client.clearApplicationCommands();
        logger.info('✅ Successfully cleared commands for all guilds');
        successfulClears = guilds.size;
      } catch (guildError) {
        logger.error('Failed to clear guild commands:', guildError);
        failedClears = guilds.size;
      }
      
      // Also clear any potential global commands (cleanup)
      try {
        logger.info('Clearing any remaining global commands...');
        // Temporarily clear botGuilds to target global commands
        const savedBotGuilds = (this.client as any).botGuilds;
        (this.client as any).botGuilds = undefined;
        await this.client.clearApplicationCommands();
        // Restore botGuilds
        (this.client as any).botGuilds = savedBotGuilds;
        logger.info('Global commands cleared');
      } catch (globalError) {
        logger.warn('Failed to clear global commands (this is expected if none exist):', globalError);
      }
      
      logger.info(`Command clearing completed: ${successfulClears} successful, ${failedClears} failed`);
    } catch (error) {
      logger.error('Error clearing commands:', error);
      throw error;
    }
  }

  private initializeServices(): void {
    // Initialize repositories and services after database connection
    const reminderRepository = new ReminderRepository();
    const caseRepository = new CaseRepository();
    const staffRepository = new StaffRepository();
    this.reminderService = new ReminderService(reminderRepository, caseRepository, staffRepository);
    this.roleTrackingService = new RoleTrackingService();
    
    logger.info('Services initialized successfully');
  }

  public async stop(): Promise<void> {
    try {
      // Simple shutdown without aggressive command clearing
      await this.client.destroy();
      await this.mongoClient.disconnect();
      logger.info('Bot stopped successfully');
    } catch (error) {
      logger.error('Error stopping bot:', error);
      throw error;
    }
  }

  // Force clear all commands (useful for development reset)
  public async forceResetCommands(): Promise<void> {
    try {
      logger.info('Force clearing all guild commands...');
      
      // Use the existing clearAllCommands method
      await this.clearAllCommands();
      
      logger.info('All guild commands cleared. Next startup will re-register all commands for each guild.');
    } catch (error) {
      logger.error('Error force clearing commands:', error);
      throw error;
    }
  }

  public getClient(): Client {
    return this.client;
  }
}