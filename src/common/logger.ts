import winston from 'winston';

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 } as const;

winston.addColors({ ERROR: 'red', WARN: 'yellow', INFO: 'green', DEBUG: 'blue' });

const { combine, timestamp, colorize, printf, errors } = winston.format;

type AppLogger = winston.Logger & Record<keyof typeof LOG_LEVELS, winston.LeveledLogMethod>;

const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize({ all: true }),
    printf(({ timestamp: ts, level, message, stack }) => `${ts} [${level}] ${stack ?? message}`),
  ),
  transports: [new winston.transports.Console()],
}) as AppLogger;

export default logger;
