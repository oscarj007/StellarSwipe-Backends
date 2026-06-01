import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { RateLimit, RateLimitTier } from '../common/decorators/rate-limit.decorator';
import { LeaderboardService, LeaderboardResponse } from './leaderboard.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('providers')
  @RateLimit({ tier: RateLimitTier.PUBLIC, limit: 30, window: 60 })
  @HttpCode(HttpStatus.OK)
  async getProviderLeaderboard(
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardResponse> {
    return this.leaderboardService.getProviderLeaderboard(query);
  }

  @Get('users')
  @RateLimit({ tier: RateLimitTier.PUBLIC, limit: 30, window: 60 })
  @HttpCode(HttpStatus.OK)
  async getUserLeaderboard(
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardResponse> {
    return this.leaderboardService.getUserLeaderboard(query);
  }
}
