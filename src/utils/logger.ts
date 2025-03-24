import { warn } from 'console';
import winston from 'winston';

// Níveis de log personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Definir nível com base no ambiente
const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Formato customizado
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Transportes para logs
const transports = [
  // Console para desenvolvimento
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      ),
    ),
  }),
  // Arquivo para produção
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/combined.log' }),
];

// Criar e exportar o logger
const Logger = winston.createLogger({
  level,
  levels,
  format,
  transports,
});

function formatArg(arg: any): string {
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }
  return String(arg);
}

export default {
  info: (msg: string, ...args: any[]) => {
    console.log(`${new Date().toISOString()} info: ${msg}
    `, ...args.map(formatArg));
  },
  debug: (msg: string, ...args: any[]) => {
    console.debug(`${new Date().toISOString()} debug: ${msg}`, ...args.map(formatArg));
  },
  error: (msg: string, ...args: any[]) => {
    console.error(`${new Date().toISOString()} error: ${msg}`, ...args.map(formatArg));
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn(`${new Date().toISOString()} warn: ${msg}
    `, ...args.map(formatArg));
  },
};
