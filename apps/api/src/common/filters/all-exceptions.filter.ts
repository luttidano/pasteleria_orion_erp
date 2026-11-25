import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<any>();
    const res = ctx.getResponse<any>();

    const correlationId =
      (typeof req?.headers?.['x-correlation-id'] === 'string' &&
        req.headers['x-correlation-id'].trim()) ||
      (typeof req?.headers?.['x-request-id'] === 'string' &&
        req.headers['x-request-id'].trim()) ||
      randomUUID();

    try {
      if (res && typeof res.setHeader === 'function') {
        res.setHeader('x-correlation-id', correlationId);
      }
    } catch {
      // Ignorar si la respuesta ya fue enviada o no soporta setHeader
    }

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
        `[${correlationId}] Excepción no controlada en API [${req?.method ?? 'UNKNOWN'} ${httpAdapter.getRequestUrl(req)}]:`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      responseBody = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno del servidor.',
      };
    }

    httpAdapter.reply(
      res,
      {
        ...responseBody,
        statusCode: httpStatus,
        timestamp: new Date().toISOString(),
        path: httpAdapter.getRequestUrl(req),
        correlationId,
      },
      httpStatus,
    );
  }
}
