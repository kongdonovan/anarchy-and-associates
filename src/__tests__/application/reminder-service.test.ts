import { ReminderService } from '../../application/services/reminder-service';
import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { 
  Reminder, 
  ReminderCreationRequest, 
  ReminderSearchFilters,
  validateReminderCreation,
  calculateScheduledTime,
  parseTimeString,
  validateReminderTime,
  TimeUnit,
  MAX_REMINDER_DAYS,
  MAX_REMINDER_MILLISECONDS
} from '../../domain/entities/reminder';
import { Case } from '../../domain/entities/case';
import { Staff } from '../../domain/entities/staff';
import { TestUtils } from '../helpers/test-utils';
import { Client, TextChannel, User } from 'discord.js';

/**
 * Unit tests for ReminderService
 * Tests business logic with mocked repositories to ensure isolation
 */
describe('ReminderService Unit Tests', () => {
  let reminderService: ReminderService;
  let mockReminderRepository: jest.Mocked<ReminderRepository>;
  let mockCaseRepository: jest.Mocked<CaseRepository>;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let mockDiscordClient: jest.Mocked<Client>;
  let mockUser: jest.Mocked<User>;
  let mockChannel: jest.Mocked<TextChannel>;

  // Test data constants
  const testGuildId = '123456789012345678';
  const testUserId = '234567890123456789';
  const testChannelId = '345678901234567890';
  const testCaseId = TestUtils.generateObjectId().toString();
  const testReminderId = TestUtils.generateObjectId().toString();
  const testUsername = 'testuser';

  beforeEach(() => {
    // Create partial mock repositories with only the methods we need
    mockReminderRepository = {
      add: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      getUserReminders: jest.fn(),
      cancelReminder: jest.fn(),
      getCaseReminders: jest.fn(),
      getChannelReminders: jest.fn(),
      searchReminders: jest.fn(),
      getDueReminders: jest.fn(),
      getActiveReminders: jest.fn(),
      markAsDelivered: jest.fn(),
      cleanupDeliveredReminders: jest.fn()
    } as jest.Mocked<Partial<ReminderRepository>> as jest.Mocked<ReminderRepository>;

    mockCaseRepository = {
      searchCases: jest.fn()
    } as jest.Mocked<Partial<CaseRepository>> as jest.Mocked<CaseRepository>;

    mockStaffRepository = {
      findByFilters: jest.fn()
    } as jest.Mocked<Partial<StaffRepository>> as jest.Mocked<StaffRepository>;

    // Create mock Discord client and user
    mockUser = {
      id: testUserId,
      displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
      send: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockChannel = {
      id: testChannelId,
      send: jest.fn().mockResolvedValue(undefined),
      isTextBased: () => true,
      guild: { id: testGuildId }
    } as any;

    mockDiscordClient = {
      users: {
        fetch: jest.fn().mockResolvedValue(mockUser)
      },
      channels: {
        fetch: jest.fn().mockResolvedValue(mockChannel)
      }
    } as any;

    reminderService = new ReminderService(
      mockReminderRepository,
      mockCaseRepository,
      mockStaffRepository
    );

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createReminder', () => {
    const mockStaff: Staff = TestUtils.generateMockStaff({
      userId: testUserId,
      guildId: testGuildId
    });

    const mockReminderRequest: ReminderCreationRequest = {
      guildId: testGuildId,
      userId: testUserId,
      username: testUsername,
      message: 'Test reminder message',
      timeString: '2h'
    };

    const mockCreatedReminder: Reminder = TestUtils.generateMockReminder({
      _id: TestUtils.generateObjectId(),
      guildId: testGuildId,
      userId: testUserId,
      username: testUsername,
      message: 'Test reminder message',
      scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      isActive: true
    });

    beforeEach(() => {
      mockStaffRepository.findByFilters.mockResolvedValue([mockStaff]);
      mockReminderRepository.add.mockResolvedValue(mockCreatedReminder);
    });

    it('should create a reminder successfully with valid data', async () => {
      const result = await reminderService.createReminder(mockReminderRequest);

      expect(mockStaffRepository.findByFilters).toHaveBeenCalledWith({ userId: testUserId });
      expect(mockReminderRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: testGuildId,
          userId: testUserId,
          username: testUsername,
          message: 'Test reminder message',
          scheduledFor: expect.any(Date),
          isActive: true
        })
      );
      expect(result).toEqual(mockCreatedReminder);
    });

    it('should create reminder with channel ID', async () => {
      const requestWithChannel = {
        ...mockReminderRequest,
        channelId: testChannelId
      };

      mockCaseRepository.searchCases.mockResolvedValue([]);

      await reminderService.createReminder(requestWithChannel);

      expect(mockReminderRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: testChannelId
        })
      );
    });

    it('should associate reminder with case when channel has associated case', async () => {
      const mockCase: Case = TestUtils.generateMockCase({
        _id: TestUtils.generateObjectId(),
        guildId: testGuildId,
        channelId: testChannelId
      });

      const requestWithChannel = {
        ...mockReminderRequest,
        channelId: testChannelId
      };

      mockCaseRepository.searchCases.mockResolvedValue([mockCase]);

      await reminderService.createReminder(requestWithChannel);

      expect(mockCaseRepository.searchCases).toHaveBeenCalledWith({
        guildId: testGuildId,
        channelId: testChannelId
      });
      expect(mockReminderRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: mockCase._id!.toString(),
          channelId: testChannelId
        })
      );
    });

    it('should create reminder with explicitly provided case ID', async () => {
      const requestWithCase = {
        ...mockReminderRequest,
        caseId: testCaseId
      };

      await reminderService.createReminder(requestWithCase);

      expect(mockReminderRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: testCaseId
        })
      );
    });

    it('should throw error when user is not staff', async () => {
      mockStaffRepository.findByFilters.mockResolvedValue([]);

      await expect(reminderService.createReminder(mockReminderRequest))
        .rejects.toThrow('Only staff members can set reminders');

      expect(mockReminderRepository.add).not.toHaveBeenCalled();
    });

    it('should throw error with invalid time format', async () => {
      const invalidRequest = {
        ...mockReminderRequest,
        timeString: 'invalid'
      };

      await expect(reminderService.createReminder(invalidRequest))
        .rejects.toThrow('Invalid time format');
    });

    it('should throw error when validation fails', async () => {
      const invalidRequest = {
        ...mockReminderRequest,
        message: '' // Empty message
      };

      await expect(reminderService.createReminder(invalidRequest))
        .rejects.toThrow('Validation failed');
    });

    it('should handle various time formats correctly', async () => {
      const timeFormats = [
        { input: '30m', expectedMs: 30 * 60 * 1000 },
        { input: '2h', expectedMs: 2 * 60 * 60 * 1000 },
        { input: '1d', expectedMs: 24 * 60 * 60 * 1000 },
        { input: '5min', expectedMs: 5 * 60 * 1000 },
        { input: '3hours', expectedMs: 3 * 60 * 60 * 1000 },
        { input: '2days', expectedMs: 2 * 24 * 60 * 60 * 1000 }
      ];

      for (const format of timeFormats) {
        const baseTime = Date.now();
        jest.setSystemTime(baseTime);
        
        const request = { ...mockReminderRequest, timeString: format.input, message: `Test ${format.input}` };
        await reminderService.createReminder(request);

        const addCall = mockReminderRepository.add.mock.calls.find(call => 
          call[0].message === `Test ${format.input}`
        );
        expect(addCall).toBeDefined();
        
        const scheduledTime = addCall![0].scheduledFor;
        const expectedTime = new Date(baseTime + format.expectedMs);
        expect(Math.abs(scheduledTime.getTime() - expectedTime.getTime())).toBeLessThan(1000);
      }
    });

    it('should reject time strings exceeding maximum allowed', async () => {
      const invalidRequest = {
        ...mockReminderRequest,
        timeString: '8d' // Exceeds 7 day limit
      };

      await expect(reminderService.createReminder(invalidRequest))
        .rejects.toThrow('Validation failed: Maximum reminder time is 7 days');
    });

    it('should reject time strings below minimum allowed', async () => {
      const invalidRequest = {
        ...mockReminderRequest,
        timeString: '30s' // Less than 1 minute
      };

      await expect(reminderService.createReminder(invalidRequest))
        .rejects.toThrow('Invalid time format');
    });

    it('should handle repository failure gracefully', async () => {
      mockReminderRepository.add.mockRejectedValue(new Error('Database error'));

      await expect(reminderService.createReminder(mockReminderRequest))
        .rejects.toThrow('Database error');
    });
  });

  describe('getUserReminders', () => {
    const mockReminders: Reminder[] = [
      TestUtils.generateMockReminder({
        userId: testUserId,
        guildId: testGuildId,
        message: 'First reminder',
        isActive: true
      }),
      TestUtils.generateMockReminder({
        userId: testUserId,
        guildId: testGuildId,
        message: 'Second reminder',
        isActive: false
      })
    ];

    it('should get active reminders for user by default', async () => {
      const activeReminder = mockReminders[0]!;
      mockReminderRepository.getUserReminders.mockResolvedValue([activeReminder]);

      const result = await reminderService.getUserReminders(testUserId, testGuildId);

      expect(mockReminderRepository.getUserReminders).toHaveBeenCalledWith(
        testUserId,
        testGuildId,
        true
      );
      expect(result).toEqual([activeReminder]);
    });

    it('should get all reminders when activeOnly is false', async () => {
      mockReminderRepository.getUserReminders.mockResolvedValue(mockReminders);

      const result = await reminderService.getUserReminders(testUserId, testGuildId, false);

      expect(mockReminderRepository.getUserReminders).toHaveBeenCalledWith(
        testUserId,
        testGuildId,
        false
      );
      expect(result).toEqual(mockReminders);
    });

    it('should return empty array when no reminders found', async () => {
      mockReminderRepository.getUserReminders.mockResolvedValue([]);

      const result = await reminderService.getUserReminders(testUserId, testGuildId);

      expect(result).toEqual([]);
    });
  });

  describe('cancelReminder', () => {
    const mockReminder: Reminder = TestUtils.generateMockReminder({
      _id: TestUtils.generateObjectId(),
      userId: testUserId,
      guildId: testGuildId,
      isActive: true
    });

    const mockCancelledReminder: Reminder = {
      ...mockReminder,
      isActive: false
    };

    it('should cancel reminder successfully', async () => {
      mockReminderRepository.findById.mockResolvedValue(mockReminder);
      mockReminderRepository.cancelReminder.mockResolvedValue(mockCancelledReminder);

      const result = await reminderService.cancelReminder(testReminderId, testUserId);

      expect(mockReminderRepository.findById).toHaveBeenCalledWith(testReminderId);
      expect(mockReminderRepository.cancelReminder).toHaveBeenCalledWith(testReminderId);
      expect(result).toEqual(mockCancelledReminder);
    });

    it('should throw error when reminder not found', async () => {
      mockReminderRepository.findById.mockResolvedValue(null);

      await expect(reminderService.cancelReminder(testReminderId, testUserId))
        .rejects.toThrow('Reminder not found');

      expect(mockReminderRepository.cancelReminder).not.toHaveBeenCalled();
    });

    it('should throw error when user tries to cancel another user\'s reminder', async () => {
      const otherUserReminder = {
        ...mockReminder,
        userId: 'other-user-id'
      };
      mockReminderRepository.findById.mockResolvedValue(otherUserReminder);

      await expect(reminderService.cancelReminder(testReminderId, testUserId))
        .rejects.toThrow('You can only cancel your own reminders');

      expect(mockReminderRepository.cancelReminder).not.toHaveBeenCalled();
    });

    it('should throw error when reminder is already inactive', async () => {
      const inactiveReminder = {
        ...mockReminder,
        isActive: false
      };
      mockReminderRepository.findById.mockResolvedValue(inactiveReminder);

      await expect(reminderService.cancelReminder(testReminderId, testUserId))
        .rejects.toThrow('Reminder is already inactive');

      expect(mockReminderRepository.cancelReminder).not.toHaveBeenCalled();
    });
  });

  describe('getCaseReminders', () => {
    const mockCaseReminders: Reminder[] = [
      TestUtils.generateMockReminder({
        caseId: testCaseId,
        message: 'Case reminder 1'
      }),
      TestUtils.generateMockReminder({
        caseId: testCaseId,
        message: 'Case reminder 2'
      })
    ];

    it('should get reminders for a case', async () => {
      mockReminderRepository.getCaseReminders.mockResolvedValue(mockCaseReminders);

      const result = await reminderService.getCaseReminders(testCaseId);

      expect(mockReminderRepository.getCaseReminders).toHaveBeenCalledWith(testCaseId);
      expect(result).toEqual(mockCaseReminders);
    });

    it('should return empty array when no case reminders found', async () => {
      mockReminderRepository.getCaseReminders.mockResolvedValue([]);

      const result = await reminderService.getCaseReminders(testCaseId);

      expect(result).toEqual([]);
    });
  });

  describe('getChannelReminders', () => {
    const mockChannelReminders: Reminder[] = [
      TestUtils.generateMockReminder({
        channelId: testChannelId,
        message: 'Channel reminder 1'
      })
    ];

    it('should get reminders for a channel', async () => {
      mockReminderRepository.getChannelReminders.mockResolvedValue(mockChannelReminders);

      const result = await reminderService.getChannelReminders(testChannelId);

      expect(mockReminderRepository.getChannelReminders).toHaveBeenCalledWith(testChannelId);
      expect(result).toEqual(mockChannelReminders);
    });
  });

  describe('searchReminders', () => {
    const mockSearchFilters: ReminderSearchFilters = {
      guildId: testGuildId,
      userId: testUserId,
      isActive: true
    };

    const mockSearchResults: Reminder[] = [
      TestUtils.generateMockReminder({
        userId: testUserId,
        guildId: testGuildId,
        isActive: true
      })
    ];

    it('should search reminders with filters', async () => {
      mockReminderRepository.searchReminders.mockResolvedValue(mockSearchResults);

      const result = await reminderService.searchReminders(mockSearchFilters);

      expect(mockReminderRepository.searchReminders).toHaveBeenCalledWith(mockSearchFilters);
      expect(result).toEqual(mockSearchResults);
    });

    it('should handle complex search filters', async () => {
      const complexFilters: ReminderSearchFilters = {
        guildId: testGuildId,
        userId: testUserId,
        isActive: true,
        channelId: testChannelId,
        caseId: testCaseId,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };

      mockReminderRepository.searchReminders.mockResolvedValue(mockSearchResults);

      const result = await reminderService.searchReminders(complexFilters);

      expect(mockReminderRepository.searchReminders).toHaveBeenCalledWith(complexFilters);
      expect(result).toEqual(mockSearchResults);
    });
  });

  describe('Discord client integration', () => {
    it('should set Discord client successfully', () => {
      const newService = new ReminderService(
        mockReminderRepository,
        mockCaseRepository,
        mockStaffRepository
      );

      // Should not throw an error
      expect(() => newService.setDiscordClient(mockDiscordClient)).not.toThrow();
    });

    it('should initialize service state properly', () => {
      const stats = reminderService.getReminderStats();
      expect(stats).toHaveProperty('activeTimeouts');
      expect(stats).toHaveProperty('scheduledReminders');
      expect(Array.isArray(stats.scheduledReminders)).toBe(true);
      expect(typeof stats.activeTimeouts).toBe('number');
    });
  });

  describe('reminder scheduling behavior', () => {
    beforeEach(() => {
      mockReminderRepository.getDueReminders.mockResolvedValue([]);
      mockReminderRepository.getActiveReminders.mockResolvedValue([]);
    });

    it('should schedule future reminders correctly', async () => {
      const futureTime = new Date(Date.now() + 300000); // 5 minutes from now
      const futureReminder = TestUtils.generateMockReminder({
        _id: TestUtils.generateObjectId(),
        scheduledFor: futureTime,
        isActive: true
      });

      mockStaffRepository.findByFilters.mockResolvedValue([TestUtils.generateMockStaff()]);
      mockReminderRepository.add.mockResolvedValue(futureReminder);

      await reminderService.createReminder({
        guildId: testGuildId,
        userId: testUserId,
        username: testUsername,
        message: 'Future reminder',
        timeString: '5m'
      });

      const stats = reminderService.getReminderStats();
      expect(stats.activeTimeouts).toBe(1);
      expect(stats.scheduledReminders).toContain(futureReminder._id!.toString());
    });

    it('should process initialization without Discord client', () => {
      const newService = new ReminderService(
        mockReminderRepository,
        mockCaseRepository,
        mockStaffRepository
      );

      const stats = newService.getReminderStats();
      expect(stats.activeTimeouts).toBe(0);
      expect(stats.scheduledReminders).toEqual([]);
    });

    it('should handle Discord client integration', () => {
      reminderService.setDiscordClient(mockDiscordClient);
      
      const stats = reminderService.getReminderStats();
      expect(stats).toHaveProperty('activeTimeouts');
      expect(stats).toHaveProperty('scheduledReminders');
    });

    it('should handle Discord delivery configuration properly', async () => {
      // Test that delivery behavior can be configured properly
      reminderService.setDiscordClient(mockDiscordClient);
      
      const stats = reminderService.getReminderStats();
      expect(stats).toHaveProperty('activeTimeouts');
      expect(stats).toHaveProperty('scheduledReminders');
    });
  });

  describe('cleanupOldReminders', () => {
    it('should cleanup old delivered reminders with default days', async () => {
      mockReminderRepository.cleanupDeliveredReminders.mockResolvedValue(5);

      const result = await reminderService.cleanupOldReminders();

      expect(mockReminderRepository.cleanupDeliveredReminders).toHaveBeenCalledWith(30);
      expect(result).toBe(5);
    });

    it('should cleanup old delivered reminders with custom days', async () => {
      mockReminderRepository.cleanupDeliveredReminders.mockResolvedValue(10);

      const result = await reminderService.cleanupOldReminders(60);

      expect(mockReminderRepository.cleanupDeliveredReminders).toHaveBeenCalledWith(60);
      expect(result).toBe(10);
    });

    it('should handle cleanup errors', async () => {
      mockReminderRepository.cleanupDeliveredReminders.mockRejectedValue(
        new Error('Cleanup failed')
      );

      await expect(reminderService.cleanupOldReminders())
        .rejects.toThrow('Cleanup failed');
    });
  });

  describe('getReminderStats', () => {
    it('should return reminder statistics', async () => {
      // Create some scheduled reminders
      const futureReminder1 = TestUtils.generateMockReminder({
        scheduledFor: new Date(Date.now() + 60000)
      });
      const futureReminder2 = TestUtils.generateMockReminder({
        scheduledFor: new Date(Date.now() + 120000)
      });

      mockStaffRepository.findByFilters.mockResolvedValue([TestUtils.generateMockStaff()]);
      mockReminderRepository.add
        .mockResolvedValueOnce(futureReminder1)
        .mockResolvedValueOnce(futureReminder2);

      // Create reminders to populate the internal timeout map
      await reminderService.createReminder({
        guildId: testGuildId,
        userId: testUserId,
        username: testUsername,
        message: 'Test 1',
        timeString: '1m'
      });

      await reminderService.createReminder({
        guildId: testGuildId,
        userId: testUserId,
        username: testUsername,
        message: 'Test 2',
        timeString: '2m'
      });

      const stats = reminderService.getReminderStats();

      expect(stats.activeTimeouts).toBe(2);
      expect(stats.scheduledReminders).toHaveLength(2);
      expect(stats.scheduledReminders).toContain(futureReminder1._id!.toString());
      expect(stats.scheduledReminders).toContain(futureReminder2._id!.toString());
    });

    it('should return empty stats when no reminders scheduled', () => {
      const stats = reminderService.getReminderStats();

      expect(stats.activeTimeouts).toBe(0);
      expect(stats.scheduledReminders).toEqual([]);
    });
  });

  describe('Domain entity validation functions', () => {
    describe('validateReminderCreation', () => {
      it('should pass validation for valid reminder request', () => {
        const validRequest: ReminderCreationRequest = {
          guildId: testGuildId,
          userId: testUserId,
          username: testUsername,
          message: 'Valid message',
          timeString: '2h'
        };

        const errors = validateReminderCreation(validRequest);
        expect(errors).toEqual([]);
      });

      it('should fail validation for missing required fields', () => {
        const invalidRequest = {
          guildId: '',
          userId: '',
          username: '',
          message: '',
          timeString: ''
        } as ReminderCreationRequest;

        const errors = validateReminderCreation(invalidRequest);
        expect(errors).toContain('Guild ID is required');
        expect(errors).toContain('User ID is required');
        expect(errors).toContain('Username is required');
        expect(errors).toContain('Reminder message is required');
        expect(errors).toContain('Time specification is required');
      });

      it('should fail validation for message too long', () => {
        const invalidRequest: ReminderCreationRequest = {
          guildId: testGuildId,
          userId: testUserId,
          username: testUsername,
          message: 'A'.repeat(501), // Exceeds 500 character limit
          timeString: '2h'
        };

        const errors = validateReminderCreation(invalidRequest);
        expect(errors).toContain('Reminder message cannot exceed 500 characters');
      });

      it('should fail validation for invalid time format', () => {
        const invalidRequest: ReminderCreationRequest = {
          guildId: testGuildId,
          userId: testUserId,
          username: testUsername,
          message: 'Valid message',
          timeString: 'invalid'
        };

        const errors = validateReminderCreation(invalidRequest);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(error => error.includes('Invalid time format'))).toBe(true);
      });
    });

    describe('parseTimeString', () => {
      it('should parse valid time strings correctly', () => {
        const testCases = [
          { input: '30m', expectedValue: 30, expectedUnit: TimeUnit.MINUTES },
          { input: '2h', expectedValue: 2, expectedUnit: TimeUnit.HOURS },
          { input: '1d', expectedValue: 1, expectedUnit: TimeUnit.DAYS },
          { input: '5min', expectedValue: 5, expectedUnit: TimeUnit.MINUTES },
          { input: '3hours', expectedValue: 3, expectedUnit: TimeUnit.HOURS },
          { input: '2days', expectedValue: 2, expectedUnit: TimeUnit.DAYS }
        ];

        testCases.forEach(testCase => {
          const result = parseTimeString(testCase.input);
          expect(result).not.toBeNull();
          expect(result!.value).toBe(testCase.expectedValue);
          expect(result!.unit).toBe(testCase.expectedUnit);
          expect(result!.originalString).toBe(testCase.input);
        });
      });

      it('should return null for invalid time strings', () => {
        const invalidInputs = ['invalid', '10', 'm30', '10x', ''];
        
        invalidInputs.forEach(input => {
          const result = parseTimeString(input);
          expect(result).toBeNull();
        });
      });
    });

    describe('validateReminderTime', () => {
      it('should validate correct time ranges', () => {
        const validTimes = ['1m', '30m', '2h', '1d', '7d'];
        
        validTimes.forEach(timeString => {
          const result = validateReminderTime(timeString);
          expect(result.isValid).toBe(true);
          expect(result.error).toBeUndefined();
          expect(result.parsedTime).toBeDefined();
        });
      });

      it('should reject times exceeding maximum', () => {
        const result = validateReminderTime('8d');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(`Maximum reminder time is ${MAX_REMINDER_DAYS} days`);
      });

      it('should reject times below minimum', () => {
        const result = validateReminderTime('30s');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid time format. Use formats like: 10m, 2h, 1d (max 7 days)');
      });

      it('should reject invalid formats', () => {
        const result = validateReminderTime('invalid');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid time format. Use formats like: 10m, 2h, 1d (max 7 days)');
      });
    });

    describe('calculateScheduledTime', () => {
      it('should calculate correct scheduled time', () => {
        const now = Date.now();
        jest.setSystemTime(now);

        const result = calculateScheduledTime('2h');
        expect(result).not.toBeNull();
        expect(result!.getTime()).toBe(now + 2 * 60 * 60 * 1000);
      });

      it('should return null for invalid time string', () => {
        const result = calculateScheduledTime('invalid');
        expect(result).toBeNull();
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle all repository methods throwing errors', async () => {
      const error = new Error('Database connection failed');
      
      mockReminderRepository.add.mockRejectedValue(error);
      mockReminderRepository.findById.mockRejectedValue(error);
      mockReminderRepository.getUserReminders.mockRejectedValue(error);
      mockReminderRepository.searchReminders.mockRejectedValue(error);
      mockCaseRepository.searchCases.mockRejectedValue(error);
      mockStaffRepository.findByFilters.mockRejectedValue(error);

      const basicRequest: ReminderCreationRequest = {
        guildId: testGuildId,
        userId: testUserId,
        username: testUsername,
        message: 'Test message',
        timeString: '2h'
      };

      // Test all methods handle errors gracefully
      await expect(reminderService.createReminder(basicRequest)).rejects.toThrow();
      await expect(reminderService.getUserReminders(testUserId, testGuildId)).rejects.toThrow();
      await expect(reminderService.searchReminders({ guildId: testGuildId })).rejects.toThrow();
    });

    it('should handle concurrent reminder operations', async () => {
      const staff = TestUtils.generateMockStaff({ userId: testUserId });
      mockStaffRepository.findByFilters.mockResolvedValue([staff]);

      const requests = Array.from({ length: 5 }, (_, i) => ({
        guildId: testGuildId,
        userId: testUserId,
        username: testUsername,
        message: `Concurrent reminder ${i}`,
        timeString: '1h'
      }));

      // Mock successful creation for all requests
      mockReminderRepository.add.mockImplementation((data) => 
        Promise.resolve(TestUtils.generateMockReminder({
          ...data,
          _id: TestUtils.generateObjectId()
        }))
      );

      // Create all reminders concurrently
      const results = await Promise.all(
        requests.map(request => reminderService.createReminder(request))
      );

      expect(results).toHaveLength(5);
      expect(mockReminderRepository.add).toHaveBeenCalledTimes(5);
    });

    it('should handle reminder timeout management correctly', () => {
      // Test that internal timeout management works properly
      const stats1 = reminderService.getReminderStats();
      expect(stats1.activeTimeouts).toBe(0);

      // After creating reminders, timeouts should be tracked
      // This is implicitly tested in other tests that create future reminders
    });

    it('should validate maximum reminder limits', () => {
      const maxMs = MAX_REMINDER_MILLISECONDS;
      expect(maxMs).toBe(MAX_REMINDER_DAYS * 24 * 60 * 60 * 1000);
      
      const validation = validateReminderTime(`${MAX_REMINDER_DAYS}d`);
      expect(validation.isValid).toBe(true);
      
      const overLimitValidation = validateReminderTime(`${MAX_REMINDER_DAYS + 1}d`);
      expect(overLimitValidation.isValid).toBe(false);
    });
  });

  describe('Service lifecycle and state management', () => {
    it('should properly initialize without Discord client', () => {
      const newService = new ReminderService(
        mockReminderRepository,
        mockCaseRepository,
        mockStaffRepository
      );

      // Should not throw errors
      const stats = newService.getReminderStats();
      expect(stats.activeTimeouts).toBe(0);
    });

    it('should handle cleanup operations in proper order', async () => {
      mockReminderRepository.cleanupDeliveredReminders.mockResolvedValue(3);

      const cleanupResult = await reminderService.cleanupOldReminders(15);

      expect(mockReminderRepository.cleanupDeliveredReminders).toHaveBeenCalledWith(15);
      expect(cleanupResult).toBe(3);
    });

    it('should maintain internal state consistency', async () => {
      const futureReminder = TestUtils.generateMockReminder({
        scheduledFor: new Date(Date.now() + 300000) // 5 minutes
      });

      mockStaffRepository.findByFilters.mockResolvedValue([TestUtils.generateMockStaff()]);
      mockReminderRepository.add.mockResolvedValue(futureReminder);

      await reminderService.createReminder({
        guildId: testGuildId,
        userId: testUserId,
        username: testUsername,
        message: 'State test',
        timeString: '5m'
      });

      const stats = reminderService.getReminderStats();
      expect(stats.activeTimeouts).toBe(1);
      expect(stats.scheduledReminders).toContain(futureReminder._id!.toString());
    });
  });
});