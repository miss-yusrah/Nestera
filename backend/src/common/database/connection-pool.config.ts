import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

export interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalConnections: number;
  utilizationPercentage: number;
  timestamp: Date;
}

@Injectable()
export class ConnectionPoolService {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private metrics: PoolMetrics[] = [];
  private readonly maxMetricsHistory = 1000;

  constructor(
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {
    this.initializePoolMonitoring();
  }

  private initializePoolMonitoring() {
    setInterval(() => {
      this.collectMetrics();
    }, 30000); // Collect every 30 seconds
  }

  private collectMetrics() {
    try {
      const pool = (this.dataSource.driver as any).pool;
      if (!pool) return;

      const metrics: PoolMetrics = {
        activeConnections: pool._activeConnections?.length || 0,
        idleConnections: pool._idleConnections?.length || 0,
        waitingRequests: pool._waitingRequests?.length || 0,
        totalConnections: pool._allConnections?.length || 0,
        utilizationPercentage:
          ((pool._activeConnections?.length || 0) /
            (pool._allConnections?.length || 1)) *
          100,
        timestamp: new Date(),
      };

      this.metrics.push(metrics);
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics.shift();
      }

      // Alert on high utilization
      if (metrics.utilizationPercentage > 80) {
        this.logger.warn(
          `High connection pool utilization: ${metrics.utilizationPercentage.toFixed(2)}%`,
        );
      }

      // Alert on waiting requests
      if (metrics.waitingRequests > 5) {
        this.logger.warn(
          `Connection pool queue building up: ${metrics.waitingRequests} waiting requests`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to collect pool metrics', error);
    }
  }

  getMetrics(): PoolMetrics[] {
    return this.metrics;
  }

  getLatestMetrics(): PoolMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  getAverageUtilization(minutes: number = 5): number {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const recentMetrics = this.metrics.filter((m) => m.timestamp > cutoff);

    if (recentMetrics.length === 0) return 0;

    const sum = recentMetrics.reduce(
      (acc, m) => acc + m.utilizationPercentage,
      0,
    );
    return sum / recentMetrics.length;
  }

  async checkPoolHealth(): Promise<boolean> {
    try {
      const result = await this.dataSource.query('SELECT 1');
      return !!result;
    } catch (error) {
      this.logger.error('Pool health check failed', error);
      return false;
    }
  }

  async detectConnectionLeaks(): Promise<number> {
    const pool = (this.dataSource.driver as any).pool;
    if (!pool) return 0;

    const activeConnections = pool._activeConnections?.length || 0;
    const maxPoolSize = this.configService.get<number>('DATABASE_POOL_MAX', 20);

    if (activeConnections > maxPoolSize * 0.9) {
      this.logger.warn(
        `Potential connection leak detected: ${activeConnections}/${maxPoolSize}`,
      );
      return activeConnections;
    }

    return 0;
  }
}
