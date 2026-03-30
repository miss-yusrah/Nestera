import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export function getTypeOrmConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  return {
    type: 'postgres',
    host: configService.get<string>('DATABASE_HOST', 'localhost'),
    port: configService.get<number>('DATABASE_PORT', 5432),
    username: configService.get<string>('DATABASE_USER', 'postgres'),
    password: configService.get<string>('DATABASE_PASSWORD', 'postgres'),
    database: configService.get<string>('DATABASE_NAME', 'nestera'),
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
    synchronize: !isProduction,
    logging: !isProduction,
    // Connection pooling configuration
    extra: {
      max: configService.get<number>(
        'DATABASE_POOL_MAX',
        isProduction ? 30 : 10,
      ),
      min: configService.get<number>('DATABASE_POOL_MIN', isProduction ? 5 : 2),
      idleTimeoutMillis: configService.get<number>(
        'DATABASE_IDLE_TIMEOUT',
        30000,
      ),
      connectionTimeoutMillis: configService.get<number>(
        'DATABASE_CONNECTION_TIMEOUT',
        2000,
      ),
      // Enable connection validation
      statement_timeout: 30000,
      query_timeout: 30000,
      // Connection validation query
      validationQuery: 'SELECT 1',
      // Validate connection on checkout
      validateConnection: true,
    },
  };
}
