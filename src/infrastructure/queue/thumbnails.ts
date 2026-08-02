import { Queue } from "bullmq";
import { redis } from "../redis/redis";

export const thumbnailQueue = new Queue('thumbnails', { connection: redis })