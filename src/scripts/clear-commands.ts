#!/usr/bin/env ts-node
import 'reflect-metadata';
import { Client } from 'discordx';
import { config as envConfig } from 'dotenv';
import { logger } from '../infrastructure/logger';

// Load environment variables
envConfig();

/**
 * Utility script to manually clear all Discord slash commands
 * Use this if you need to completely reset the command registration state
 */
async function clearAllCommands(): Promise<void> {
  try {
    logger.info('Starting command clearing utility...');

    const client = new Client({
      intents: [], // We don't need any intents for this operation
    });

    // Login to Discord
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN environment variable is required');
    }

    await client.login(token);

    client.once('ready', async () => {
      try {
        logger.info('Bot connected, clearing all commands...');

        // Clear guild commands for all guilds (primary focus)
        logger.info(
          `Bot is now using guild-only commands. Clearing commands for ${client.guilds.cache.size} guilds...`
        );

        for (const [guildId, guild] of client.guilds.cache) {
          try {
            logger.info(
              `Clearing commands for guild: ${guild.name} (${guildId})`
            );
            const guildCommands = await guild.commands.fetch();
            logger.info(
              `Found ${guildCommands.size} guild commands in ${guild.name}`
            );

            if (guildCommands.size > 0) {
              guildCommands.forEach(cmd => {
                logger.info(`- Guild command in ${guild.name}: ${cmd.name}`);
              });

              await guild.commands.set([]);
              logger.info(`✅ Guild commands cleared for ${guild.name}`);
            }
          } catch (guildError) {
            logger.error(
              `Error clearing commands for guild ${guild.name}:`,
              guildError
            );
          }
        }

        // Clear any remaining global commands (cleanup from previous global setup)
        logger.info('Clearing any remaining global commands as cleanup...');
        try {
          const globalCommands = await client.application?.commands.fetch();
          logger.info(
            `Found ${globalCommands?.size || 0} global commands to clear`
          );

          if (globalCommands && globalCommands.size > 0) {
            globalCommands.forEach(cmd => {
              logger.info(`- Legacy global command: ${cmd.name}`);
            });

            logger.info('Clearing legacy global commands...');
            await client.application?.commands.set([]);
            logger.info('✅ Legacy global commands cleared');
          } else {
            logger.info(
              'No global commands found (expected for guild-only setup)'
            );
          }
        } catch (globalError) {
          logger.warn(
            'Could not clear global commands (this may be expected):',
            globalError
          );
        }

        // Final verification
        logger.info('Verifying all commands are cleared...');
        const finalGlobalCommands = await client.application?.commands.fetch();
        logger.info(`Final global commands: ${finalGlobalCommands?.size || 0}`);

        let totalGuildCommands = 0;
        for (const [, guild] of client.guilds.cache) {
          try {
            const guildCommands = await guild.commands.fetch();
            totalGuildCommands += guildCommands.size;
          } catch (err) {
            logger.warn(`Could not verify guild commands for ${guild.name}: ${err}`);
          }
        }
        logger.info(
          `Final guild commands across all guilds: ${totalGuildCommands}`
        );

        logger.info('✅ Command clearing completed');
        await client.destroy();
        process.exit(0);
      } catch (error) {
        logger.error('Error during command clearing:', error);
        await client.destroy();
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Failed to clear commands:', error);
    process.exit(1);
  }
}

// Run the script
void clearAllCommands();
