import { rateLimit, MINUTE } from 'express-rate-limit'
import { RedisStore, type RedisReply } from 'rate-limit-redis'
import { redis } from '../redis/redis'


const limiter = rateLimit({
    windowMs: 15 * MINUTE,
    max: 99,
    standardHeaders: "draft-8", // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    ipv6Subnet: 56,
    // Redis store configuration
    store: new RedisStore({
        prefix: "rl_global:",
        sendCommand: (command: string, ...args: string[]) =>
            redis.call(command, ...args) as Promise<RedisReply>,
    }),
})


export const authLimiter = rateLimit({
    windowMs: 15 * MINUTE,
    max: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: new RedisStore({
        prefix: "rl_auth:",
        sendCommand: (command: string, ...args: string[]) =>
            redis.call(command, ...args) as Promise<RedisReply>,
    }),
});



export default limiter;