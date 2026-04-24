import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({
    example: 400,
    description: 'HTTP status code',
  })
  statusCode: number;

  @ApiProperty({
    example: 'Bad Request',
    description: 'Error message',
  })
  message: string;

  @ApiProperty({
    example: 'BadRequestException',
    description: 'Error type',
  })
  error: string;

  @ApiProperty({
    example: '2026-03-30T04:57:29.140Z',
    description: 'Timestamp of the error',
  })
  timestamp: string;

  @ApiProperty({
    example: '/api/v2/savings/goals',
    description: 'Request path',
  })
  path?: string;
}

export class ValidationErrorDto extends ApiErrorResponseDto {
  @ApiProperty({
    example: [
      {
        field: 'goalName',
        message: 'Goal name is required',
      },
    ],
    description: 'Validation errors',
  })
  errors?: Array<{ field: string; message: string }>;
}

export class UnauthorizedErrorDto extends ApiErrorResponseDto {
  @ApiProperty({
    example: 401,
    description: 'HTTP status code',
  })
  statusCode = 401;

  @ApiProperty({
    example: 'Unauthorized',
    description: 'Error message',
  })
  message = 'Unauthorized';
}

export class ForbiddenErrorDto extends ApiErrorResponseDto {
  @ApiProperty({
    example: 403,
    description: 'HTTP status code',
  })
  statusCode = 403;

  @ApiProperty({
    example: 'Forbidden',
    description: 'Error message',
  })
  message = 'Forbidden';
}

export class NotFoundErrorDto extends ApiErrorResponseDto {
  @ApiProperty({
    example: 404,
    description: 'HTTP status code',
  })
  statusCode = 404;

  @ApiProperty({
    example: 'Not Found',
    description: 'Error message',
  })
  message = 'Not Found';
}
