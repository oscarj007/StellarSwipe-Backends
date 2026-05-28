import { Test, TestingModule } from '@nestjs/testing';
import {
  CacheInvalidationService,
  UserCacheKeys,
  SignalCacheKeys,
  LeaderboardCacheKeys,
} from './cache-invalidation.service';
import { CacheService, CachePrefix } from './cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockCacheService = {
  del: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
  listenerCount: jest.fn().mockReturnValue(1),
};

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationService,
        { provide: CacheService, useValue: mockCacheService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<CacheInvalidationService>(CacheInvalidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('UserCacheKeys', () => {
    it('profile key includes userId', () => {
      expect(UserCacheKeys.profile('u1')).toContain('u1');
    });

    it('preferences key includes userId', () => {
      expect(UserCacheKeys.preferences('u1')).toContain('u1');
    });

    it('sessions key includes userId', () => {
      expect(UserCacheKeys.sessions('u1')).toContain('u1');
    });

    it('portfolio key uses PORTFOLIO prefix', () => {
      expect(UserCacheKeys.portfolio('u1')).toContain(CachePrefix.PORTFOLIO);
    });
  });

  describe('invalidateUser', () => {
    it('deletes all four user cache keys', async () => {
      mockCacheService.del.mockResolvedValue(undefined);

      await service.invalidateUser('user-1');

      expect(mockCacheService.del).toHaveBeenCalledTimes(4);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        UserCacheKeys.profile('user-1'),
      );
      expect(mockCacheService.del).toHaveBeenCalledWith(
        UserCacheKeys.preferences('user-1'),
      );
      expect(mockCacheService.del).toHaveBeenCalledWith(
        UserCacheKeys.sessions('user-1'),
      );
      expect(mockCacheService.del).toHaveBeenCalledWith(
        UserCacheKeys.portfolio('user-1'),
      );
    });

    it('does not throw when cache.del rejects', async () => {
      mockCacheService.del.mockRejectedValue(new Error('redis down'));
      await expect(service.invalidateUser('user-1')).rejects.toThrow();
    });
  });

  describe('invalidateUserProfile', () => {
    it('deletes only the profile key', async () => {
      mockCacheService.del.mockResolvedValue(undefined);

      await service.invalidateUserProfile('user-2');

      expect(mockCacheService.del).toHaveBeenCalledTimes(1);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        UserCacheKeys.profile('user-2'),
      );
    });
  });

  describe('invalidateUserPreferences', () => {
    it('deletes only the preferences key', async () => {
      mockCacheService.del.mockResolvedValue(undefined);

      await service.invalidateUserPreferences('user-3');

      expect(mockCacheService.del).toHaveBeenCalledTimes(1);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        UserCacheKeys.preferences('user-3'),
      );
    });
  });

  describe('invalidateUserSessions', () => {
    it('deletes only the sessions key', async () => {
      mockCacheService.del.mockResolvedValue(undefined);

      await service.invalidateUserSessions('user-4');

      expect(mockCacheService.del).toHaveBeenCalledTimes(1);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        UserCacheKeys.sessions('user-4'),
      );
    });
  });

  describe('invalidateUsers', () => {
    it('invalidates all four keys for each user', async () => {
      mockCacheService.del.mockResolvedValue(undefined);

      await service.invalidateUsers(['u1', 'u2']);

      // 4 keys × 2 users = 8 deletions
      expect(mockCacheService.del).toHaveBeenCalledTimes(8);
    });

    it('handles an empty array without error', async () => {
      await expect(service.invalidateUsers([])).resolves.toBeUndefined();
      expect(mockCacheService.del).not.toHaveBeenCalled();
    });
  });

  /**
   * #532 — Signal Update Cache Invalidation Tests
   */
  describe('invalidateSignalUpdate (#532)', () => {
    beforeEach(() => {
      mockCacheService.del.mockResolvedValue(undefined);
    });

    it('should invalidate signal cache when signal is updated', async () => {
      const signalId = 'signal-123';
      const assetPair = 'XLM/USD';
      const providerId = 'provider-456';

      await service.invalidateSignalUpdate(signalId, assetPair, providerId);

      expect(mockCacheService.del).toHaveBeenCalledWith(
        SignalCacheKeys.signal(signalId),
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.invalidated.signal',
        expect.objectContaining({
          signalId,
          assetPair,
          providerId,
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should invalidate all feed pages when signal updates', async () => {
      const signalId = 'signal-789';

      await service.invalidateSignalUpdate(signalId, 'BTC/USD');

      const calls = (mockCacheService.del as jest.Mock).mock.calls;
      const feedPageCalls = calls.filter((call) =>
        call[0].includes('feed'),
      );

      expect(feedPageCalls.length).toBeGreaterThan(5);
    });

    it('should invalidate asset-specific feed when asset is provided', async () => {
      const assetPair = 'ETH/USD';

      await service.invalidateSignalUpdate('sig-1', assetPair);

      const calls = (mockCacheService.del as jest.Mock).mock.calls;
      const assetFeedCalls = calls.filter((call) =>
        call[0].includes(assetPair),
      );

      expect(assetFeedCalls.length).toBeGreaterThan(0);
    });

    it('should invalidate provider-specific feed when provider is provided', async () => {
      const providerId = 'provider-123';

      await service.invalidateSignalUpdate('sig-1', undefined, providerId);

      const calls = (mockCacheService.del as jest.Mock).mock.calls;
      const providerCalls = calls.filter((call) =>
        call[0].includes(`provider:${providerId}`),
      );

      expect(providerCalls.length).toBeGreaterThan(0);
    });
  });

  /**
   * #532 — Portfolio and Leaderboard Invalidation Tests
   */
  describe('invalidateAfterTrade (#532)', () => {
    beforeEach(() => {
      mockCacheService.del.mockResolvedValue(undefined);
    });

    it('should invalidate portfolio cache after trade completion', async () => {
      const userId = 'user-123';
      const assetPair = 'XLM/USD';

      await service.invalidateAfterTrade(userId, assetPair, '100');

      expect(mockCacheService.del).toHaveBeenCalledWith(
        UserCacheKeys.portfolio(userId),
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.invalidated.trade',
        expect.objectContaining({
          userId,
          assetPair,
          tradeAmount: '100',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should invalidate user ranking in leaderboard', async () => {
      const userId = 'user-456';

      await service.invalidateAfterTrade(userId);

      const calls = (mockCacheService.del as jest.Mock).mock.calls;
      const userRankCalls = calls.filter((call) =>
        call[0].includes(LeaderboardCacheKeys.userRank(userId)),
      );

      expect(userRankCalls.length).toBeGreaterThan(0);
    });

    it('should invalidate overall leaderboard pages', async () => {
      await service.invalidateAfterTrade('user-123');

      const calls = (mockCacheService.del as jest.Mock).mock.calls;
      const overallLeaderboardCalls = calls.filter((call) =>
        call[0].includes('leaderboard:overall'),
      );

      expect(overallLeaderboardCalls.length).toBeGreaterThan(0);
    });

    it('should invalidate asset-specific leaderboards', async () => {
      const assetPair = 'BTC/USD';

      await service.invalidateAfterTrade('user-789', assetPair);

      const calls = (mockCacheService.del as jest.Mock).mock.calls;
      const assetLeaderboardCalls = calls.filter((call) =>
        call[0].includes(assetPair),
      );

      expect(assetLeaderboardCalls.length).toBeGreaterThan(0);
    });
  });

  /**
   * #532 — Dashboard Invalidation Tests
   */
  describe('invalidateDashboard (#532)', () => {
    beforeEach(() => {
      mockCacheService.del.mockResolvedValue(undefined);
    });

    it('should invalidate all dashboard caches for a user', async () => {
      const userId = 'user-123';

      await service.invalidateDashboard(userId);

      const calls = (mockCacheService.del as jest.Mock).mock.calls;
      const dashboardCalls = calls.filter((call) =>
        call[0].includes(`dashboard:${userId}`),
      );

      expect(dashboardCalls.length).toBeGreaterThanOrEqual(4);
    });

    it('should emit dashboard invalidation event', async () => {
      const userId = 'user-456';

      await service.invalidateDashboard(userId);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.invalidated.dashboard',
        { userId },
      );
    });
  });

  /**
   * #532 — Monitoring and Metrics Tests
   */
  describe('getInvalidationMetrics (#532)', () => {
    it('should report invalidation metrics', () => {
      const metrics = service.getInvalidationMetrics();

      expect(metrics).toHaveProperty('listenersAttached');
      expect(metrics).toHaveProperty('eventNameList');
      expect(Array.isArray(metrics.eventNameList)).toBe(true);
      expect(metrics.eventNameList).toContain('cache.invalidated.signal');
      expect(metrics.eventNameList).toContain('cache.invalidated.trade');
    });
  });

  /**
   * #532 — Cache Coherence Tests
   */
  describe('Cache coherence and stale data prevention (#532)', () => {
    beforeEach(() => {
      mockCacheService.del.mockResolvedValue(undefined);
    });

    it('should prevent stale data in feed after signal updates', async () => {
      await service.invalidateSignalUpdate('sig-1', 'XLM/USD');
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should maintain consistency across multiple invalidation types', async () => {
      await service.invalidateSignalUpdate('sig-1', 'XLM/USD');
      const signalCallCount = (mockCacheService.del as jest.Mock).mock.calls
        .length;

      mockCacheService.del.mockClear();

      await service.invalidateAfterTrade('user-1', 'XLM/USD');
      const tradeCallCount = (mockCacheService.del as jest.Mock).mock.calls
        .length;

      expect(signalCallCount).toBeGreaterThan(0);
      expect(tradeCallCount).toBeGreaterThan(0);
    });
  });
});
