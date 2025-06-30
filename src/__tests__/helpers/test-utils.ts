import { ObjectId } from 'mongodb';
import { 
  Staff,
  Case,
  Job,
  Application,
  Retainer,
  Reminder,
  Feedback,
  StaffRole,
  CaseStatus,
  CasePriority
} from '../../validation';
import { MongoDbClient } from '../../infrastructure/database/mongo-client';

export class TestUtils {
  static generateObjectId(): ObjectId {
    return new ObjectId();
  }

  static generateMockStaff(overrides: Partial<Staff> = {}): Staff {
    const now = new Date();
    return {
      _id: this.generateObjectId().toString(),
      guildId: '123456789012345678', // Valid Discord snowflake
      userId: '234567890123456789', // Valid Discord snowflake
      robloxUsername: `roblox${Date.now()}`,
      role: 'Paralegal' as StaffRole, // Use string literal that matches Zod enum
      status: 'active',
      hiredAt: now,
      hiredBy: '123456789012345679', // Valid Discord snowflake
      promotionHistory: [],
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  static generateMockCase(overrides: Partial<Case> = {}): Case {
    const now = new Date();
    const caseNumber = `AA-${now.getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}-testclient`;
    
    return {
      _id: this.generateObjectId().toString(),
      guildId: '123456789012345678', // Valid Discord snowflake
      caseNumber,
      clientId: `${Date.now()}123456789`, // Valid Discord snowflake
      clientUsername: `testclient${Date.now()}`,
      title: 'Test Case Title',
      description: 'Test case description that is at least twenty characters long',
      status: 'pending' as CaseStatus, // Use string literal that matches Zod enum
      priority: 'medium' as CasePriority, // Use string literal that matches Zod enum
      assignedLawyerIds: [],
      documents: [],
      notes: [],
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  static generateMockJob(overrides: Partial<Job> = {}): Job {
    const now = new Date();
    
    return {
      _id: this.generateObjectId().toString(),
      guildId: '123456789012345678', // Valid Discord snowflake
      title: 'Test Job Position',
      description: 'Test job description',
      staffRole: 'Paralegal', // Use string literal that matches Zod enum
      roleId: '123456789012345680', // Valid Discord snowflake
      isOpen: true,
      questions: [],
      postedBy: `${Date.now()}123456789`, // Valid Discord snowflake
      applicationCount: 0,
      hiredCount: 0,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  static generateMockApplication(overrides: Partial<Application> = {}): Application {
    const now = new Date();
    
    return {
      _id: this.generateObjectId().toString(),
      guildId: '123456789012345678', // Valid Discord snowflake
      jobId: this.generateObjectId().toString(),
      applicantId: `${Date.now()}123456789`, // Valid Discord snowflake
      robloxUsername: `roblox${Date.now()}`,
      answers: [],
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  static generateMockRetainer(overrides: Partial<Retainer> = {}): Retainer {
    const now = new Date();
    
    return {
      _id: this.generateObjectId().toString(),
      guildId: '123456789012345678', // Valid Discord snowflake
      clientId: `${Date.now()}123456789`, // Valid Discord snowflake
      lawyerId: `${Date.now()}123456790`, // Valid Discord snowflake
      status: 'pending', // Use string literal that matches Zod enum
      agreementTemplate: 'RETAINER AGREEMENT\n\nThis is a test agreement for [CLIENT_NAME].\n\nSignature: [SIGNATURE]\nDate: [DATE]\nLawyer: [LAWYER_NAME]',
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  static generateMockReminder(overrides: Partial<Reminder> = {}): Reminder {
    const now = new Date();
    const futureTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    
    return {
      _id: this.generateObjectId().toString(),
      guildId: '123456789012345678', // Valid Discord snowflake
      userId: '234567890123456789', // Valid Discord snowflake
      username: `testuser${Date.now()}`,
      channelId: '345678901234567890', // Valid Discord snowflake - required field
      type: 'custom' as const, // Required field with default
      message: 'Test reminder message',
      scheduledFor: futureTime,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  static generateMockFeedback(overrides: Partial<Feedback> = {}): Feedback {
    const now = new Date();
    
    return {
      _id: this.generateObjectId().toString(),
      guildId: '123456789012345678', // Valid Discord snowflake
      submitterId: `${Date.now()}123456789`, // Valid Discord snowflake
      submitterUsername: `testclient${Date.now()}`,
      targetStaffId: `${Date.now()}123456790`, // Valid Discord snowflake
      targetStaffUsername: `teststaff${Date.now()}`,
      rating: 4, // Use numeric value instead of enum
      comment: 'Great service and very professional!',
      isForFirm: false,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  static async clearTestDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('clearTestDatabase can only be called in test environment');
    }

    // Use the global shared connection
    const mongoClient = (global as any).__mongoClient as MongoDbClient;
    if (!mongoClient) {
      throw new Error('Global MongoDB client not initialized. Check globalSetup.');
    }
    
    const db = mongoClient.getDatabase();
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      await db.collection(collection.name).deleteMany({});
    }
  }

  static async ensureTestDatabaseConnection(): Promise<void> {
    // Connection is managed globally, just verify it exists
    const mongoClient = (global as any).__mongoClient as MongoDbClient;
    if (!mongoClient || !mongoClient.isConnected()) {
      throw new Error('Global MongoDB connection not available. Check globalSetup.');
    }
  }

  static mockDiscordInteraction(overrides: any = {}) {
    return {
      guildId: '123456789012345678', // Valid Discord snowflake
      user: {
        id: '123456789012345679', // Valid Discord snowflake
        displayName: 'Test User'
      },
      member: {
        roles: {
          cache: new Map([
            ['123456789012345680', { id: '123456789012345680', name: 'Test Role' }] // Valid Discord snowflake
          ])
        }
      },
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      channelId: '123456789012345681', // Valid Discord snowflake
      guild: {
        ownerId: '123456789012345682', // Valid Discord snowflake
        channels: {
          fetch: jest.fn()
        },
        members: {
          cache: new Map()
        }
      },
      client: {
        user: { id: '123456789012345683' }, // Valid Discord snowflake
        guilds: {
          fetch: jest.fn()
        }
      },
      customId: 'test-custom-id',
      fields: {
        getTextInputValue: jest.fn().mockReturnValue('test-value')
      },
      ...overrides
    };
  }

  static createMockPermissionContext(overrides: any = {}) {
    return {
      guildId: '123456789012345678', // Valid Discord snowflake
      userId: '123456789012345679', // Valid Discord snowflake
      userRoles: ['123456789012345680'], // Valid Discord snowflake
      isGuildOwner: false,
      ...overrides
    };
  }

  static wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async runConcurrentOperations<T>(
    operations: (() => Promise<T>)[],
    concurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const chunks = [];
    
    for (let i = 0; i < operations.length; i += concurrency) {
      chunks.push(operations.slice(i, i + concurrency));
    }
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map(op => op()));
      results.push(...chunkResults);
    }
    
    return results;
  }

  static generateLargeDataset<T>(
    generator: (index: number) => T,
    count: number
  ): T[] {
    return Array.from({ length: count }, (_, index) => generator(index));
  }

  // Helper functions to ensure valid Discord snowflake IDs
  static generateSnowflake(): string {
    // Generate a valid Discord snowflake (17-21 digits)
    const timestamp = Date.now() - 1420070400000; // Discord epoch
    const workerId = Math.floor(Math.random() * 31);
    const processId = Math.floor(Math.random() * 31);
    const increment = Math.floor(Math.random() * 4095);
    
    const snowflake = (BigInt(timestamp) << 22n) | (BigInt(workerId) << 17n) | (BigInt(processId) << 12n) | BigInt(increment);
    return snowflake.toString();
  }

  static ensureValidSnowflake(id: string | undefined): string {
    if (!id || id.length < 17 || id.length > 21 || !/^\d+$/.test(id)) {
      return this.generateSnowflake();
    }
    return id;
  }

  // Convert ObjectId to string for Zod compatibility
  static toZodId(id: ObjectId | string | undefined): string | undefined {
    if (!id) return undefined;
    return typeof id === 'string' ? id : id.toString();
  }
}