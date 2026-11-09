import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';

export const EMBEDDING_QUEUE = 'pet-embeddings';
export type EmbeddingJob = { petId: number };

function redisConnection(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    commandTimeout: 2000,
  };
}

@Injectable()
export class EmbeddingQueueService implements OnApplicationShutdown {
  private readonly logger = new Logger(EmbeddingQueueService.name);
  readonly queue: Queue<EmbeddingJob>;

  constructor() {
    this.queue = new Queue<EmbeddingJob>(EMBEDDING_QUEUE, {
      connection: redisConnection(),
      prefix: process.env.QUEUE_PREFIX || 'pawsrescue',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
    this.queue.on('error', (error) => this.logger.warn(error.message));
  }

  async enqueue(petId: number) {
    let timeout: NodeJS.Timeout | undefined;
    try {
      // Initial Redis connection can also stall. Keep the saved report responsive;
      // Python recovery and stable job IDs cover a late or failed enqueue.
      return await Promise.race([
        this.queue.add(
          'generate-embedding',
          { petId },
          { jobId: `embed-pet-${petId}` },
        ),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Redis enqueue timed out')),
            2000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }

  async onApplicationShutdown() {
    await this.queue.close();
  }
}
