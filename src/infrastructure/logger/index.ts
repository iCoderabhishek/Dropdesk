import { createLogger, format, transports } from 'winston';
const { combine, timestamp, json, colorize, printf, errors } = format;

// Custom format for local development to make it highly readable
const devFormat = combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';

        return `${timestamp} [${level}]: ${stack || message} ${metaString}`;
    })
);

const logger = createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

    format: combine(
        errors({ stack: true }),
        timestamp(),
        json()
    ),
    defaultMeta: { service: "dropdesk-api-0bhishek" },
    transports: [
        new transports.Console({
            // Override the JSON format with the readable dev format if we are not in production
            format: process.env.NODE_ENV === 'production' ? undefined : devFormat
        })
    ]
});

export default logger;