import 'reflect-metadata';
import { config } from 'dotenv';
import { Bot } from './infrastructure/bot/bot';
import { logger } from './infrastructure/logger';

// Load environment variables
config();

let bot: Bot | null = null;

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    if (bot) {
      await bot.stop();
    }
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  try {
    logger.info('Anarchy & Associates Discord Bot starting...');
    
    bot = new Bot();
    await bot.start();
    
    logger.info('Bot started successfully');
  } catch (error) {
    logger.error('Failed to start bot:', error);
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

main().catch(error => {
  logger.error('Unhandled error in main:', error);
  process.exit(1);
});