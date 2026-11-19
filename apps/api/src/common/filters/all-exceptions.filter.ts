import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let responseBody: any;

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      responseBody = typeof response === 'object' ? response : { message: response };
    } else {
      this.logger.error(
        'Excepción no controlada en API:',
        exception instanceof Error ? exception.stack : String(exception),
      );
      responseBody = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno del servidor.',
      };
    }

    httpAdapter.reply(
      ctx.getResponse(),
      {
        ...responseBody,
        statusCode: httpStatus,
        timestamp: new Date().toISOString(),
        path: httpAdapter.getRequestUrl(ctx.getRequest()),
      },
      httpStatus,
    );
  }
}
