import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export const SUPPORTED_VERSIONS = ['1', '2'] as const;
export const CURRENT_VERSION = '2';
export const DEPRECATED_VERSIONS: Record<
  string,
  { sunset: string; message: string }
> = {
  '1': {
    sunset: '2026-09-01',
    message:
      'API v1 is deprecated. Please migrate to v2. See /api/v2/docs for migration guide.',
  },
};

@Injectable()
export class VersioningMiddleware implements NestMiddleware {
  private readonly logger = new Logger(VersioningMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Header-based version negotiation: Accept-Version or X-API-Version
    const headerVersion =
      (req.headers['accept-version'] as string) ||
      (req.headers['x-api-version'] as string);

    // If a header version is requested but URL doesn't already contain a version,
    // rewrite the URL so NestJS versioning picks it up.
    if (headerVersion && !/\/api\/v\d+/.test(req.url)) {
      const version = SUPPORTED_VERSIONS.includes(headerVersion as any)
        ? headerVersion
        : CURRENT_VERSION;
      req.url = req.url.replace('/api', `/api/v${version}`);
    }

    // Detect which version is being used from the (possibly rewritten) URL
    const match = req.url.match(/\/api\/v(\d+)/);
    const usedVersion = match?.[1];

    if (usedVersion) {
      res.setHeader('X-API-Version', usedVersion);

      const deprecation = DEPRECATED_VERSIONS[usedVersion];
      if (deprecation) {
        // Check if sunset date has been exceeded
        const now = new Date();
        const sunsetDate = new Date(deprecation.sunset);

        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', deprecation.sunset);
        res.setHeader('X-Deprecation-Notice', deprecation.message);
        res.setHeader(
          'Link',
          `</api/v${CURRENT_VERSION}/docs>; rel="successor-version"`,
        );

        // Log deprecation warning
        this.logger.warn(
          `Deprecated API v${usedVersion} accessed: ${req.method} ${req.url}`,
        );

        // If sunset date has passed, optionally fail with warning header
        if (now > sunsetDate) {
          res.setHeader('X-Sunset-Enforced', 'true');
          res.setHeader(
            'X-Sunset-Message',
            `API v${usedVersion} is no longer supported as of ${deprecation.sunset}. Please migrate to v${CURRENT_VERSION}.`,
          );
          this.logger.error(
            `SUNSET REACHED: API v${usedVersion} sunset date (${deprecation.sunset}) has passed`,
          );
          // Note: You could optionally return 410 Gone here if strict enforcement is desired
          // return res.status(410).json({ error: 'API version no longer supported' });
        }
      }
    }

    next();
  }
}
