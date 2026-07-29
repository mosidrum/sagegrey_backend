import winston from 'winston';

const { combine, timestamp, colorize, printf, errors } = winston.format;

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize({ all: true }),
    printf(({ timestamp: ts, level, message, stack }) => `${ts} [${level}] ${stack ?? message}`),
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
