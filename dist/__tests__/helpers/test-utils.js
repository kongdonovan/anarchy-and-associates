"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestUtils = void 0;
const mongodb_1 = require("mongodb");
class TestUtils {
    static generateObjectId() {
        return new mongodb_1.ObjectId();
    }
    static generateMockStaff(overrides = {}) {
        const now = new Date();
        return {
            _id: this.generateObjectId().toString(),
            guildId: '123456789012345678', // Valid Discord snowflake
            userId: '234567890123456789', // Valid Discord snowflake
            robloxUsername: `roblox${Date.now()}`,
            role: 'Paralegal', // Use string literal that matches Zod enum
            status: 'active',
            hiredAt: now,
            hiredBy: '123456789012345679', // Valid Discord snowflake
            promotionHistory: [],
            createdAt: now,
            updatedAt: now,
            ...overrides
        };
    }
    static generateMockCase(overrides = {}) {
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
            status: 'pending', // Use string literal that matches Zod enum
            priority: 'medium', // Use string literal that matches Zod enum
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
    static generateMockApplication(overrides = {}) {
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
    static generateMockRetainer(overrides = {}) {
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
    static generateMockReminder(overrides = {}) {
        const now = new Date();
        const futureTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
        return {
            _id: this.generateObjectId().toString(),
            guildId: '123456789012345678', // Valid Discord snowflake
            userId: '234567890123456789', // Valid Discord snowflake
            username: `testuser${Date.now()}`,
            channelId: '345678901234567890', // Valid Discord snowflake - required field
            type: 'custom', // Required field with default
            message: 'Test reminder message',
            scheduledFor: futureTime,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            ...overrides
        };
    }
    static generateMockFeedback(overrides = {}) {
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
    static createMockPermissionContext(overrides = {}) {
        return {
            guildId: '123456789012345678', // Valid Discord snowflake
            userId: '123456789012345679', // Valid Discord snowflake
            userRoles: ['123456789012345680'], // Valid Discord snowflake
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
    // Helper functions to ensure valid Discord snowflake IDs
    static generateSnowflake() {
        // Generate a valid Discord snowflake (17-21 digits)
        const timestamp = Date.now() - 1420070400000; // Discord epoch
        const workerId = Math.floor(Math.random() * 31);
        const processId = Math.floor(Math.random() * 31);
        const increment = Math.floor(Math.random() * 4095);
        const snowflake = (BigInt(timestamp) << 22n) | (BigInt(workerId) << 17n) | (BigInt(processId) << 12n) | BigInt(increment);
        return snowflake.toString();
    }
    static ensureValidSnowflake(id) {
        if (!id || id.length < 17 || id.length > 21 || !/^\d+$/.test(id)) {
            return this.generateSnowflake();
        }
        return id;
    }
    // Convert ObjectId to string for Zod compatibility
    static toZodId(id) {
        if (!id)
            return undefined;
        return typeof id === 'string' ? id : id.toString();
    }
}
exports.TestUtils = TestUtils;
//# sourceMappingURL=test-utils.js.map