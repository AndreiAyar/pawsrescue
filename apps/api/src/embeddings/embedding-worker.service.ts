import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  BeforeApplicationShutdown,
  BadRequestException,
} from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { Worker, UnrecoverableError } from 'bullmq';
import { LostPetsService } from '../lost-pets/lost-pets.service';
import {
  EMBEDDING_QUEUE,
  EmbeddingJob,
  EmbeddingQueueService,
  redisConnection,
} from './embedding-queue.service';

@Injectable()
export class EmbeddingWorkerService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(EmbeddingWorkerService.name);
  private worker?: Worker<EmbeddingJob>;
  private recoveryTimer?: NodeJS.Timeout;
  private recovering = false;

  constructor(
    private readonly orm: MikroORM,
    private readonly pets: LostPetsService,
    private readonly embeddings: EmbeddingQueueService,
  ) {}

  async onApplicationBootstrap() {
    // main.ts runs migrations before app.listen() triggers this hook.
    // CLI maintenance commands do not need background workers.
    if (process.env.EMBEDDING_WORKER_ENABLED === 'false') return;

    await this.recover();
    this.worker = new Worker<EmbeddingJob>(
      EMBEDDING_QUEUE,
      async (job) => {
        try {
          return await RequestContext.create(this.orm.em, () =>
            this.pets.processEmbedding(job.data.petId),
          );
        } catch (error) {
          const permanent = error instanceof BadRequestException;
          await RequestContext.create(this.orm.em, () =>
            this.pets.setEmbeddingStatus(
              job.data.petId,
              permanent || job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
                ? 'failed'
                : 'pending',
            ),
          );
          if (permanent) throw new UnrecoverableError('Invalid uploaded photo');
          throw error;
        }
      },
      {
        connection: redisConnection(true),
        prefix: process.env.QUEUE_PREFIX || 'pawsrescue',
        concurrency: 1,
      },
    );
    this.worker.on('error', (error) => this.logger.error(error.message));
    this.worker.on('failed', (job, error) =>
      this.logger.warn(`Embedding job ${job?.id}: ${error.message}`),
    );

    this.recoveryTimer = setInterval(() => void this.recover(), 30000);
    this.recoveryTimer.unref();
  }

  async recover() {
    if (this.recovering) return;
    this.recovering = true;
    try {
      // Shared Redis limit also protects AI when several API replicas run.
      await this.embeddings.queue.setGlobalConcurrency(1);
      await RequestContext.create(this.orm.em, () =>
        this.pets.recoverPendingEmbeddings(),
      );
    } catch (error) {
      this.logger.warn(
        `Embedding recovery will retry: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.recovering = false;
    }
  }

  async beforeApplicationShutdown() {
    clearInterval(this.recoveryTimer);
    // Finish active jobs before Nest closes the producer and database.
    await this.worker?.close();
  }
}
