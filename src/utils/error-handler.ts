import Logger from './logger';

/**
 * Tipos de erros personalizados
 */
export enum ErrorType {
  CONNECTION = 'connection_error',
  VALIDATION = 'validation_error',
  AUTHENTICATION = 'authentication_error',
  DEVICE_NOT_FOUND = 'device_not_found',
  GROUP_NOT_FOUND = 'group_not_found',
  COMMAND_FAILED = 'command_failed',
  INTERNAL_ERROR = 'internal_error'
}

/**
 * Classe personalizada para erros do Energy Manager
 */
export class EnergyManagerError extends Error {
  type: ErrorType;
  data?: any;

  constructor(message: string, type: ErrorType, data?: any) {
    super(message);
    this.name = 'EnergyManagerError';
    this.type = type;
    this.data = data;

    // Capturar stack trace corretamente no TypeScript
    Object.setPrototypeOf(this, EnergyManagerError.prototype);
  }
}

/**
 * Função para lidar com erros de forma consistente
 */
export function handleError(error: Error | EnergyManagerError, context?: string): never {
  // Se for nosso erro personalizado, registre com informações adicionais
  if (error instanceof EnergyManagerError) {
    Logger.error(`[${error.type}]${context ? ` (${context})` : ''}: ${error.message}`, {
      errorData: error.data,
      stack: error.stack
    });
  } else {
    // Para outros erros
    Logger.error(`[UNEXPECTED_ERROR]${context ? ` (${context})` : ''}: ${error.message}`, {
      stack: error.stack
    });
  }

  throw error;
}
