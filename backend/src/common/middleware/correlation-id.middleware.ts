import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || uuidv4();

    // Attach to request
    (req as any).correlationId = correlationId;

    // Attach to response headers
    res.setHeader('x-correlation-id', correlationId);

    // Attach to response locals for use in other middleware/handlers
    res.locals.correlationId = correlationId;

    next();
  }
}
