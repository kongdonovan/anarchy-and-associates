#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const discordx_1 = require("discordx");
const dotenv_1 = require("dotenv");
const logger_1 = require("../infrastructure/logger");
// Load environment variables
(0, dotenv_1.config)();
/**
 * Utility script to manually clear all Discord slash commands
 * Use this if you need to completely reset the command registration state
 */
async function clearAllCommands() {
    try {
        logger_1.logger.info('Starting command clearing utility...');
        const client = new discordx_1.Client({
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
                logger_1.logger.info('Bot connected, clearing all commands...');
                // Clear global commands
                logger_1.logger.info('Fetching global commands...');
                const globalCommands = await client.application?.commands.fetch();
                logger_1.logger.info(`Found ${globalCommands?.size || 0} global commands to clear`);
                if (globalCommands && globalCommands.size > 0) {
                    globalCommands.forEach(cmd => {
                        logger_1.logger.info(`- Global command: ${cmd.name}`);
                    });
                    logger_1.logger.info('Clearing global commands...');
                    await client.application?.commands.set([]);
                    logger_1.logger.info('✅ Global commands cleared');
                }
                // Clear guild commands for all guilds
                logger_1.logger.info(`Clearing guild commands for ${client.guilds.cache.size} guilds...`);
                for (const [guildId, guild] of client.guilds.cache) {
                    try {
                        logger_1.logger.info(`Clearing commands for guild: ${guild.name} (${guildId})`);
                        const guildCommands = await guild.commands.fetch();
                        logger_1.logger.info(`Found ${guildCommands.size} guild commands in ${guild.name}`);
                        if (guildCommands.size > 0) {
                            guildCommands.forEach(cmd => {
                                logger_1.logger.info(`- Guild command in ${guild.name}: ${cmd.name}`);
                            });
                            await guild.commands.set([]);
                            logger_1.logger.info(`✅ Guild commands cleared for ${guild.name}`);
                        }
                    }
                    catch (guildError) {
                        logger_1.logger.error(`Error clearing commands for guild ${guild.name}:`, guildError);
                    }
                }
                // Final verification
                logger_1.logger.info('Verifying all commands are cleared...');
                const finalGlobalCommands = await client.application?.commands.fetch();
                logger_1.logger.info(`Final global commands: ${finalGlobalCommands?.size || 0}`);
                let totalGuildCommands = 0;
                for (const [, guild] of client.guilds.cache) {
                    try {
                        const guildCommands = await guild.commands.fetch();
                        totalGuildCommands += guildCommands.size;
                    }
                    catch (error) {
                        logger_1.logger.warn(`Could not verify guild commands for ${guild.name}`);
                    }
                }
                logger_1.logger.info(`Final guild commands across all guilds: ${totalGuildCommands}`);
                logger_1.logger.info('✅ Command clearing completed');
                await client.destroy();
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error('Error during command clearing:', error);
                await client.destroy();
                process.exit(1);
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to clear commands:', error);
        process.exit(1);
    }
}
// Run the script
void clearAllCommands();
//# sourceMappingURL=clear-commands.js.map