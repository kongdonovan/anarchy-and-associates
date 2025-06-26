"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const mongo_client_1 = require("../../infrastructure/database/mongo-client");
describe('GuildConfigRepository', () => {
    let repository;
    let mongoClient;
    const testGuildId = 'test_guild_123';
    beforeAll(async () => {
        mongoClient = mongo_client_1.MongoDbClient.getInstance();
    });
    afterAll(async () => {
        if (mongoClient.isConnected()) {
            await mongoClient.disconnect();
        }
    });
    describe('constructor', () => {
        let originalGlobalClient;
        beforeEach(() => {
            // Temporarily hide the global client to test the throw condition
            originalGlobalClient = global.__mongoClient;
            global.__mongoClient = undefined;
        });
        afterEach(() => {
            // Restore the global client for other tests
            global.__mongoClient = originalGlobalClient;
        });
        it('should throw when database is not connected', () => {
            expect(() => new guild_config_repository_1.GuildConfigRepository()).toThrow('Database not connected. Call connect() first.');
        });
    });
    describe.skip('CRUD operations', () => {
        beforeAll(async () => {
            await mongoClient.connect();
            repository = new guild_config_repository_1.GuildConfigRepository();
        });
        afterEach(async () => {
            // Clean up test data
            const collection = mongoClient.getDatabase().collection('guild_configs');
            await collection.deleteMany({});
        });
        it('should create default config for guild', async () => {
            const config = await repository.createDefaultConfig(testGuildId);
            expect(config.guildId).toBe(testGuildId);
            expect(config.adminUsers).toEqual([]);
            expect(config.adminRoles).toEqual([]);
            expect(config.permissions).toBeDefined();
            expect(config.permissions.admin).toEqual([]);
        });
        it('should find config by guild ID', async () => {
            await repository.createDefaultConfig(testGuildId);
            const found = await repository.findByGuildId(testGuildId);
            expect(found).not.toBeNull();
            expect(found.guildId).toBe(testGuildId);
        });
        it('should ensure guild config exists', async () => {
            const config = await repository.ensureGuildConfig(testGuildId);
            expect(config.guildId).toBe(testGuildId);
            // Second call should return existing config
            const config2 = await repository.ensureGuildConfig(testGuildId);
            expect(config2._id).toEqual(config._id);
        });
        it('should add admin user', async () => {
            await repository.createDefaultConfig(testGuildId);
            const userId = 'user_123';
            const result = await repository.addAdminUser(testGuildId, userId);
            expect(result).not.toBeNull();
            expect(result.adminUsers).toContain(userId);
        });
        it('should remove admin user', async () => {
            await repository.createDefaultConfig(testGuildId);
            const userId = 'user_123';
            await repository.addAdminUser(testGuildId, userId);
            const result = await repository.removeAdminUser(testGuildId, userId);
            expect(result).not.toBeNull();
            expect(result.adminUsers).not.toContain(userId);
        });
        it('should add admin role', async () => {
            await repository.createDefaultConfig(testGuildId);
            const roleId = 'role_123';
            const result = await repository.addAdminRole(testGuildId, roleId);
            expect(result).not.toBeNull();
            expect(result.adminRoles).toContain(roleId);
        });
        it('should set permission role', async () => {
            await repository.createDefaultConfig(testGuildId);
            const roleId = 'role_123';
            const result = await repository.setPermissionRole(testGuildId, 'senior-staff', roleId);
            expect(result).not.toBeNull();
            expect(result.permissions['senior-staff']).toContain(roleId);
        });
    });
});
//# sourceMappingURL=guild-config-repository.test.js.map