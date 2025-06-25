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

    this.client.on('guildCreate', (guild) => {
      logger.info(`Bot added to guild: ${guild.name} (${guild.id})`);
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
      logger.info('Initializing application commands...');
      
      // Smart command registration - check for existing commands first
      let existingCommands;
      try {
        existingCommands = await this.client.application?.commands.fetch();
        logger.info(`Found ${existingCommands?.size || 0} existing commands on Discord`);
      } catch (fetchError) {
        logger.warn('Could not fetch existing commands, proceeding with normal initialization:', fetchError);
        existingCommands = null;
      }

      // Get the commands that discordx wants to register
      const localCommands = this.client.applicationCommands;
      logger.info(`Found ${localCommands.length} local commands to register`);
      
      if (existingCommands && existingCommands.size > 0) {
        // Check if commands are already registered and up to date
        const needsUpdate = localCommands.some(localCmd => {
          const existingCmd = existingCommands.find(cmd => cmd.name === localCmd.name);
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
        const orphanedCommands = existingCommands.filter(discordCmd => 
          !localCommands.some(localCmd => localCmd.name === discordCmd.name)
        );
        
        if (orphanedCommands.size > 0) {
          logger.info(`Found ${orphanedCommands.size} orphaned commands that will be removed`);
        }
        
        if (!needsUpdate && orphanedCommands.size === 0) {
          logger.info('All commands are already up to date, skipping registration');
        } else {
          logger.info('Command differences detected, updating commands...');
          await this.client.initApplicationCommands();
          logger.info('Slash commands updated successfully');
        }
      } else {
        // No existing commands or couldn't fetch them, proceed with normal registration
        logger.info('No existing commands found, registering all commands...');
        await this.client.initApplicationCommands();
        logger.info('Slash commands initialized successfully');
      }
      
    } catch (error) {
      logger.error('Error initializing commands:', error);
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
      logger.info('Clearing all application commands...');
      
      // Clear global commands
      await this.client.clearApplicationCommands();
      
      logger.info('All commands cleared successfully');
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
      logger.info('Force clearing all commands...');
      await this.client.clearApplicationCommands();
      logger.info('All commands cleared. Next startup will re-register all commands.');
    } catch (error) {
      logger.error('Error force clearing commands:', error);
      throw error;
    }
  }

  public getClient(): Client {
    return this.client;
  }
}