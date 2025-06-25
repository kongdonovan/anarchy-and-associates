import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { AuditAction } from '../../domain/entities/audit-log';
import { StaffRole } from '../../domain/entities/staff-role';
import { logger } from '../../infrastructure/logger';

// Mock the logger and base repository
jest.mock('../../infrastructure/logger');
jest.mock('../../infrastructure/repositories/base-mongo-repository');

describe('Enhanced AuditLogRepository', () => {
  let auditLogRepository: AuditLogRepository;
  let mockCollection: jest.Mocked<any>;

  const guildId = 'test_guild_123';
  const actorId = 'actor_123';
  const targetId = 'target_123';

  beforeEach(() => {
    // Mock the MongoDB collection
    mockCollection = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockReturnThis(),
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'audit_id_123' }),
    };

    auditLogRepository = new AuditLogRepository();
    // Mock the collection property
    Object.defineProperty(auditLogRepository, 'collection', {
      get: () => mockCollection,
    });

    // Mock the add method from base repository  
    auditLogRepository.add = jest.fn().mockResolvedValue({
      _id: 'audit_id_123',
      guildId,
      action: AuditAction.GUILD_OWNER_BYPASS,
      actorId,
      targetId,
      timestamp: new Date(),
      details: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  });

  describe('logGuildOwnerBypass', () => {
    it('should log guild owner bypass with correct structure', async () => {
      const businessRuleViolated = 'role-limit';
      const originalValidationErrors = ['Cannot hire Managing Partner. Maximum limit of 1 reached'];
      const bypassReason = 'Emergency hire needed';
      const metadata = { role: StaffRole.MANAGING_PARTNER, newCount: 2 };

      const result = await auditLogRepository.logGuildOwnerBypass(
        guildId,
        actorId,
        targetId,
        businessRuleViolated,
        originalValidationErrors,
        bypassReason,
        metadata
      );

      expect(auditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId,
          action: AuditAction.GUILD_OWNER_BYPASS,
          actorId,
          targetId,
          details: expect.objectContaining({
            reason: bypassReason,
            metadata,
            bypassInfo: expect.objectContaining({
              bypassType: 'guild-owner',
              businessRuleViolated,
              originalValidationErrors,
              bypassReason,
              ruleMetadata: metadata,
            }),
          }),
          isGuildOwnerBypass: true,
          businessRulesBypassed: [businessRuleViolated],
          severity: 'high',
        })
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Guild owner bypass logged',
        expect.objectContaining({
          guildId,
          actorId,
          targetId,
          businessRuleViolated,
          bypassReason,
        })
      );

      expect(result).toBeDefined();
    });

    it('should handle missing optional parameters', async () => {
      const businessRuleViolated = 'case-limit';
      const originalValidationErrors = ['Client has reached maximum active case limit'];

      const result = await auditLogRepository.logGuildOwnerBypass(
        guildId,
        actorId,
        undefined, // no targetId
        businessRuleViolated,
        originalValidationErrors
        // no bypassReason or metadata
      );

      expect(auditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId,
          action: AuditAction.GUILD_OWNER_BYPASS,
          actorId,
          targetId: undefined,
          details: expect.objectContaining({
            reason: 'Guild owner bypass executed',
            bypassInfo: expect.objectContaining({
              bypassType: 'guild-owner',
              businessRuleViolated,
              originalValidationErrors,
              bypassReason: undefined,
            }),
          }),
        })
      );

      expect(result).toBeDefined();
    });

    it('should handle logging errors gracefully', async () => {
      (auditLogRepository.add as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(auditLogRepository.logGuildOwnerBypass(
        guildId,
        actorId,
        targetId,
        'role-limit',
        ['Error message']
      )).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error logging guild owner bypass:',
        expect.any(Error)
      );
    });
  });

  describe('logRoleLimitBypass', () => {
    it('should log role limit bypass with detailed information', async () => {
      const role = StaffRole.MANAGING_PARTNER;
      const currentCount = 1;
      const maxCount = 1;
      const bypassReason = 'Emergency organizational restructure';

      const result = await auditLogRepository.logRoleLimitBypass(
        guildId,
        actorId,
        targetId,
        role,
        currentCount,
        maxCount,
        bypassReason
      );

      expect(auditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId,
          action: AuditAction.ROLE_LIMIT_BYPASSED,
          actorId,
          targetId,
          details: expect.objectContaining({
            reason: bypassReason,
            metadata: {
              role,
              newCount: currentCount + 1,
              previousLimit: maxCount,
            },
            bypassInfo: expect.objectContaining({
              bypassType: 'guild-owner',
              businessRuleViolated: 'role-limit',
              originalValidationErrors: [`Cannot hire ${role}. Maximum limit of ${maxCount} reached (current: ${currentCount})`],
              bypassReason,
              currentCount,
              maxCount,
              ruleMetadata: { role, newCount: currentCount + 1 },
            }),
          }),
          isGuildOwnerBypass: true,
          businessRulesBypassed: ['role-limit'],
          severity: 'medium',
        })
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Role limit bypass logged',
        expect.objectContaining({
          guildId,
          actorId,
          targetId,
          role,
          currentCount,
          maxCount,
          bypassReason,
        })
      );

      expect(result).toBeDefined();
    });

    it('should use default reason when none provided', async () => {
      await auditLogRepository.logRoleLimitBypass(
        guildId,
        actorId,
        targetId,
        StaffRole.PARALEGAL,
        9,
        10
        // no bypassReason
      );

      expect(auditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            reason: 'Role limit bypassed by guild owner',
          }),
        })
      );
    });
  });

  describe('logBusinessRuleViolation', () => {
    it('should log business rule violations with context', async () => {
      const ruleViolated = 'unauthorized-case-access';
      const violationDetails = ['User attempted to access case without permission', 'User role: Junior Associate'];
      const action = AuditAction.CASE_ASSIGNED;
      const metadata = { caseId: 'case_123', attemptedAction: 'view_sensitive_documents' };

      const result = await auditLogRepository.logBusinessRuleViolation(
        guildId,
        actorId,
        ruleViolated,
        violationDetails,
        action,
        targetId,
        metadata
      );

      expect(auditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId,
          action: AuditAction.BUSINESS_RULE_VIOLATION,
          actorId,
          targetId,
          details: expect.objectContaining({
            reason: `Business rule violation: ${ruleViolated}`,
            metadata: expect.objectContaining({
              ...metadata,
              originalAction: action,
              violationDetails,
            }),
          }),
          businessRulesBypassed: [ruleViolated],
          severity: 'high',
        })
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Business rule violation logged',
        expect.objectContaining({
          guildId,
          actorId,
          targetId,
          ruleViolated,
          violationDetails,
        })
      );

      expect(result).toBeDefined();
    });
  });

  describe('findGuildOwnerBypasses', () => {
    it('should find guild owner bypasses with correct filter', async () => {
      const mockBypasses = [
        {
          _id: 'bypass_1',
          guildId,
          action: AuditAction.GUILD_OWNER_BYPASS,
          isGuildOwnerBypass: true,
          timestamp: new Date(),
        },
        {
          _id: 'bypass_2',
          guildId,
          action: AuditAction.ROLE_LIMIT_BYPASSED,
          isGuildOwnerBypass: true,
          timestamp: new Date(),
        },
      ];

      mockCollection.toArray.mockResolvedValue(mockBypasses);

      const result = await auditLogRepository.findGuildOwnerBypasses(guildId, 25);

      expect(mockCollection.find).toHaveBeenCalledWith({
        guildId,
        isGuildOwnerBypass: true,
      });
      expect(mockCollection.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(mockCollection.limit).toHaveBeenCalledWith(25);
      expect(result).toEqual(mockBypasses);
    });

    it('should handle database errors in bypass search', async () => {
      mockCollection.toArray.mockRejectedValue(new Error('Database connection lost'));

      await expect(auditLogRepository.findGuildOwnerBypasses(guildId))
        .rejects.toThrow('Database connection lost');

      expect(logger.error).toHaveBeenCalledWith(
        `Error finding guild owner bypasses for guild ${guildId}:`,
        expect.any(Error)
      );
    });
  });

  describe('findBusinessRuleViolations', () => {
    it('should find business rule violations with correct filter', async () => {
      const mockViolations = [
        {
          _id: 'violation_1',
          guildId,
          action: AuditAction.BUSINESS_RULE_VIOLATION,
          timestamp: new Date(),
        },
      ];

      mockCollection.toArray.mockResolvedValue(mockViolations);

      const result = await auditLogRepository.findBusinessRuleViolations(guildId, 10);

      expect(mockCollection.find).toHaveBeenCalledWith({
        guildId,
        action: AuditAction.BUSINESS_RULE_VIOLATION,
      });
      expect(mockCollection.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(mockCollection.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockViolations);
    });
  });

  describe('getBypassStats', () => {
    it('should return comprehensive bypass statistics', async () => {
      // Mock the count queries
      mockCollection.countDocuments
        .mockResolvedValueOnce(15) // totalBypasses
        .mockResolvedValueOnce(8)  // roleLimitBypasses
        .mockResolvedValueOnce(3)  // businessRuleViolations
        .mockResolvedValueOnce(2); // recentBypasses

      const stats = await auditLogRepository.getBypassStats(guildId);

      expect(stats).toEqual({
        totalBypasses: 15,
        roleLimitBypasses: 8,
        businessRuleViolations: 3,
        recentBypasses: 2,
      });

      // Verify the correct queries were made
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        guildId,
        isGuildOwnerBypass: true,
      });
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        guildId,
        action: AuditAction.ROLE_LIMIT_BYPASSED,
      });
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        guildId,
        action: AuditAction.BUSINESS_RULE_VIOLATION,
      });
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        guildId,
        isGuildOwnerBypass: true,
        timestamp: { $gte: expect.any(Date) },
      });
    });

    it('should handle statistics query errors', async () => {
      mockCollection.countDocuments.mockRejectedValue(new Error('Statistics query failed'));

      await expect(auditLogRepository.getBypassStats(guildId))
        .rejects.toThrow('Statistics query failed');

      expect(logger.error).toHaveBeenCalledWith(
        `Error getting bypass stats for guild ${guildId}:`,
        expect.any(Error)
      );
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle extremely long bypass reasons', async () => {
      const longReason = 'A'.repeat(10000); // Very long reason
      
      await auditLogRepository.logRoleLimitBypass(
        guildId,
        actorId,
        targetId,
        StaffRole.PARALEGAL,
        5,
        10,
        longReason
      );

      expect(auditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            reason: longReason,
          }),
        })
      );
    });

    it('should handle special characters in metadata', async () => {
      const specialMetadata = {
        'special-key!@#$%': 'value with émojis 🚀',
        'unicode': '测试数据',
        'nested': { 'array': [1, 2, 3], 'null': null },
      };

      await auditLogRepository.logGuildOwnerBypass(
        guildId,
        actorId,
        targetId,
        'test-rule',
        ['Test error'],
        'Test reason',
        specialMetadata
      );

      expect(auditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            metadata: specialMetadata,
          }),
        })
      );
    });

    it('should handle concurrent bypass logging', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        auditLogRepository.logRoleLimitBypass(
          guildId,
          `actor_${i}`,
          `target_${i}`,
          StaffRole.PARALEGAL,
          i,
          10,
          `Reason ${i}`
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(auditLogRepository.add).toHaveBeenCalledTimes(5);
    });

    it('should handle malformed guild IDs gracefully', async () => {
      const malformedGuildId = '';

      await auditLogRepository.logBusinessRuleViolation(
        malformedGuildId,
        actorId,
        'test-rule',
        ['Test violation'],
        AuditAction.STAFF_HIRED
      );

      expect(auditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: malformedGuildId,
        })
      );
    });

    it('should handle array of business rules in violation logging', async () => {
      const multipleRules = ['rule-1', 'rule-2', 'rule-3'];
      
      await auditLogRepository.logBusinessRuleViolation(
        guildId,
        actorId,
        multipleRules.join(', '), // Multiple rules as single string
        ['Multiple rules violated simultaneously'],
        AuditAction.CASE_CREATED
      );

      expect(auditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          businessRulesBypassed: [multipleRules.join(', ')],
        })
      );
    });
  });

  describe('performance and optimization', () => {
    it('should use appropriate indexes for bypass queries', async () => {
      await auditLogRepository.findGuildOwnerBypasses(guildId, 100);

      // Verify query structure for index optimization
      expect(mockCollection.find).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId,
          isGuildOwnerBypass: true,
        })
      );
      expect(mockCollection.sort).toHaveBeenCalledWith({ timestamp: -1 });
    });

    it('should limit query results to prevent memory issues', async () => {
      await auditLogRepository.findBusinessRuleViolations(guildId, 1000);

      expect(mockCollection.limit).toHaveBeenCalledWith(1000);
    });

    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        _id: `audit_${i}`,
        guildId,
        timestamp: new Date(),
      }));

      mockCollection.toArray.mockResolvedValue(largeResultSet);

      const result = await auditLogRepository.findGuildOwnerBypasses(guildId, 1000);

      expect(result).toHaveLength(1000);
    });
  });
});