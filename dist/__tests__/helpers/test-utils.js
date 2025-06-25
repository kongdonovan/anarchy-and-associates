"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestUtils = void 0;
const mongodb_1 = require("mongodb");
const staff_role_1 = require("../../domain/entities/staff-role");
const case_1 = require("../../domain/entities/case");
class TestUtils {
    static generateObjectId() {
        return new mongodb_1.ObjectId();
    }
    static generateMockStaff(overrides = {}) {
        const now = new Date();
        return {
            _id: this.generateObjectId(),
            guildId: 'test-guild-123',
            userId: `user-${Date.now()}`,
            robloxUsername: `roblox${Date.now()}`,
            role: staff_role_1.StaffRole.PARALEGAL,
            status: 'active',
            hiredAt: now,
            hiredBy: 'test-admin',
            promotionHistory: [],
            createdAt: now,
            updatedAt: now,
            ...overrides
        };
    }
    static generateMockCase(overrides = {}) {
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
            status: case_1.CaseStatus.PENDING,
            priority: case_1.CasePriority.MEDIUM,
            assignedLawyerIds: [],
            documents: [],
            notes: [],
            createdAt: now,
            updatedAt: now,
            ...overrides
        };
    }
    static generateMockJob(overrides = {}) {
        const now = new Date();
        return {
            _id: this.generateObjectId(),
            guildId: 'test-guild-123',
            title: 'Test Job Position',
            description: 'Test job description',
            staffRole: staff_role_1.StaffRole.PARALEGAL,
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
    static generateMockApplication(overrides = {}) {
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
    static async clearTestDatabase() {
        if (process.env.NODE_ENV !== 'test') {
            throw new Error('clearTestDatabase can only be called in test environment');
        }
        // Use the global shared connection
        const mongoClient = global.__mongoClient;
        if (!mongoClient) {
            throw new Error('Global MongoDB client not initialized. Check globalSetup.');
        }
        const db = mongoClient.getDatabase();
        const collections = await db.listCollections().toArray();
        for (const collection of collections) {
            await db.collection(collection.name).deleteMany({});
        }
    }
    static async ensureTestDatabaseConnection() {
        // Connection is managed globally, just verify it exists
        const mongoClient = global.__mongoClient;
        if (!mongoClient || !mongoClient.isConnected()) {
            throw new Error('Global MongoDB connection not available. Check globalSetup.');
        }
    }
    static mockDiscordInteraction(overrides = {}) {
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
    static createMockPermissionContext(overrides = {}) {
        return {
            guildId: 'test-guild-123',
            userId: 'test-user-123',
            userRoles: ['role-id-1'],
            isGuildOwner: false,
            ...overrides
        };
    }
    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    static async runConcurrentOperations(operations, concurrency = 5) {
        const results = [];
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
    static generateLargeDataset(generator, count) {
        return Array.from({ length: count }, (_, index) => generator(index));
    }
}
exports.TestUtils = TestUtils;
//# sourceMappingURL=test-utils.js.map