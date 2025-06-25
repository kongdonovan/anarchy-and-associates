import { ObjectId } from 'mongodb';
import { Staff } from '../../domain/entities/staff';
import { StaffRole } from '../../domain/entities/staff-role';
import { Case, CaseStatus, CasePriority } from '../../domain/entities/case';
import { Job } from '../../domain/entities/job';
import { Application } from '../../domain/entities/application';
import { Retainer, RetainerStatus } from '../../domain/entities/retainer';
import { Reminder } from '../../domain/entities/reminder';
import { MongoDbClient } from '../../infrastructure/database/mongo-client';
import { Feedback, FeedbackRating } from '../../domain/entities/feedback';

export class TestUtils {
  static generateObjectId(): ObjectId {
    return new ObjectId();
  }

  static generateMockStaff(overrides: Partial<Staff> = {}): Staff {
    const now = new Date();
    return {
      _id: this.generateObjectId(),
      guildId: 'test-guild-123',
      userId: `user-${Date.now()}`,
      robloxUsername: `roblox${Date.now()}`,
      role: StaffRole.PARALEGAL,
      status: 'active',
      hiredAt: now,
      hiredBy: 'test-admin',
      promotionHistory: [],
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  static generateMockCase(overrides: Partial<Case> = {}): Case {
    const now = new Date();
    const caseNumber = `${now.getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}-testclient`;
    
    return {
      _id: this.generateObjectId(),
      guildId: 'test-guild-123',
      caseNumber,
      clientId: `client-${Date.now()}`,
      clientUsername: `testclient${Date.now()}`,
      title: 'Test Case Title',
      description: 'Test case description',
      status: CaseStatus.PENDING,
      priority: CasePriority.MEDIUM,
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
      _id: this.generateObjectId(),
      guildId: 'test-guild-123',
      title: 'Test Job Position',
      description: 'Test job description',
      staffRole: StaffRole.PARALEGAL,
      roleId: 'test-role-id',
      isOpen: true,
      questions: [],
      postedBy: `user-${Date.now()}`,
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
      _id: this.generateObjectId(),
      guildId: 'test-guild-123',
      jobId: this.generateObjectId().toString(),
      applicantId: `applicant-${Date.now()}`,
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
      _id: this.generateObjectId(),
      guildId: 'test-guild-123',
      clientId: `client-${Date.now()}`,
      lawyerId: `lawyer-${Date.now()}`,
      status: RetainerStatus.PENDING,
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
      _id: this.generateObjectId(),
      guildId: 'test-guild-123',
      userId: `user-${Date.now()}`,
      username: `testuser${Date.now()}`,
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
      _id: this.generateObjectId(),
      guildId: 'test-guild-123',
      submitterId: `client-${Date.now()}`,
      submitterUsername: `testclient${Date.now()}`,
      targetStaffId: `staff-${Date.now()}`,
      targetStaffUsername: `teststaff${Date.now()}`,
      rating: FeedbackRating.FOUR_STAR,
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
      guildId: 'test-guild-123',
      user: {
        id: 'test-user-123',
        displayName: 'Test User'
      },
      member: {
        roles: {
          cache: new Map([
            ['role-id-1', { id: 'role-id-1', name: 'Test Role' }]
          ])
        }
      },
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      channelId: 'test-channel-123',
      guild: {
        ownerId: 'guild-owner-123',
        channels: {
          fetch: jest.fn()
        },
        members: {
          cache: new Map()
        }
      },
      client: {
        user: { id: 'mock-bot-id' },
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
      guildId: 'test-guild-123',
      userId: 'test-user-123',
      userRoles: ['role-id-1'],
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
}