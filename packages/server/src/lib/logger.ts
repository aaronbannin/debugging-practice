import fs from 'node:fs';
import pino from 'pino';
import { logDir, logFile } from './paths.js';

fs.mkdirSync(logDir, { recursive: true });

const level = process.env.LOG_LEVEL ?? 'debug';

const streams: pino.StreamEntry[] = [
  { level: level as pino.Level, stream: fs.createWriteStream(logFile, { flags: 'a' }) },
];

if (process.env.DP_QUIET !== '1') {
  streams.push({
    level: level as pino.Level,
    stream: pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      },
    }) as pino.DestinationStream,
  });
}

export const logger = pino(
  {
    level,
    base: { service: 'taskflow-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  pino.multistream(streams, { dedupe: false }),
);

export type Logger = typeof logger;
