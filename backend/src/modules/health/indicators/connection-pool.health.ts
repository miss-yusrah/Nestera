import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConnectionPoolService } from '../../../common/database/connection-pool.config';

@Injectable()
export class ConnectionPoolHealthIndicator extends HealthIndicator {
  constructor(private connectionPoolService: ConnectionPoolService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const isHealthy = await this.connectionPoolService.checkPoolHealth();
    const metrics = this.connectionPoolService.getLatestMetrics();
    const leaks = await this.connectionPoolService.detectConnectionLeaks();

    const result = this.getStatus('database_pool', isHealthy, {
      metrics,
      leaksDetected: leaks > 0,
    });

    if (!isHealthy || leaks > 0) {
      throw new HealthCheckError('Connection pool health check failed', result);
    }

    return result;
  }
}
