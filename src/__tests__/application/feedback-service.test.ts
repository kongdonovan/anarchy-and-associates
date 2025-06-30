import { FeedbackService } from '../../application/services/feedback-service';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { 
  Feedback,
  FeedbackSubmission as FeedbackSubmissionRequest,
  FeedbackSearchFilters,
  FeedbackSortOptions
} from '../../validation';
import { 
  FeedbackRating,
  FeedbackPaginationOptions,
  StaffPerformanceMetrics,
  FirmPerformanceMetrics
} from '../../domain/entities/feedback';
import { TestUtils } from '../helpers/test-utils';

/**
 * Unit tests for FeedbackService
 * Tests business logic with mocked repositories to ensure isolation
 */
describe('FeedbackService Unit Tests', () => {
  let feedbackService: FeedbackService;
  let mockFeedbackRepository: jest.Mocked<FeedbackRepository>;
  let mockGuildConfigRepository: jest.Mocked<GuildConfigRepository>;
  let mockStaffRepository: jest.Mocked<StaffRepository>;

  // Test data constants
  const testGuildId = '123456789012345678';
  const testClientId = '234567890123456789';
  const testStaffId = '345678901234567890';
  const testFeedbackId = TestUtils.generateObjectId().toString();

  beforeEach(() => {
    // Create partial mock repositories with only the methods we need
    mockFeedbackRepository = {
      add: jest.fn(),
      findById: jest.fn(),
      searchFeedback: jest.fn(),
      countFeedback: jest.fn(),
      getStaffPerformanceMetrics: jest.fn(),
      getFirmPerformanceMetrics: jest.fn(),
      getRecentFeedback: jest.fn(),
      getFeedbackBySubmitter: jest.fn(),
      getFeedbackByStaff: jest.fn(),
      getFirmWideFeedback: jest.fn()
    } as jest.Mocked<Partial<FeedbackRepository>> as jest.Mocked<FeedbackRepository>;

    mockGuildConfigRepository = {
      findByGuildId: jest.fn()
    } as jest.Mocked<Partial<GuildConfigRepository>> as jest.Mocked<GuildConfigRepository>;

    mockStaffRepository = {
      findByFilters: jest.fn()
    } as jest.Mocked<Partial<StaffRepository>> as jest.Mocked<StaffRepository>;

    feedbackService = new FeedbackService(
      mockFeedbackRepository,
      mockGuildConfigRepository,
      mockStaffRepository
    );

    jest.clearAllMocks();
  });

  describe('submitFeedback', () => {
    const mockFeedbackRequest: FeedbackSubmissionRequest = {
      guildId: testGuildId,
      submitterId: testClientId,
      submitterUsername: 'testclient',
      targetStaffId: testStaffId,
      targetStaffUsername: 'teststaff',
      rating: FeedbackRating.FOUR_STAR,
      comment: 'Great service and very professional!'
    };

    const mockCreatedFeedback: Feedback = TestUtils.generateMockFeedback({
      _id: TestUtils.generateObjectId().toString(),
      guildId: testGuildId,
      submitterId: testClientId,
      submitterUsername: 'testclient',
      targetStaffId: testStaffId,
      targetStaffUsername: 'teststaff',
      rating: FeedbackRating.FOUR_STAR,
      comment: 'Great service and very professional!',
      isForFirm: false,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    it('should submit feedback successfully with all required fields', async () => {
      mockStaffRepository.findByFilters.mockResolvedValueOnce([]); // Submitter is not staff
      mockStaffRepository.findByFilters.mockResolvedValueOnce([TestUtils.generateMockStaff()]); // Target staff exists
      mockFeedbackRepository.add.mockResolvedValue(mockCreatedFeedback);

      const result = await feedbackService.submitFeedback(mockFeedbackRequest);

      expect(mockStaffRepository.findByFilters).toHaveBeenCalledWith({ userId: testClientId });
      expect(mockStaffRepository.findByFilters).toHaveBeenCalledWith({ userId: testStaffId });
      expect(mockFeedbackRepository.add).toHaveBeenCalledWith({
        guildId: testGuildId,
        submitterId: testClientId,
        submitterUsername: 'testclient',
        targetStaffId: testStaffId,
        targetStaffUsername: 'teststaff',
        rating: FeedbackRating.FOUR_STAR,
        comment: 'Great service and very professional!',
        isForFirm: false
      });
      expect(result).toEqual(mockCreatedFeedback);
    });

    it('should submit firm-wide feedback when no target staff specified', async () => {
      const firmFeedbackRequest = {
        guildId: testGuildId,
        submitterId: testClientId,
        submitterUsername: 'testclient',
        rating: FeedbackRating.FIVE_STAR,
        comment: 'Excellent law firm overall!'
      };

      const mockFirmFeedback = TestUtils.generateMockFeedback({
        targetStaffId: undefined,
        targetStaffUsername: undefined,
        isForFirm: true,
        rating: FeedbackRating.FIVE_STAR,
        comment: 'Excellent law firm overall!'
      });

      mockStaffRepository.findByFilters.mockResolvedValue([]); // Submitter is not staff
      mockFeedbackRepository.add.mockResolvedValue(mockFirmFeedback);

      const result = await feedbackService.submitFeedback(firmFeedbackRequest);

      expect(mockFeedbackRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          isForFirm: true,
          targetStaffId: undefined,
          targetStaffUsername: undefined
        })
      );
      expect(result).toEqual(mockFirmFeedback);
    });

    it('should trim comment whitespace before saving', async () => {
      const requestWithWhitespace = {
        ...mockFeedbackRequest,
        comment: '   Great service and very professional!   '
      };

      mockStaffRepository.findByFilters.mockResolvedValueOnce([]);
      mockStaffRepository.findByFilters.mockResolvedValueOnce([TestUtils.generateMockStaff()]);
      mockFeedbackRepository.add.mockResolvedValue(mockCreatedFeedback);

      await feedbackService.submitFeedback(requestWithWhitespace);

      expect(mockFeedbackRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          comment: 'Great service and very professional!'
        })
      );
    });

    it('should throw error when submitter is a staff member', async () => {
      mockStaffRepository.findByFilters.mockResolvedValue([TestUtils.generateMockStaff()]);

      await expect(feedbackService.submitFeedback(mockFeedbackRequest))
        .rejects.toThrow('Staff members cannot submit feedback. Only clients can provide feedback.');

      expect(mockFeedbackRepository.add).not.toHaveBeenCalled();
    });

    it('should throw error when target staff member not found', async () => {
      mockStaffRepository.findByFilters.mockResolvedValueOnce([]); // Submitter is not staff
      mockStaffRepository.findByFilters.mockResolvedValueOnce([]); // Target staff not found

      await expect(feedbackService.submitFeedback(mockFeedbackRequest))
        .rejects.toThrow('Target staff member not found');

      expect(mockFeedbackRepository.add).not.toHaveBeenCalled();
    });

    it('should validate rating is within valid range', async () => {
      const invalidRatingRequest = {
        ...mockFeedbackRequest,
        rating: 6 as FeedbackRating // Invalid rating
      };

      await expect(feedbackService.submitFeedback(invalidRatingRequest))
        .rejects.toThrow('Validation failed: Rating must be between 1 and 5 stars');
    });

    it('should validate required fields are present', async () => {
      const invalidRequest = {
        ...mockFeedbackRequest,
        comment: '' // Empty comment
      };

      await expect(feedbackService.submitFeedback(invalidRequest))
        .rejects.toThrow('Validation failed: Comment is required');
    });

    it('should validate comment length limit', async () => {
      const longCommentRequest = {
        ...mockFeedbackRequest,
        comment: 'A'.repeat(1001) // Exceeds 1000 character limit
      };

      await expect(feedbackService.submitFeedback(longCommentRequest))
        .rejects.toThrow('Validation failed: Comment cannot exceed 1000 characters');
    });

    it('should handle all valid rating values', async () => {
      const validRatings = [
        FeedbackRating.ONE_STAR,
        FeedbackRating.TWO_STAR,
        FeedbackRating.THREE_STAR,
        FeedbackRating.FOUR_STAR,
        FeedbackRating.FIVE_STAR
      ];

      for (const rating of validRatings) {
        const request = { ...mockFeedbackRequest, rating };
        const mockFeedback = TestUtils.generateMockFeedback({ rating });
        
        mockStaffRepository.findByFilters.mockResolvedValueOnce([]); // Submitter is not staff
        mockStaffRepository.findByFilters.mockResolvedValueOnce([TestUtils.generateMockStaff()]); // Target staff exists
        mockFeedbackRepository.add.mockResolvedValue(mockFeedback);

        const result = await feedbackService.submitFeedback(request);

        expect(result.rating).toBe(rating);
        expect(mockFeedbackRepository.add).toHaveBeenCalledWith(
          expect.objectContaining({ rating })
        );

        jest.clearAllMocks();
      }
    });

    it('should throw error when repository add fails', async () => {
      mockStaffRepository.findByFilters.mockResolvedValueOnce([]);
      mockStaffRepository.findByFilters.mockResolvedValueOnce([TestUtils.generateMockStaff()]);
      mockFeedbackRepository.add.mockRejectedValue(new Error('Database error'));

      await expect(feedbackService.submitFeedback(mockFeedbackRequest))
        .rejects.toThrow('Database error');
    });

    it('should handle target staff username validation when staff ID provided', async () => {
      const requestWithoutUsername = {
        ...mockFeedbackRequest,
        targetStaffUsername: undefined
      };

      await expect(feedbackService.submitFeedback(requestWithoutUsername))
        .rejects.toThrow('Validation failed: Target staff username is required when staff ID is provided');
    });
  });

  describe('searchFeedback', () => {
    const mockSearchResults = [
      TestUtils.generateMockFeedback({
        guildId: testGuildId,
        rating: FeedbackRating.FIVE_STAR
      }),
      TestUtils.generateMockFeedback({
        guildId: testGuildId,
        rating: FeedbackRating.FOUR_STAR
      })
    ];

    it('should search feedback with filters only', async () => {
      const filters: FeedbackSearchFilters = { 
        guildId: testGuildId,
        rating: FeedbackRating.FIVE_STAR
      };

      mockFeedbackRepository.searchFeedback.mockResolvedValue(mockSearchResults);
      mockFeedbackRepository.countFeedback.mockResolvedValue(2);

      const result = await feedbackService.searchFeedback(filters);

      expect(mockFeedbackRepository.searchFeedback).toHaveBeenCalledWith(filters, undefined, undefined);
      expect(mockFeedbackRepository.countFeedback).toHaveBeenCalledWith(filters);
      expect(result).toEqual({
        feedback: mockSearchResults,
        total: 2
      });
    });

    it('should search feedback with sort options', async () => {
      const filters: FeedbackSearchFilters = { guildId: testGuildId };
      const sort: FeedbackSortOptions = { field: 'rating', direction: 'desc' };

      mockFeedbackRepository.searchFeedback.mockResolvedValue(mockSearchResults);
      mockFeedbackRepository.countFeedback.mockResolvedValue(2);

      const result = await feedbackService.searchFeedback(filters, sort);

      expect(mockFeedbackRepository.searchFeedback).toHaveBeenCalledWith(filters, sort, undefined);
      expect(result.feedback).toEqual(mockSearchResults);
    });

    it('should search feedback with pagination', async () => {
      const filters: FeedbackSearchFilters = { guildId: testGuildId };
      const pagination: FeedbackPaginationOptions = { page: 1, limit: 10 };

      mockFeedbackRepository.searchFeedback.mockResolvedValue(mockSearchResults);
      mockFeedbackRepository.countFeedback.mockResolvedValue(25);

      const result = await feedbackService.searchFeedback(filters, undefined, pagination);

      expect(mockFeedbackRepository.searchFeedback).toHaveBeenCalledWith(filters, undefined, pagination);
      expect(result).toEqual({
        feedback: mockSearchResults,
        total: 25,
        page: 1,
        totalPages: 3
      });
    });

    it('should calculate correct total pages for pagination', async () => {
      const filters: FeedbackSearchFilters = { guildId: testGuildId };
      const pagination: FeedbackPaginationOptions = { page: 2, limit: 5 };

      mockFeedbackRepository.searchFeedback.mockResolvedValue(mockSearchResults);
      mockFeedbackRepository.countFeedback.mockResolvedValue(12);

      const result = await feedbackService.searchFeedback(filters, undefined, pagination);

      expect(result.totalPages).toBe(3); // Math.ceil(12/5) = 3
    });

    it('should handle empty search results', async () => {
      const filters: FeedbackSearchFilters = { guildId: 'non-existent' };

      mockFeedbackRepository.searchFeedback.mockResolvedValue([]);
      mockFeedbackRepository.countFeedback.mockResolvedValue(0);

      const result = await feedbackService.searchFeedback(filters);

      expect(result).toEqual({
        feedback: [],
        total: 0
      });
    });

    it('should search by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const filters: FeedbackSearchFilters = { 
        guildId: testGuildId,
        startDate,
        endDate
      };

      mockFeedbackRepository.searchFeedback.mockResolvedValue(mockSearchResults);
      mockFeedbackRepository.countFeedback.mockResolvedValue(2);

      await feedbackService.searchFeedback(filters);

      expect(mockFeedbackRepository.searchFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate,
          endDate
        }),
        undefined,
        undefined
      );
    });

    it('should search by rating range', async () => {
      const filters: FeedbackSearchFilters = { 
        guildId: testGuildId,
        minRating: 3,
        maxRating: 5
      };

      mockFeedbackRepository.searchFeedback.mockResolvedValue(mockSearchResults);
      mockFeedbackRepository.countFeedback.mockResolvedValue(2);

      await feedbackService.searchFeedback(filters);

      expect(mockFeedbackRepository.searchFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          minRating: 3,
          maxRating: 5
        }),
        undefined,
        undefined
      );
    });
  });

  describe('getStaffPerformanceMetrics', () => {
    const mockStaffMetrics: StaffPerformanceMetrics = {
      staffId: testStaffId,
      staffUsername: 'teststaff',
      totalFeedback: 10,
      averageRating: 4.2,
      ratingDistribution: {
        [FeedbackRating.ONE_STAR]: 0,
        [FeedbackRating.TWO_STAR]: 1,
        [FeedbackRating.THREE_STAR]: 2,
        [FeedbackRating.FOUR_STAR]: 4,
        [FeedbackRating.FIVE_STAR]: 3
      },
      recentFeedback: [TestUtils.generateMockFeedback() as any]
    };

    it('should get staff performance metrics successfully', async () => {
      mockFeedbackRepository.getStaffPerformanceMetrics.mockResolvedValue(mockStaffMetrics);

      const result = await feedbackService.getStaffPerformanceMetrics(testStaffId, testGuildId);

      expect(mockFeedbackRepository.getStaffPerformanceMetrics).toHaveBeenCalledWith(testStaffId, testGuildId);
      expect(result).toEqual(mockStaffMetrics);
    });

    it('should return null when staff has no feedback', async () => {
      mockFeedbackRepository.getStaffPerformanceMetrics.mockResolvedValue(null);

      const result = await feedbackService.getStaffPerformanceMetrics('no-feedback-staff', testGuildId);

      expect(result).toBeNull();
    });

    it('should handle repository errors', async () => {
      mockFeedbackRepository.getStaffPerformanceMetrics.mockRejectedValue(
        new Error('Database connection error')
      );

      await expect(feedbackService.getStaffPerformanceMetrics(testStaffId, testGuildId))
        .rejects.toThrow('Database connection error');
    });
  });

  describe('getFirmPerformanceMetrics', () => {
    const mockFirmMetrics: FirmPerformanceMetrics = {
      guildId: testGuildId,
      totalFeedback: 25,
      averageRating: 4.1,
      staffMetrics: [
        {
          staffId: testStaffId,
          staffUsername: 'teststaff',
          totalFeedback: 10,
          averageRating: 4.2,
          ratingDistribution: {
            [FeedbackRating.ONE_STAR]: 0,
            [FeedbackRating.TWO_STAR]: 1,
            [FeedbackRating.THREE_STAR]: 2,
            [FeedbackRating.FOUR_STAR]: 4,
            [FeedbackRating.FIVE_STAR]: 3
          },
          recentFeedback: []
        }
      ],
      firmWideFeedback: [TestUtils.generateMockFeedback({ isForFirm: true }) as any],
      ratingDistribution: {
        [FeedbackRating.ONE_STAR]: 1,
        [FeedbackRating.TWO_STAR]: 2,
        [FeedbackRating.THREE_STAR]: 7,
        [FeedbackRating.FOUR_STAR]: 10,
        [FeedbackRating.FIVE_STAR]: 5
      }
    };

    it('should get firm performance metrics successfully', async () => {
      mockFeedbackRepository.getFirmPerformanceMetrics.mockResolvedValue(mockFirmMetrics);

      const result = await feedbackService.getFirmPerformanceMetrics(testGuildId);

      expect(mockFeedbackRepository.getFirmPerformanceMetrics).toHaveBeenCalledWith(testGuildId);
      expect(result).toEqual(mockFirmMetrics);
    });

    it('should handle empty firm metrics', async () => {
      const emptyMetrics: FirmPerformanceMetrics = {
        guildId: testGuildId,
        totalFeedback: 0,
        averageRating: 0,
        staffMetrics: [],
        firmWideFeedback: [],
        ratingDistribution: {
          [FeedbackRating.ONE_STAR]: 0,
          [FeedbackRating.TWO_STAR]: 0,
          [FeedbackRating.THREE_STAR]: 0,
          [FeedbackRating.FOUR_STAR]: 0,
          [FeedbackRating.FIVE_STAR]: 0
        }
      };

      mockFeedbackRepository.getFirmPerformanceMetrics.mockResolvedValue(emptyMetrics);

      const result = await feedbackService.getFirmPerformanceMetrics(testGuildId);

      expect(result.totalFeedback).toBe(0);
      expect(result.averageRating).toBe(0);
    });
  });

  describe('getFeedbackStats', () => {
    const mockFirmMetrics: FirmPerformanceMetrics = {
      guildId: testGuildId,
      totalFeedback: 25,
      averageRating: 4.1,
      staffMetrics: [
        {
          staffId: testStaffId,
          staffUsername: 'teststaff',
          totalFeedback: 10,
          averageRating: 4.8,
          ratingDistribution: {
            [FeedbackRating.ONE_STAR]: 0,
            [FeedbackRating.TWO_STAR]: 0,
            [FeedbackRating.THREE_STAR]: 1,
            [FeedbackRating.FOUR_STAR]: 3,
            [FeedbackRating.FIVE_STAR]: 6
          },
          recentFeedback: []
        },
        {
          staffId: 'staff-2',
          staffUsername: 'staff2',
          totalFeedback: 5,
          averageRating: 4.2,
          ratingDistribution: {
            [FeedbackRating.ONE_STAR]: 0,
            [FeedbackRating.TWO_STAR]: 0,
            [FeedbackRating.THREE_STAR]: 1,
            [FeedbackRating.FOUR_STAR]: 3,
            [FeedbackRating.FIVE_STAR]: 1
          },
          recentFeedback: []
        },
        {
          staffId: 'staff-3',
          staffUsername: 'staff3',
          totalFeedback: 2, // Below minimum of 3
          averageRating: 5.0,
          ratingDistribution: {
            [FeedbackRating.ONE_STAR]: 0,
            [FeedbackRating.TWO_STAR]: 0,
            [FeedbackRating.THREE_STAR]: 0,
            [FeedbackRating.FOUR_STAR]: 0,
            [FeedbackRating.FIVE_STAR]: 2
          },
          recentFeedback: []
        }
      ],
      firmWideFeedback: [],
      ratingDistribution: {
        [FeedbackRating.ONE_STAR]: 1,
        [FeedbackRating.TWO_STAR]: 2,
        [FeedbackRating.THREE_STAR]: 7,
        [FeedbackRating.FOUR_STAR]: 10,
        [FeedbackRating.FIVE_STAR]: 5
      }
    };

    const mockRecentFeedback = [
      TestUtils.generateMockFeedback({ rating: FeedbackRating.FIVE_STAR }),
      TestUtils.generateMockFeedback({ rating: FeedbackRating.FOUR_STAR })
    ];

    it('should get comprehensive feedback stats', async () => {
      mockFeedbackRepository.getFirmPerformanceMetrics.mockResolvedValue(mockFirmMetrics);
      mockFeedbackRepository.getRecentFeedback.mockResolvedValue(mockRecentFeedback);

      const result = await feedbackService.getFeedbackStats(testGuildId);

      expect(result).toEqual({
        totalFeedback: 25,
        averageRating: 4.1,
        ratingDistribution: mockFirmMetrics.ratingDistribution,
        topRatedStaff: [
          {
            staffId: testStaffId,
            staffUsername: 'teststaff',
            averageRating: 4.8,
            totalFeedback: 10
          },
          {
            staffId: 'staff-2',
            staffUsername: 'staff2',
            averageRating: 4.2,
            totalFeedback: 5
          }
        ],
        recentFeedback: mockRecentFeedback
      });

      expect(mockFeedbackRepository.getRecentFeedback).toHaveBeenCalledWith(testGuildId, 5);
    });

    it('should filter top rated staff by minimum feedback count', async () => {
      mockFeedbackRepository.getFirmPerformanceMetrics.mockResolvedValue(mockFirmMetrics);
      mockFeedbackRepository.getRecentFeedback.mockResolvedValue([]);

      const result = await feedbackService.getFeedbackStats(testGuildId);

      // staff-3 should be excluded because it has only 2 feedback entries (< 3 minimum)
      expect(result.topRatedStaff).toHaveLength(2);
      expect(result.topRatedStaff.map(s => s.staffId)).not.toContain('staff-3');
    });

    it('should sort top rated staff by average rating descending', async () => {
      mockFeedbackRepository.getFirmPerformanceMetrics.mockResolvedValue(mockFirmMetrics);
      mockFeedbackRepository.getRecentFeedback.mockResolvedValue([]);

      const result = await feedbackService.getFeedbackStats(testGuildId);

      expect(result.topRatedStaff).toHaveLength(2);
      expect(result.topRatedStaff[0]?.averageRating).toBeGreaterThanOrEqual(
        result.topRatedStaff[1]?.averageRating || 0
      );
    });

    it('should limit top rated staff to 5 entries', async () => {
      const metricsWithManyStaff: FirmPerformanceMetrics = {
        ...mockFirmMetrics,
        staffMetrics: Array.from({ length: 10 }, (_, i) => ({
          staffId: `staff-${i}`,
          staffUsername: `staff${i}`,
          totalFeedback: 5,
          averageRating: 4.0 + (i * 0.1),
          ratingDistribution: {
            [FeedbackRating.ONE_STAR]: 0,
            [FeedbackRating.TWO_STAR]: 0,
            [FeedbackRating.THREE_STAR]: 1,
            [FeedbackRating.FOUR_STAR]: 3,
            [FeedbackRating.FIVE_STAR]: 1
          },
          recentFeedback: []
        }))
      };

      mockFeedbackRepository.getFirmPerformanceMetrics.mockResolvedValue(metricsWithManyStaff);
      mockFeedbackRepository.getRecentFeedback.mockResolvedValue([]);

      const result = await feedbackService.getFeedbackStats(testGuildId);

      expect(result.topRatedStaff).toHaveLength(5);
    });
  });

  describe('getFeedbackById', () => {
    const mockFeedback = TestUtils.generateMockFeedback({
      _id: TestUtils.generateObjectId().toString(),
      guildId: testGuildId,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    it('should get feedback by ID successfully', async () => {
      mockFeedbackRepository.findById.mockResolvedValue(mockFeedback);

      const result = await feedbackService.getFeedbackById(testFeedbackId);

      expect(mockFeedbackRepository.findById).toHaveBeenCalledWith(testFeedbackId);
      expect(result).toEqual(mockFeedback);
    });

    it('should return null when feedback not found', async () => {
      mockFeedbackRepository.findById.mockResolvedValue(null);

      const result = await feedbackService.getFeedbackById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle invalid feedback ID format', async () => {
      mockFeedbackRepository.findById.mockRejectedValue(
        new Error('Invalid ObjectId format')
      );

      await expect(feedbackService.getFeedbackById('invalid-id'))
        .rejects.toThrow('Invalid ObjectId format');
    });
  });

  describe('getFeedbackBySubmitter', () => {
    const mockSubmitterFeedback = [
      TestUtils.generateMockFeedback({ submitterId: testClientId }),
      TestUtils.generateMockFeedback({ submitterId: testClientId })
    ];

    it('should get feedback by submitter successfully', async () => {
      mockFeedbackRepository.getFeedbackBySubmitter.mockResolvedValue(mockSubmitterFeedback);

      const result = await feedbackService.getFeedbackBySubmitter(testClientId);

      expect(mockFeedbackRepository.getFeedbackBySubmitter).toHaveBeenCalledWith(testClientId);
      expect(result).toEqual(mockSubmitterFeedback);
    });

    it('should return empty array when submitter has no feedback', async () => {
      mockFeedbackRepository.getFeedbackBySubmitter.mockResolvedValue([]);

      const result = await feedbackService.getFeedbackBySubmitter('no-feedback-user');

      expect(result).toEqual([]);
    });
  });

  describe('getFeedbackByStaff', () => {
    const mockStaffFeedback = [
      TestUtils.generateMockFeedback({ targetStaffId: testStaffId }),
      TestUtils.generateMockFeedback({ targetStaffId: testStaffId })
    ];

    it('should get feedback by staff successfully', async () => {
      mockFeedbackRepository.getFeedbackByStaff.mockResolvedValue(mockStaffFeedback);

      const result = await feedbackService.getFeedbackByStaff(testStaffId);

      expect(mockFeedbackRepository.getFeedbackByStaff).toHaveBeenCalledWith(testStaffId);
      expect(result).toEqual(mockStaffFeedback);
    });

    it('should return empty array when staff has no feedback', async () => {
      mockFeedbackRepository.getFeedbackByStaff.mockResolvedValue([]);

      const result = await feedbackService.getFeedbackByStaff('no-feedback-staff');

      expect(result).toEqual([]);
    });
  });

  describe('getFirmWideFeedback', () => {
    const mockFirmFeedback = [
      TestUtils.generateMockFeedback({ isForFirm: true }),
      TestUtils.generateMockFeedback({ isForFirm: true })
    ];

    it('should get firm-wide feedback successfully', async () => {
      mockFeedbackRepository.getFirmWideFeedback.mockResolvedValue(mockFirmFeedback);

      const result = await feedbackService.getFirmWideFeedback(testGuildId);

      expect(mockFeedbackRepository.getFirmWideFeedback).toHaveBeenCalledWith(testGuildId);
      expect(result).toEqual(mockFirmFeedback);
    });

    it('should return empty array when no firm-wide feedback exists', async () => {
      mockFeedbackRepository.getFirmWideFeedback.mockResolvedValue([]);

      const result = await feedbackService.getFirmWideFeedback(testGuildId);

      expect(result).toEqual([]);
    });
  });

  describe('getFeedbackChannelId', () => {
    const mockGuildConfig = {
      guildId: testGuildId,
      feedbackChannelId: 'feedback-channel-123'
    };

    it('should get feedback channel ID when config exists', async () => {
      mockGuildConfigRepository.findByGuildId.mockResolvedValue(mockGuildConfig as any);

      const result = await feedbackService.getFeedbackChannelId(testGuildId);

      expect(mockGuildConfigRepository.findByGuildId).toHaveBeenCalledWith(testGuildId);
      expect(result).toBe('feedback-channel-123');
    });

    it('should return null when config not found', async () => {
      mockGuildConfigRepository.findByGuildId.mockResolvedValue(null);

      const result = await feedbackService.getFeedbackChannelId(testGuildId);

      expect(result).toBeNull();
    });

    it('should return null when feedback channel not configured', async () => {
      mockGuildConfigRepository.findByGuildId.mockResolvedValue({
        guildId: testGuildId,
        feedbackChannelId: undefined
      } as any);

      const result = await feedbackService.getFeedbackChannelId(testGuildId);

      expect(result).toBeNull();
    });
  });

  describe('getRecentFeedback', () => {
    const mockRecentFeedback = [
      TestUtils.generateMockFeedback({ guildId: testGuildId }),
      TestUtils.generateMockFeedback({ guildId: testGuildId })
    ];

    it('should get recent feedback with default limit', async () => {
      mockFeedbackRepository.getRecentFeedback.mockResolvedValue(mockRecentFeedback);

      const result = await feedbackService.getRecentFeedback(testGuildId);

      expect(mockFeedbackRepository.getRecentFeedback).toHaveBeenCalledWith(testGuildId, 10);
      expect(result).toEqual(mockRecentFeedback);
    });

    it('should get recent feedback with custom limit', async () => {
      mockFeedbackRepository.getRecentFeedback.mockResolvedValue(mockRecentFeedback);

      const result = await feedbackService.getRecentFeedback(testGuildId, 5);

      expect(mockFeedbackRepository.getRecentFeedback).toHaveBeenCalledWith(testGuildId, 5);
      expect(result).toEqual(mockRecentFeedback);
    });

    it('should return empty array when no recent feedback exists', async () => {
      mockFeedbackRepository.getRecentFeedback.mockResolvedValue([]);

      const result = await feedbackService.getRecentFeedback(testGuildId);

      expect(result).toEqual([]);
    });
  });

  describe('calculateRatingTrend', () => {
    const currentPeriodFeedback = [
      TestUtils.generateMockFeedback({ rating: FeedbackRating.FIVE_STAR }),
      TestUtils.generateMockFeedback({ rating: FeedbackRating.FOUR_STAR }),
      TestUtils.generateMockFeedback({ rating: FeedbackRating.FIVE_STAR })
    ];

    const previousPeriodFeedback = [
      TestUtils.generateMockFeedback({ rating: FeedbackRating.THREE_STAR }),
      TestUtils.generateMockFeedback({ rating: FeedbackRating.FOUR_STAR })
    ];

    it('should calculate improving trend', async () => {
      mockFeedbackRepository.searchFeedback
        .mockResolvedValueOnce(currentPeriodFeedback) // Current period: avg 4.67
        .mockResolvedValueOnce(previousPeriodFeedback); // Previous period: avg 3.5

      const result = await feedbackService.calculateRatingTrend(testStaffId, testGuildId, 30);

      expect(result.currentPeriodAverage).toBe(4.67);
      expect(result.previousPeriodAverage).toBe(3.5);
      expect(result.trend).toBe('improving');
      expect(result.changePercentage).toBeGreaterThan(0);
    });

    it('should calculate declining trend', async () => {
      mockFeedbackRepository.searchFeedback
        .mockResolvedValueOnce(previousPeriodFeedback) // Current period: avg 3.5
        .mockResolvedValueOnce(currentPeriodFeedback); // Previous period: avg 4.67

      const result = await feedbackService.calculateRatingTrend(testStaffId, testGuildId, 30);

      expect(result.trend).toBe('declining');
      expect(result.changePercentage).toBeLessThan(0);
    });

    it('should calculate stable trend for small changes', async () => {
      const stableFeedback = [
        TestUtils.generateMockFeedback({ rating: FeedbackRating.FOUR_STAR }),
        TestUtils.generateMockFeedback({ rating: FeedbackRating.FOUR_STAR })
      ];

      mockFeedbackRepository.searchFeedback
        .mockResolvedValueOnce(stableFeedback) // Current: avg 4.0
        .mockResolvedValueOnce([TestUtils.generateMockFeedback({ rating: FeedbackRating.FOUR_STAR })]); // Previous: avg 4.0

      const result = await feedbackService.calculateRatingTrend(testStaffId, testGuildId, 30);

      expect(result.trend).toBe('stable');
      expect(Math.abs(result.changePercentage)).toBeLessThan(5);
    });

    it('should handle no feedback in current period', async () => {
      mockFeedbackRepository.searchFeedback
        .mockResolvedValueOnce([]) // No current feedback
        .mockResolvedValueOnce(previousPeriodFeedback);

      const result = await feedbackService.calculateRatingTrend(testStaffId, testGuildId, 30);

      expect(result.currentPeriodAverage).toBe(0);
      expect(result.previousPeriodAverage).toBe(3.5);
      expect(result.trend).toBe('declining'); // 0 vs 3.5 is a decline of -100%
      expect(result.changePercentage).toBe(-100);
    });

    it('should handle no feedback in previous period', async () => {
      mockFeedbackRepository.searchFeedback
        .mockResolvedValueOnce(currentPeriodFeedback)
        .mockResolvedValueOnce([]); // No previous feedback

      const result = await feedbackService.calculateRatingTrend(testStaffId, testGuildId, 30);

      expect(result.currentPeriodAverage).toBe(4.67);
      expect(result.previousPeriodAverage).toBe(0);
      expect(result.trend).toBe('stable'); // No baseline for comparison
      expect(result.changePercentage).toBe(0);
    });

    it('should use custom time period', async () => {
      mockFeedbackRepository.searchFeedback
        .mockResolvedValueOnce(currentPeriodFeedback)
        .mockResolvedValueOnce(previousPeriodFeedback);

      await feedbackService.calculateRatingTrend(testStaffId, testGuildId, 60);

      // Verify the date ranges are calculated for 60-day periods
      expect(mockFeedbackRepository.searchFeedback).toHaveBeenCalledTimes(2);
      
      const currentPeriodCall = mockFeedbackRepository.searchFeedback.mock.calls[0]?.[0];
      const previousPeriodCall = mockFeedbackRepository.searchFeedback.mock.calls[1]?.[0];
      
      expect(currentPeriodCall?.guildId).toBe(testGuildId);
      expect(currentPeriodCall?.targetStaffId).toBe(testStaffId);
      expect(previousPeriodCall?.guildId).toBe(testGuildId);
      expect(previousPeriodCall?.targetStaffId).toBe(testStaffId);
    });

    it('should round averages and percentages correctly', async () => {
      const currentFeedback = [
        TestUtils.generateMockFeedback({ rating: FeedbackRating.FIVE_STAR }),
        TestUtils.generateMockFeedback({ rating: FeedbackRating.FOUR_STAR }),
        TestUtils.generateMockFeedback({ rating: FeedbackRating.FOUR_STAR })
      ]; // Average: 4.33

      const previousFeedback = [
        TestUtils.generateMockFeedback({ rating: FeedbackRating.FOUR_STAR }),
        TestUtils.generateMockFeedback({ rating: FeedbackRating.THREE_STAR }),
        TestUtils.generateMockFeedback({ rating: FeedbackRating.THREE_STAR })
      ]; // Average: 3.33

      mockFeedbackRepository.searchFeedback
        .mockResolvedValueOnce(currentFeedback)
        .mockResolvedValueOnce(previousFeedback);

      const result = await feedbackService.calculateRatingTrend(testStaffId, testGuildId, 30);

      expect(result.currentPeriodAverage).toBe(4.33);
      expect(result.previousPeriodAverage).toBe(3.33);
      expect(typeof result.changePercentage).toBe('number');
      // Change percentage: ((4.33 - 3.33) / 3.33) * 100 = 30.03% → rounded to 30.00
      expect(result.changePercentage).toBe(30);
      expect(result.trend).toBe('improving');
    });
  });

  describe('Error Handling', () => {
    it('should handle repository connection failures', async () => {
      mockFeedbackRepository.findById.mockRejectedValue(
        new Error('Database connection lost')
      );

      await expect(feedbackService.getFeedbackById(testFeedbackId))
        .rejects.toThrow('Database connection lost');
    });

    it('should handle staff repository failures during validation', async () => {
      mockStaffRepository.findByFilters.mockRejectedValue(
        new Error('Staff service unavailable')
      );

      const mockRequest: FeedbackSubmissionRequest = {
        guildId: testGuildId,
        submitterId: testClientId,
        submitterUsername: 'testclient',
        rating: FeedbackRating.FOUR_STAR,
        comment: 'Test feedback'
      };

      await expect(feedbackService.submitFeedback(mockRequest))
        .rejects.toThrow('Staff service unavailable');
    });

    it('should handle malformed feedback data', async () => {
      const invalidRequest = {
        guildId: '',
        submitterId: '',
        submitterUsername: '',
        rating: 0 as unknown as FeedbackRating,
        comment: ''
      } as FeedbackSubmissionRequest;

      await expect(feedbackService.submitFeedback(invalidRequest))
        .rejects.toThrow('Validation failed');
    });

    it('should handle concurrent feedback submission attempts', async () => {
      const request: FeedbackSubmissionRequest = {
        guildId: testGuildId,
        submitterId: testClientId,
        submitterUsername: 'testclient',
        rating: FeedbackRating.FOUR_STAR,
        comment: 'Test feedback'
      };

      mockStaffRepository.findByFilters.mockResolvedValue([]);
      mockFeedbackRepository.add.mockRejectedValue(
        new Error('Duplicate feedback submission detected')
      );

      await expect(feedbackService.submitFeedback(request))
        .rejects.toThrow('Duplicate feedback submission detected');
    });

    it('should handle search filter validation errors', async () => {
      mockFeedbackRepository.searchFeedback.mockRejectedValue(
        new Error('Invalid search criteria')
      );

      const invalidFilters = { 
        guildId: '',
        minRating: 6,
        maxRating: 0
      } as FeedbackSearchFilters;

      await expect(feedbackService.searchFeedback(invalidFilters))
        .rejects.toThrow('Invalid search criteria');
    });

    it('should handle performance metrics calculation errors', async () => {
      mockFeedbackRepository.getFirmPerformanceMetrics.mockRejectedValue(
        new Error('Metrics calculation failed')
      );

      await expect(feedbackService.getFeedbackStats(testGuildId))
        .rejects.toThrow('Metrics calculation failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long feedback comments', async () => {
      const maxLengthComment = 'A'.repeat(1000);
      const request: FeedbackSubmissionRequest = {
        guildId: testGuildId,
        submitterId: testClientId,
        submitterUsername: 'testclient',
        rating: FeedbackRating.FOUR_STAR,
        comment: maxLengthComment
      };

      mockStaffRepository.findByFilters.mockResolvedValueOnce([]).mockResolvedValueOnce([TestUtils.generateMockStaff()]);
      mockFeedbackRepository.add.mockResolvedValue(TestUtils.generateMockFeedback({ comment: maxLengthComment }));

      const result = await feedbackService.submitFeedback(request);

      expect(result.comment).toBe(maxLengthComment);
    });

    it('should handle special characters in usernames', async () => {
      const request: FeedbackSubmissionRequest = {
        guildId: testGuildId,
        submitterId: testClientId,
        submitterUsername: 'test-client_123!@#',
        targetStaffId: testStaffId,
        targetStaffUsername: 'test-staff_456$%^',
        rating: FeedbackRating.FOUR_STAR,
        comment: 'Special characters test'
      };

      mockStaffRepository.findByFilters.mockResolvedValueOnce([]).mockResolvedValueOnce([TestUtils.generateMockStaff()]);
      mockFeedbackRepository.add.mockResolvedValue(TestUtils.generateMockFeedback({
        submitterUsername: 'test-client_123!@#',
        targetStaffUsername: 'test-staff_456$%^'
      }));

      const result = await feedbackService.submitFeedback(request);

      expect(result.submitterUsername).toBe('test-client_123!@#');
      expect(result.targetStaffUsername).toBe('test-staff_456$%^');
    });

    it('should handle empty search results with pagination', async () => {
      const filters: FeedbackSearchFilters = { guildId: 'empty-guild' };
      const pagination: FeedbackPaginationOptions = { page: 1, limit: 10 };

      mockFeedbackRepository.searchFeedback.mockResolvedValue([]);
      mockFeedbackRepository.countFeedback.mockResolvedValue(0);

      const result = await feedbackService.searchFeedback(filters, undefined, pagination);

      expect(result).toEqual({
        feedback: [],
        total: 0,
        page: 1,
        totalPages: 0
      });
    });

    it('should handle zero rating averages in trend calculation', async () => {
      mockFeedbackRepository.searchFeedback
        .mockResolvedValueOnce([]) // No current feedback
        .mockResolvedValueOnce([]); // No previous feedback

      const result = await feedbackService.calculateRatingTrend(testStaffId, testGuildId, 30);

      expect(result.currentPeriodAverage).toBe(0);
      expect(result.previousPeriodAverage).toBe(0);
      expect(result.trend).toBe('stable');
      expect(result.changePercentage).toBe(0);
    });
  });
});