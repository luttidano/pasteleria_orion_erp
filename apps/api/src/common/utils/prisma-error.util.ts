import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface PrismaErrorMessages {
  unique?: string;
  foreignKey?: string;
  foreignKeyStatus?: 'bad_request' | 'conflict';
  notFound?: string;
  checkConstraint?: string;
  transactionTimeout?: string;
  fallback?: string;
}

export function extractPrismaErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const err = error as Record<string, any>;
  const directCode =
    err.code ??
    err.cause?.code ??
    err.meta?.driverAdapterError?.cause?.code ??
    err.meta?.code;

  if (typeof directCode === 'string' && directCode.trim().length > 0) {
    return directCode.trim();
  }

  const msg = typeof err.message === 'string' ? err.message : '';
  if (msg.includes('23514') || msg.toLowerCase().includes('check constraint')) {
    return '23514';
  }
  if (msg.includes('23505')) {
    return '23505';
  }
  if (msg.includes('23503')) {
    return '23503';
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  const code = extractPrismaErrorCode(error);
  return code === 'P2002' || code === '23505';
}

export function rethrowPrismaError(
  error: unknown,
  messages?: PrismaErrorMessages,
): never {
  if (error instanceof HttpException) {
    throw error;
  }

  const code = extractPrismaErrorCode(error);

  if (code === 'P2002' || code === '23505') {
    throw new ConflictException(
      messages?.unique ?? 'Ya existe un registro con los mismos datos únicos.',
    );
  }

  if (code === 'P2003' || code === '23503') {
    const msg =
      messages?.foreignKey ??
      (messages?.foreignKeyStatus === 'conflict'
        ? 'No se puede completar la operación porque el registro está referenciado por otros datos.'
        : 'La referencia relacionada no existe.');
    if (messages?.foreignKeyStatus === 'conflict') {
      throw new ConflictException(msg);
    }
    throw new BadRequestException(msg);
  }

  if (code === 'P2025') {
    throw new NotFoundException(
      messages?.notFound ?? 'El registro solicitado no fue encontrado.',
    );
  }

  if (code === 'P2023' || code === '22P02') {
    throw new BadRequestException('Formato de identificador o parámetro inválido.');
  }

  if (code === '23514') {
    throw new ConflictException(
      messages?.checkConstraint ??
        'La operación viola una restricción de integridad o stock disponible.',
    );
  }

  if (code === 'P2028') {
    console.warn(
      '[PrismaError] Transacción expirada (P2028):',
      error instanceof Error ? error.message : String(error),
    );
    throw new ServiceUnavailableException(
      messages?.transactionTimeout ??
        'La base de datos tardó demasiado en responder y la operación fue cancelada sin aplicar cambios. Intenta nuevamente.',
    );
  }

  console.error('[PrismaError]', error);
  throw new InternalServerErrorException(
    messages?.fallback ?? 'Ocurrió un error interno al procesar la operación.',
  );
}

