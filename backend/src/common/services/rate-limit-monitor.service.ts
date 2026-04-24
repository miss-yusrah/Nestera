import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface RateLimitViolation {
  userId: string | null;
  ip: string;
  tier: string;
  route: string;
  method: string;
  throttlerName: string;
  limit: number;
  ttl: number;
  timestamp: Date;
}

/**
 * In-memory rate limit violation tracker for admin monitoring.
 * Stores the last 1000 violations in a circular buffer.
 */
@Injectable()
export class RateLimitMonitorService {
  private readonly logger = new Logger(RateLimitMonitorService.name);
  private readonly violations: RateLimitViolation[] = [];
  private readonly MAX_VIOLATIONS = 1000;

  constructor(private readonly eventEmitter: EventEmitter2) {}

  recordViolation(violation: RateLimitViolation): void {
    if (this.violations.length >= this.MAX_VIOLATIONS) {
      this.violations.shift();
    }
    this.violations.push(violation);
    this.eventEmitter.emit('ratelimit.violation', violation);
  }

  getRecentViolations(limit = 50): RateLimitViolation[] {
    return this.violations.slice(-limit).reverse();
  }

  getViolationsByUser(userId: string, limit = 50): RateLimitViolation[] {
    return this.violations
      .filter((v) => v.userId === userId)
      .slice(-limit)
      .reverse();
  }

  getViolationSummary(): {
    total: number;
    last24h: number;
    topOffenders: { userId: string; count: number }[];
    byTier: Record<string, number>;
    byRoute: Record<string, number>;
  } {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const last24h = this.violations.filter(
      (v) => v.timestamp.getTime() >= dayAgo,
    );

    // Count by user
    const userCounts: Record<string, number> = {};
    for (const v of last24h) {
      const key = v.userId || v.ip;
      userCounts[key] = (userCounts[key] || 0) + 1;
    }
    const topOffenders = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count by tier
    const byTier: Record<string, number> = {};
    for (const v of last24h) {
      byTier[v.tier] = (byTier[v.tier] || 0) + 1;
    }

    // Count by route
    const byRoute: Record<string, number> = {};
    for (const v of last24h) {
      const key = `${v.method} ${v.route}`;
      byRoute[key] = (byRoute[key] || 0) + 1;
    }

    return {
      total: this.violations.length,
      last24h: last24h.length,
      topOffenders,
      byTier,
      byRoute,
    };
  }
}
