import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * Structured JSON logger that implements NestJS's LoggerService interface.
 *
 * In production → emits single-line JSON (machine-parseable by Datadog / ELK / Loki).
 * In development → emits human-readable coloured output.
 *
 * No external dependencies (Winston/Pino) — keeps the install footprint zero.
 * If you later add Pino or Winston, swap the internal `emit()` method; the
 * public API stays identical.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private minLevel: number;
  private isProduction: boolean;

  constructor(private readonly config: ConfigService) {
    const env = this.config.get<string>('NODE_ENV', 'development');
    this.isProduction = env === 'production';
    const configLevel = this.config.get<string>('LOG_LEVEL', this.isProduction ? 'info' : 'debug') as LogLevel;
    this.minLevel = LOG_LEVELS[configLevel] ?? LOG_LEVELS.info;
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.emit('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.emit('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.emit('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.emit('debug', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.emit('fatal', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.emit('debug', message, optionalParams);
  }

  private emit(level: LogLevel, message: unknown, params: unknown[]) {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const context = typeof params[params.length - 1] === 'string' ? (params.pop() as string) : undefined;
    const timestamp = new Date().toISOString();

    // Extract structured data from params
    const meta: Record<string, unknown> = {};
    for (const p of params) {
      if (p instanceof Error) {
        meta.error = {
          name: p.name,
          message: p.message,
          stack: p.stack,
        };
      } else if (typeof p === 'object' && p !== null) {
        Object.assign(meta, p);
      }
    }

    if (this.isProduction) {
      // JSON structured log — one line, machine-parseable
      const entry: Record<string, unknown> = {
        timestamp,
        level,
        ...(context && { context }),
        message: typeof message === 'string' ? message : JSON.stringify(message),
        ...meta,
      };
      const writer = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
      writer.write(JSON.stringify(entry) + '\n');
    } else {
      // Dev-friendly coloured output
      const colour = COLOURS[level] || COLOURS.info;
      const ctx = context ? `\x1b[33m[${context}]\x1b[0m ` : '';
      const lvl = `${colour}${level.toUpperCase().padEnd(5)}\x1b[0m`;
      const ts = `\x1b[90m${timestamp}\x1b[0m`;
      const msg = typeof message === 'string' ? message : JSON.stringify(message, null, 2);

      process.stdout.write(`${ts} ${lvl} ${ctx}${msg}\n`);

      if (meta.error) {
        const err = meta.error as Record<string, unknown>;
        if (err.stack) process.stderr.write(`\x1b[31m${err.stack}\x1b[0m\n`);
      } else if (Object.keys(meta).length > 0) {
        process.stdout.write(`\x1b[90m${JSON.stringify(meta, null, 2)}\x1b[0m\n`);
      }
    }
  }
}

const COLOURS: Record<string, string> = {
  debug: '\x1b[36m',   // cyan
  info: '\x1b[32m',    // green
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
  fatal: '\x1b[35m',   // magenta
};
