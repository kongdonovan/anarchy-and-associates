import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anarchy_associates_test';
process.env.MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'anarchy_associates_test';

// Mock Discord client globally
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn().mockResolvedValue('mocked'),
    destroy: jest.fn().mockResolvedValue(undefined),
    user: { id: 'mock-bot-id' },
    guilds: {
      fetch: jest.fn(),
      cache: new Map()
    }
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMembers: 2,
    GuildMessages: 4,
    MessageContent: 8
  },
  Events: {
    Ready: 'ready',
    GuildMemberUpdate: 'guildMemberUpdate'
  },
  ButtonBuilder: jest.fn(),
  ButtonStyle: {},
  ActionRowBuilder: jest.fn(),
  ModalBuilder: jest.fn(),
  TextInputBuilder: jest.fn(),
  TextInputStyle: {},
  EmbedBuilder: jest.fn(),
  ChannelType: {},
  PermissionFlagsBits: {}
}));

// Mock discordx globally
jest.mock('discordx', () => ({
  Discord: () => (_target: any) => _target,
  Slash: () => (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
  SlashOption: () => (_target: any, _propertyKey: string, _parameterIndex: number) => {},
  SlashGroup: () => (_target: any) => _target,
  ButtonComponent: () => (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
  ModalComponent: () => (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
  Guard: () => (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor
}));

// Global test timeout
jest.setTimeout(30000);

// This is just a setup file, no tests needed
describe('Test Setup', () => {
  it('should load environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});