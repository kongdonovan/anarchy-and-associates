// import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { MongoUnitOfWorkFactory } from '../../infrastructure/unit-of-work/mongo-unit-of-work';
// import { TransactionOptions } from '../../infrastructure/unit-of-work/unit-of-work';
import { RollbackService } from '../../infrastructure/unit-of-work/rollback-service';
import { TransactionErrorHandler } from '../../infrastructure/unit-of-work/transaction-error-handler';
import { BaseMongoRepository } from '../../infrastructure/repositories/base-mongo-repository';
import { Staff, Case } from '../../validation';
// Remove StaffRole, CaseStatus, CasePriority imports - use string literals

describe.skip('Transaction Isolation Tests', () => {
  // let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;
  let unitOfWorkFactory: MongoUnitOfWorkFactory;
  let rollbackService: RollbackService;
  let errorHandler: TransactionErrorHandler;

  // Test repositories
  class TestStaffRepository extends BaseMongoRepository<Staff> {
    constructor() {
      super('staff');
    }
  }

  class TestCaseRepository extends BaseMongoRepository<Case> {
    constructor() {
      super('cases');
    }
  }

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    // mongoServer = await MongoMemoryServer.create({
    //   instance: {
    //     replSet: 'testset', // Enable replica set for transactions
    //   },
    // });

    // const uri = mongoServer.getUri();
    mongoClient = new MongoClient('mongodb://localhost:27017');
    await mongoClient.connect();

    // Initialize services
    rollbackService = new RollbackService();
    unitOfWorkFactory = new MongoUnitOfWorkFactory(mongoClient);
    errorHandler = new TransactionErrorHandler(rollbackService);
  });

  afterAll(async () => {
    await mongoClient.close();
    // await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const db = mongoClient.db();
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      await db.collection(collection.name).deleteMany({});
    }
  });

  describe('Transaction Isolation Levels', () => {
    it('should maintain read committed isolation', async () => {
      const unitOfWork1 = unitOfWorkFactory.create({ readConcern: 'majority' });
      const unitOfWork2 = unitOfWorkFactory.create({ readConcern: 'majority' });

      try {
        // Start first transaction
        await unitOfWork1.begin();
        const staffRepo1 = unitOfWork1.getRepository(TestStaffRepository);

        // Create staff member in first transaction
        const staffData: Omit<Staff, '_id' | 'createdAt' | 'updatedAt'> = {
          userId: 'user123',
          guildId: 'guild123',
          robloxUsername: 'TestUser',
          role: 'Paralegal',
          hiredAt: new Date(),
          hiredBy: 'admin123',
          promotionHistory: [],
          status: 'active'
        };

        const createdStaff = await staffRepo1.add(staffData);
        expect(createdStaff).toBeDefined();

        // Start second transaction (should not see uncommitted data)
        await unitOfWork2.begin();
        const staffRepo2 = unitOfWork2.getRepository(TestStaffRepository);

        const foundStaff = await staffRepo2.findByFilters({ userId: 'user123' });
        expect(foundStaff).toHaveLength(0); // Should not see uncommitted data

        // Commit first transaction
        await unitOfWork1.commit();

        // Now second transaction should see committed data
        const foundStaffAfterCommit = await staffRepo2.findByFilters({ userId: 'user123' });
        expect(foundStaffAfterCommit).toHaveLength(1);

        await unitOfWork2.commit();

      } finally {
        await unitOfWork1.dispose();
        await unitOfWork2.dispose();
      }
    });

    it('should handle snapshot isolation correctly', async () => {
      const unitOfWork1 = unitOfWorkFactory.create({ readConcern: 'snapshot' });
      const unitOfWork2 = unitOfWorkFactory.create({ readConcern: 'snapshot' });

      try {
        // Create initial data outside transaction
        const db = mongoClient.db();
        await db.collection('staff').insertOne({
          userId: 'user456',
          guildId: 'guild123',
          robloxUsername: 'SnapshotUser',
          role: 'Junior Associate',
          hiredAt: new Date(),
          hiredBy: 'admin123',
          promotionHistory: [],
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Start both transactions
        await unitOfWork1.begin();
        await unitOfWork2.begin();

        const staffRepo1 = unitOfWork1.getRepository(TestStaffRepository);
        const staffRepo2 = unitOfWork2.getRepository(TestStaffRepository);

        // Both should see the initial data
        const staff1 = await staffRepo1.findByFilters({ userId: 'user456' });
        const staff2 = await staffRepo2.findByFilters({ userId: 'user456' });

        expect(staff1).toHaveLength(1);
        expect(staff2).toHaveLength(1);

        // Update in first transaction
        if (staff1[0] && staff1[0]._id) {
          await staffRepo1.update(staff1[0]._id.toString(), { role: 'Senior Associate' });

          // Second transaction should still see original snapshot
          const staff2Updated = await staffRepo2.findById(staff1[0]._id.toString());
          expect(staff2Updated!.role).toBe('Junior Associate');
        }

        await unitOfWork1.commit();
        await unitOfWork2.commit();

      } finally {
        await unitOfWork1.dispose();
        await unitOfWork2.dispose();
      }
    });
  });

  describe('Concurrent Transaction Tests', () => {
    it('should handle concurrent staff creation without conflicts', async () => {
      const createStaffConcurrently = async (userId: string, role: 'Managing Partner' | 'Senior Partner' | 'Junior Partner' | 'Senior Associate' | 'Junior Associate' | 'Paralegal') => {
        const unitOfWork = unitOfWorkFactory.create();
        
        try {
          await unitOfWork.begin();
          const staffRepo = unitOfWork.getRepository(TestStaffRepository);

          const staffData: Omit<Staff, '_id' | 'createdAt' | 'updatedAt'> = {
            userId,
            guildId: 'guild123',
            robloxUsername: `User${userId}`,
            role,
            hiredAt: new Date(),
            hiredBy: 'admin123',
            promotionHistory: [],
            status: 'active'
          };

          const staff = await staffRepo.add(staffData);
          await unitOfWork.commit();
          return staff;

        } finally {
          await unitOfWork.dispose();
        }
      };

      // Create multiple staff members concurrently
      const promises = [
        createStaffConcurrently('user1', 'Paralegal'),
        createStaffConcurrently('user2', 'Junior Associate'),
        createStaffConcurrently('user3', 'Senior Associate')
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach(staff => expect(staff._id).toBeDefined());

      // Verify all staff were created
      const unitOfWork = unitOfWorkFactory.create();
      try {
        await unitOfWork.begin();
        const staffRepo = unitOfWork.getRepository(TestStaffRepository);
        const allStaff = await staffRepo.findByFilters({ guildId: 'guild123' });
        expect(allStaff).toHaveLength(3);
        await unitOfWork.commit();
      } finally {
        await unitOfWork.dispose();
      }
    });

    it('should detect and handle write conflicts', async () => {
      // Create initial staff member
      const db = mongoClient.db();
      const staffId = await db.collection('staff').insertOne({
        userId: 'conflictUser',
        guildId: 'guild123',
        robloxUsername: 'ConflictTest',
        role: 'Paralegal',
        hiredAt: new Date(),
        hiredBy: 'admin123',
        promotionHistory: [],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const unitOfWork1 = unitOfWorkFactory.create();
      const unitOfWork2 = unitOfWorkFactory.create();

      try {
        await unitOfWork1.begin();
        await unitOfWork2.begin();

        const staffRepo1 = unitOfWork1.getRepository(TestStaffRepository);
        const staffRepo2 = unitOfWork2.getRepository(TestStaffRepository);

        // Both transactions update the same document
        const updatePromise1 = staffRepo1.update(
          staffId.insertedId.toString(), 
          { role: 'Junior Associate' }
        );
        
        const updatePromise2 = staffRepo2.update(
          staffId.insertedId.toString(), 
          { role: 'Senior Associate' }
        );

        // Execute updates
        await updatePromise1;
        await updatePromise2;

        // One of the commits should succeed, the other should fail
        const commit1Promise = unitOfWork1.commit();
        const commit2Promise = unitOfWork2.commit();

        const results = await Promise.allSettled([commit1Promise, commit2Promise]);
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failureCount = results.filter(r => r.status === 'rejected').length;

        // Exactly one should succeed and one should fail due to write conflict
        expect(successCount).toBe(1);
        expect(failureCount).toBe(1);

      } finally {
        await unitOfWork1.dispose();
        await unitOfWork2.dispose();
      }
    });
  });

  describe('Rollback Scenario Tests', () => {
    it('should rollback transaction on error', async () => {
      const unitOfWork = unitOfWorkFactory.create();

      try {
        await unitOfWork.begin();
        const staffRepo = unitOfWork.getRepository(TestStaffRepository);
        const caseRepo = unitOfWork.getRepository(TestCaseRepository);

        // Create staff member
        const staffData: Omit<Staff, '_id' | 'createdAt' | 'updatedAt'> = {
          userId: 'rollbackUser',
          guildId: 'guild123',
          robloxUsername: 'RollbackTest',
          role: 'Paralegal',
          hiredAt: new Date(),
          hiredBy: 'admin123',
          promotionHistory: [],
          status: 'active'
        };

        const staff = await staffRepo.add(staffData);
        expect(staff._id).toBeDefined();

        // Create case
        const caseData: Omit<Case, '_id' | 'createdAt' | 'updatedAt'> = {
          guildId: 'guild123',
          caseNumber: 'CASE-2024-001',
          clientId: 'client123',
          clientUsername: 'TestClient',
          title: 'Test Case',
          description: 'Test case description',
          status: 'pending',
          priority: 'medium',
          assignedLawyerIds: [],
          documents: [],
          notes: []
        };

        const testCase = await caseRepo.add(caseData);
        expect(testCase._id).toBeDefined();

        // Simulate an error by throwing
        throw new Error('Simulated transaction error');

      } catch (error) {
        // Rollback transaction
        await unitOfWork.rollback();

        // Verify nothing was committed
        const db = mongoClient.db();
        const staffCount = await db.collection('staff').countDocuments({ userId: 'rollbackUser' });
        const caseCount = await db.collection('cases').countDocuments({ caseNumber: 'CASE-2024-001' });

        expect(staffCount).toBe(0);
        expect(caseCount).toBe(0);

      } finally {
        await unitOfWork.dispose();
      }
    });

    it('should handle nested rollback scenarios', async () => {
      const performNestedOperations = async () => {
        const unitOfWork = unitOfWorkFactory.create();

        try {
          await unitOfWork.begin();
          const staffRepo = unitOfWork.getRepository(TestStaffRepository);

          // Create first staff member
          await staffRepo.add({
            userId: 'nested1',
            guildId: 'guild123',
            robloxUsername: 'Nested1',
            role: 'Paralegal',
            hiredAt: new Date(),
            hiredBy: 'admin123',
            promotionHistory: [],
            status: 'active'
          });

          // Simulate nested operation that fails
          try {
            await staffRepo.add({
              userId: 'nested2',
              guildId: 'guild123',
              robloxUsername: 'Nested2',
              role: 'Junior Associate',
              hiredAt: new Date(),
              hiredBy: 'admin123',
              promotionHistory: [],
              status: 'active'
            });

            // Simulate error in nested operation
            throw new Error('Nested operation failed');

          } catch (nestedError) {
            // Rollback everything
            await unitOfWork.rollback();
            throw nestedError;
          }

        } finally {
          await unitOfWork.dispose();
        }
      };

      await expect(performNestedOperations()).rejects.toThrow('Nested operation failed');

      // Verify no data was committed
      const db = mongoClient.db();
      const staffCount = await db.collection('staff').countDocuments({ guildId: 'guild123' });
      expect(staffCount).toBe(0);
    });
  });

  describe('Session Management Tests', () => {
    it('should properly manage session lifecycle', async () => {
      const unitOfWork = unitOfWorkFactory.create();

      expect(unitOfWork.getSession()).toBeNull();
      expect(unitOfWork.isActive()).toBeFalsy();

      await unitOfWork.begin();
      
      const session = unitOfWork.getSession();
      expect(session).toBeDefined();
      expect(session!.inTransaction()).toBeTruthy();
      expect(unitOfWork.isActive()).toBeTruthy();

      await unitOfWork.commit();
      
      expect(unitOfWork.isActive()).toBeFalsy();

      await unitOfWork.dispose();
    });

    it('should handle session timeout gracefully', async () => {
      const unitOfWork = unitOfWorkFactory.create({
        maxTimeMS: 100 // Very short timeout
      });

      try {
        await unitOfWork.begin();
        
        // Wait longer than timeout
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const staffRepo = unitOfWork.getRepository(TestStaffRepository);
        
        // This should fail due to timeout
        await expect(staffRepo.add({
          userId: 'timeoutUser',
          guildId: 'guild123',
          robloxUsername: 'TimeoutTest',
          role: 'Paralegal',
          hiredAt: new Date(),
          hiredBy: 'admin123',
          promotionHistory: [],
          status: 'active'
        })).rejects.toThrow();

      } finally {
        await unitOfWork.dispose();
      }
    });
  });

  describe('Error Handling and Recovery Tests', () => {
    it('should handle transaction errors with retry logic', async () => {
      let attemptCount = 0;

      const operation = async () => {
        attemptCount++;
        
        if (attemptCount < 3) {
          // Simulate transient error
          const error = new Error('Transient transaction error');
          (error as any).code = 112; // TransientTransactionError
          (error as any).errorLabels = ['TransientTransactionError'];
          throw error;
        }

        // Succeed on third attempt
        const unitOfWork = unitOfWorkFactory.create();
        try {
          await unitOfWork.begin();
          const staffRepo = unitOfWork.getRepository(TestStaffRepository);
          
          const staff = await staffRepo.add({
            userId: 'retryUser',
            guildId: 'guild123',
            robloxUsername: 'RetryTest',
            role: 'Paralegal',
            hiredAt: new Date(),
            hiredBy: 'admin123',
            promotionHistory: [],
            status: 'active'
          });

          await unitOfWork.commit();
          return staff;
        } finally {
          await unitOfWork.dispose();
        }
      };

      const result = await errorHandler.executeWithRetry(operation, 'testRetryOperation');
      
      expect(result.success).toBeTruthy();
      expect(result.attempts).toBe(3);
      expect(result.wasRetried).toBeTruthy();
      expect(attemptCount).toBe(3);
    });

    it('should handle permanent errors without retry', async () => {
      const operation = async () => {
        // Simulate permanent error
        const error = new Error('Session expired');
        (error as any).code = 228; // SessionExpired
        throw error;
      };

      const result = await errorHandler.executeWithRetry(operation, 'testPermanentError');
      
      expect(result.success).toBeFalsy();
      expect(result.attempts).toBe(1);
      expect(result.wasRetried).toBeFalsy();
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle high-concurrency operations', async () => {
      const concurrentOperations = 20;
      const promises: Promise<Staff>[] = [];

      for (let i = 0; i < concurrentOperations; i++) {
        const promise = (async () => {
          const unitOfWork = unitOfWorkFactory.create();
          try {
            await unitOfWork.begin();
            const staffRepo = unitOfWork.getRepository(TestStaffRepository);

            const staff = await staffRepo.add({
              userId: `concurrent${i}`,
              guildId: 'guild123',
              robloxUsername: `ConcurrentUser${i}`,
              role: 'Paralegal',
              hiredAt: new Date(),
              hiredBy: 'admin123',
              promotionHistory: [],
              status: 'active'
            });

            await unitOfWork.commit();
            return staff;
          } finally {
            await unitOfWork.dispose();
          }
        })();

        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      // Most operations should succeed (allowing for some write conflicts)
      expect(successCount).toBeGreaterThan(concurrentOperations * 0.8);
    });

    it('should maintain performance under transaction load', async () => {
      const operationCount = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: operationCount }, async (_, i) => {
        const unitOfWork = unitOfWorkFactory.create();
        try {
          await unitOfWork.begin();
          const staffRepo = unitOfWork.getRepository(TestStaffRepository);
          const caseRepo = unitOfWork.getRepository(TestCaseRepository);

          // Perform multiple operations in each transaction
          await staffRepo.add({
            userId: `perf${i}`,
            guildId: 'guild123',
            robloxUsername: `PerfUser${i}`,
            role: 'Paralegal',
            hiredAt: new Date(),
            hiredBy: 'admin123',
            promotionHistory: [],
            status: 'active'
          });

          await caseRepo.add({
            guildId: 'guild123',
            caseNumber: `PERF-2024-${i.toString().padStart(3, '0')}`,
            clientId: `client${i}`,
            clientUsername: `PerfClient${i}`,
            title: `Performance Test Case ${i}`,
            description: 'Performance test case description',
            status: 'pending',
            priority: 'medium',
            assignedLawyerIds: [],
            documents: [],
            notes: []
          });

          await unitOfWork.commit();
        } finally {
          await unitOfWork.dispose();
        }
      });

      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      const avgTransactionTime = duration / operationCount;
      
      // Each transaction should complete within reasonable time
      expect(avgTransactionTime).toBeLessThan(1000); // 1 second average
      
      console.log(`Performance test: ${operationCount} transactions in ${duration}ms (avg: ${avgTransactionTime.toFixed(2)}ms)`);
    });
  });
});