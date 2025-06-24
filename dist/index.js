"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv_1 = require("dotenv");
const bot_1 = require("./infrastructure/bot/bot");
const logger_1 = require("./infrastructure/logger");
// Load environment variables
(0, dotenv_1.config)();
let bot = null;
async function gracefulShutdown(signal) {
    logger_1.logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
        if (bot) {
            await bot.stop();
        }
        logger_1.logger.info('Graceful shutdown completed');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}
async function main() {
    try {
        logger_1.logger.info('Anarchy & Associates Discord Bot starting...');
        bot = new bot_1.Bot();
        await bot.start();
        logger_1.logger.info('Bot started successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to start bot:', error);
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
main().catch(error => {
    logger_1.logger.error('Unhandled error in main:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map