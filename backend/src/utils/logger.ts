import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

const service = process.env.LOG_SERVICE_NAME || 'instrument-management-backend';
const environment = process.env.NODE_ENV || 'development';
const MAX_LOG_FILE_BYTES = 8 * 1024 * 1024;

function writeToFile(output: string) {
  if (process.env.LOG_TO_FILE === 'false') return;

  try {
    const directory = process.env.LOG_DIR
      ? path.resolve(process.env.LOG_DIR)
      : path.resolve(__dirname, '../../logs');
    const filePath = path.join(directory, 'application.log');
    fs.mkdirSync(directory, { recursive: true });

    if (fs.existsSync(filePath) && fs.statSync(filePath).size >= MAX_LOG_FILE_BYTES) {
      const rotatedPath = `${filePath}.1`;
      fs.rmSync(rotatedPath, { force: true });
      fs.renameSync(filePath, rotatedPath);
    }

    fs.appendFileSync(filePath, `${output}\n`, 'utf8');
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      service,
      environment,
      event: 'logger.file_write_failed',
      error: serializeError(error),
    }));
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: cause instanceof Error
        ? { name: cause.name, message: cause.message, stack: cause.stack }
        : cause,
    };
  }

  return error;
}

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    environment,
    event,
    ...fields,
  };

  try {
    const output = JSON.stringify(entry);
    writeToFile(output);
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      service,
      environment,
      event: 'logger.serialization_failed',
      error: serializeError(error),
    }));
  }
}

export const logger = {
  debug: (event: string, fields?: LogFields) => write('debug', event, fields),
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, error: unknown, fields?: LogFields) => write('error', event, {
    ...fields,
    error: serializeError(error),
  }),
};
