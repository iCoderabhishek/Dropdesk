import { Queue } from "bullmq";
import { redis } from "../redis/redis";

export const exportQueue = new Queue('export', { connection: redis })