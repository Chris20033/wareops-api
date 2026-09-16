import { ConsoleLogger, type LogLevel } from '@nestjs/common';

const levels: LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
];

export function createApplicationLogger(minimumLevel: string): ConsoleLogger {
  const threshold = levels.indexOf(minimumLevel as LogLevel);
  const logLevels = levels.slice(0, threshold >= 0 ? threshold + 1 : 4);

  return new ConsoleLogger({
    json: true,
    colors: false,
    compact: true,
    logLevels,
  });
}
