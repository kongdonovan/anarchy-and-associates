"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_mongo_repository_1 = require("../../infrastructure/repositories/base-mongo-repository");
const mongo_client_1 = require("../../infrastructure/database/mongo-client");
// Test repository implementation
class TestRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('test_entities');
    }
}
describe('BaseMongoRepository', () => {
    let repository;
    let mongoClient;
    beforeAll(async () => {
        mongoClient = mongo_client_1.MongoDbClient.getInstance();
        // Skip connection for unit tests unless MongoDB is available
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
            expect(() => new TestRepository()).toThrow('Database not connected. Call connect() first.');
        });
    });
    // Integration tests would require MongoDB connection
    describe.skip('CRUD operations', () => {
        const testEntity = {
            name: 'Test Entity',
            value: 42
        };
        beforeAll(async () => {
            await mongoClient.connect();
            repository = new TestRepository();
        });
        afterEach(async () => {
            // Clean up test data
            const collection = mongoClient.getDatabase().collection('test_entities');
            await collection.deleteMany({});
        });
        it('should add an entity', async () => {
            const result = await repository.add(testEntity);
            expect(result._id).toBeDefined();
            expect(result.name).toBe(testEntity.name);
            expect(result.value).toBe(testEntity.value);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });
        it('should find entity by ID', async () => {
            const added = await repository.add(testEntity);
            const found = await repository.findById(added._id.toHexString());
            expect(found).not.toBeNull();
            expect(found.name).toBe(testEntity.name);
        });
        it('should update an entity', async () => {
            const added = await repository.add(testEntity);
            const updated = await repository.update(added._id.toHexString(), { name: 'Updated Name' });
            expect(updated).not.toBeNull();
            expect(updated.name).toBe('Updated Name');
            expect(updated.updatedAt.getTime()).toBeGreaterThan(updated.createdAt.getTime());
        });
        it('should delete an entity', async () => {
            const added = await repository.add(testEntity);
            const deleted = await repository.delete(added._id.toHexString());
            expect(deleted).toBe(true);
            const found = await repository.findById(added._id.toHexString());
            expect(found).toBeNull();
        });
        it('should find entities by filters', async () => {
            await repository.add({ name: 'Entity 1', value: 1 });
            await repository.add({ name: 'Entity 2', value: 2 });
            const found = await repository.findByFilters({ value: 1 });
            expect(found).toHaveLength(1);
            expect(found[0]?.name).toBe('Entity 1');
        });
    });
});
//# sourceMappingURL=base-repository.test.js.map