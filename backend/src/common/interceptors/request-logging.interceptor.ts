import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: any): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const correlationId =
      (request.headers['x-correlation-id'] as string) || uuidv4();
    const startTime = Date.now();

    // Attach correlation ID to request and response
    (request as any).correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'];

    this.logger.log(
      JSON.stringify({
        type: 'REQUEST',
        correlationId,
        method,
        url,
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
      }),
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.log(
          JSON.stringify({
            type: 'RESPONSE',
            correlationId,
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
          }),
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        this.logger.error(
          JSON.stringify({
            type: 'ERROR',
            correlationId,
            method,
            url,
            statusCode: error.status || 500,
            message: error.message,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
          }),
        );

        throw error;
      }),
    );
  }
}
