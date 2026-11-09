import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';

export const EMBEDDING_QUEUE = 'pet-embeddings';
export type EmbeddingJob = { petId: number };

export function redisConnection(worker = false): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    connectTimeout: 2000,
    ...(worker ? {} : { commandTimeout: 2000 }),
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

  enqueue(petId: number) {
    return this.queue.add(
      'generate-embedding',
      { petId },
      {
        jobId: `embed-pet-${petId}`,
      },
    );
  }

  async onApplicationShutdown() {
    await this.queue.close();
  }
}
