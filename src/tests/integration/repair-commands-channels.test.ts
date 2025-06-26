import { 
  Collection,
  ChannelType
} from 'discord.js';
import { RepairCommands } from '../../presentation/commands/repair-commands';
import { MongoDbClient } from '../../infrastructure/database/mongo-client';

describe('RepairCommands - Channel Cleanup Integration', () => {
  let repairCommands: RepairCommands;
  let mockInteraction: any;
  let mockGuild: any;
  let database: MongoDbClient;

  beforeAll(async () => {
    database = MongoDbClient.getInstance();
    await database.connect();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  beforeEach(async () => {
    // Clear database
    const db = database.getDatabase();
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      await db.collection(collection.name).deleteMany({});
    }

    // Create repair commands instance
    repairCommands = new RepairCommands();

    // Mock guild
    mockGuild = {
      id: 'test-guild-id',
      name: 'Test Guild',
      ownerId: 'owner-user-id',
      channels: {
        cache: new Collection(),
      },
      members: {
        cache: new Collection(),
      },
      roles: {
        everyone: { id: 'everyone-role-id' },
        cache: new Collection(),
      },
    };

    // Mock interaction
    mockInteraction = createMockInteraction(mockGuild);

    // Add admin role to interaction member
    const adminRole = { id: 'admin-role-id', name: 'Admin' };
    mockGuild.roles.cache.set(adminRole.id, adminRole);
    mockInteraction.member.roles.cache.set(adminRole.id, adminRole);

    // Setup guild config with admin permissions
    const guildConfigRepo = (repairCommands as any).guildConfigRepository;
    await guildConfigRepo.add({
      guildId: 'test-guild-id',
      permissions: {
        admin: ['admin-role-id'],
        'senior-staff': [],
        case: [],
        config: [],
        lawyer: [],
        'lead-attorney': [],
        repair: [],
      },
      adminRoles: ['admin-role-id'],
      adminUsers: [],
    });
  });

  describe('/repair orphaned-channels', () => {
    it('should scan and report orphaned channels', async () => {
      // Create mock channels
      const orphanedCaseChannel = createMockTextChannel('case-aa-2024-001-abandoned', 'orphaned-1');
      const tempChannel = createMockTextChannel('temp-meeting-123', 'temp-1');
      const normalChannel = createMockTextChannel('general', 'general-1');

      mockGuild.channels.cache.set(orphanedCaseChannel.id, orphanedCaseChannel);
      mockGuild.channels.cache.set(tempChannel.id, tempChannel);
      mockGuild.channels.cache.set(normalChannel.id, normalChannel);

      // Mock messages for channels
      [orphanedCaseChannel, tempChannel, normalChannel].forEach(channel => {
        channel.messages = {
          fetch: jest.fn().mockResolvedValue(new Collection()),
        };
      });

      await repairCommands.scanOrphanedChannels(mockInteraction);

      // Verify initial reply
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Scanning Channels'),
              }),
            }),
          ]),
          ephemeral: true,
        })
      );

      // Verify follow-up with results
      expect(mockInteraction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Orphaned Channel Scan Results'),
                description: expect.stringContaining('2'), // Found 2 orphaned channels
              }),
            }),
          ]),
        })
      );
    });

    it('should handle no orphaned channels found', async () => {
      // Only add a general channel
      const normalChannel = createMockTextChannel('general', 'general-1');
      mockGuild.channels.cache.set(normalChannel.id, normalChannel);

      await repairCommands.scanOrphanedChannels(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                description: expect.stringContaining('Found 0'),
              }),
            }),
          ]),
        })
      );
    });

    it('should require admin permissions', async () => {
      // Remove admin role from member
      mockInteraction.member.roles.cache.clear();

      await repairCommands.scanOrphanedChannels(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Permission Denied'),
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });
  });

  describe('/repair cleanup-channels', () => {
    it('should perform cleanup in dry-run mode', async () => {
      // Create orphaned channels
      const orphanedChannel = createMockTextChannel('case-aa-2024-001-old', 'orphaned-1');
      const tempChannel = createMockTextChannel('temp-old-meeting', 'temp-1');

      mockGuild.channels.cache.set(orphanedChannel.id, orphanedChannel);
      mockGuild.channels.cache.set(tempChannel.id, tempChannel);

      // Mock messages
      [orphanedChannel, tempChannel].forEach(channel => {
        channel.messages = {
          fetch: jest.fn().mockResolvedValue(new Collection()),
        };
      });

      // Add options to interaction
      mockInteraction.options = {
        getBoolean: jest.fn((name) => name === 'dry-run' ? true : false),
      };

      await repairCommands.cleanupOrphanedChannels(true, false, mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Starting Cleanup'),
                description: expect.stringContaining('dry-run mode'),
              }),
            }),
          ]),
        })
      );

      // Verify dry-run results
      expect(mockInteraction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Cleanup Preview (Dry Run)'),
              }),
            }),
          ]),
        })
      );

      // Verify channels were not actually deleted
      expect(orphanedChannel.delete).not.toHaveBeenCalled();
      expect(tempChannel.delete).not.toHaveBeenCalled();
    });

    it('should perform actual cleanup when not in dry-run mode', async () => {
      // Create a very old temp channel that should be deleted
      const oldTempChannel = createMockTextChannel('temp-very-old', 'temp-1');
      oldTempChannel.createdAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days old
      oldTempChannel.delete = jest.fn().mockResolvedValue(true);

      mockGuild.channels.cache.set(oldTempChannel.id, oldTempChannel);

      // Mock empty messages (inactive channel)
      oldTempChannel.messages = {
        fetch: jest.fn().mockResolvedValue(new Collection()),
      };

      // Add options to interaction
      mockInteraction.options = {
        getBoolean: jest.fn(() => false), // Not dry-run, not archive-only
      };

      await repairCommands.cleanupOrphanedChannels(false, false, mockInteraction);

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockInteraction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Cleanup Complete'),
              }),
            }),
          ]),
        })
      );
    });

    it('should handle archive-only mode', async () => {
      // Create channels
      const caseChannel = createMockTextChannel('case-aa-2024-001-old', 'case-1');
      const tempChannel = createMockTextChannel('temp-old', 'temp-1');

      caseChannel.createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days old
      tempChannel.createdAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days old

      mockGuild.channels.cache.set(caseChannel.id, caseChannel);
      mockGuild.channels.cache.set(tempChannel.id, tempChannel);

      // Mock messages
      [caseChannel, tempChannel].forEach(channel => {
        channel.messages = {
          fetch: jest.fn().mockResolvedValue(new Collection()),
        };
        channel.delete = jest.fn();
        channel.edit = jest.fn().mockResolvedValue(true);
      });

      // Create archive category
      const archiveCategory = {
        id: 'archive-category-id',
        name: '🗃️ Case Archives',
        type: ChannelType.GuildCategory,
      };
      mockGuild.channels.cache.set(archiveCategory.id, archiveCategory);

      // Add options to interaction
      mockInteraction.options = {
        getBoolean: jest.fn((name) => {
          if (name === 'dry-run') return false;
          if (name === 'archive-only') return true;
          return false;
        }),
      };

      await repairCommands.cleanupOrphanedChannels(false, true, mockInteraction);

      // Verify no channels were deleted
      expect(caseChannel.delete).not.toHaveBeenCalled();
      expect(tempChannel.delete).not.toHaveBeenCalled();
    });

    it('should handle no orphaned channels gracefully', async () => {
      // Only add normal channels
      const generalChannel = createMockTextChannel('general', 'general-1');
      mockGuild.channels.cache.set(generalChannel.id, generalChannel);

      mockInteraction.options = {
        getBoolean: jest.fn(() => false),
      };

      await repairCommands.cleanupOrphanedChannels(false, false, mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('No Orphaned Channels'),
              }),
            }),
          ]),
        })
      );
    });
  });

  describe('/repair auto-cleanup', () => {
    it('should enable automatic cleanup', async () => {
      mockInteraction.options = {
        getBoolean: jest.fn((name) => name === 'enabled' ? true : false),
      };

      await repairCommands.configureAutoCleanup(true, mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Auto Cleanup Configuration'),
                description: expect.stringContaining('enabled'),
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });

    it('should disable automatic cleanup', async () => {
      mockInteraction.options = {
        getBoolean: jest.fn((name) => name === 'enabled' ? false : true),
      };

      await repairCommands.configureAutoCleanup(false, mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Auto Cleanup Configuration'),
                description: expect.stringContaining('disabled'),
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });

    it('should require admin permissions', async () => {
      // Remove admin role
      mockInteraction.member.roles.cache.clear();

      await repairCommands.configureAutoCleanup(true, mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Permission Denied'),
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });
  });
});

// Helper functions
function createMockInteraction(guild: any): any {
  const member = {
    id: 'test-user-id',
    user: {
      id: 'test-user-id',
      username: 'TestUser',
      bot: false,
    },
    roles: {
      cache: new Collection(),
    },
  };

  return {
    guildId: guild.id,
    guild,
    user: member.user,
    member,
    reply: jest.fn().mockResolvedValue(true),
    followUp: jest.fn().mockResolvedValue(true),
    deferReply: jest.fn().mockResolvedValue(true),
    editReply: jest.fn().mockResolvedValue(true),
    options: {
      getBoolean: jest.fn(),
    },
  };
}

function createMockTextChannel(name: string, id: string): any {
  return {
    id,
    name,
    type: ChannelType.GuildText,
    guild: { id: 'test-guild-id' },
    parentId: null,
    parent: null,
    createdAt: new Date(),
    createdTimestamp: Date.now(),
    delete: jest.fn(),
    edit: jest.fn(),
    send: jest.fn(),
    messages: {
      fetch: jest.fn(),
    },
  };
}