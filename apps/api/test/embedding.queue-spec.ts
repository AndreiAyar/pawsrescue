import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { EntityManager, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';

jest.mock('supercluster', () => jest.fn());

import dbConfig from '../mikro-orm.config';
import { LostPetEntity } from '../src/lost-pets/lost-pets.entity';
import { LostPetsController } from '../src/lost-pets/lost-pets.controller';
import { LostPetsService } from '../src/lost-pets/lost-pets.service';
import { EmbeddingQueueService } from '../src/embeddings/embedding-queue.service';
import { EmbeddingWorkerService } from '../src/embeddings/embedding-worker.service';

// Real Redis, PostgreSQL, migrations, Nest HTTP and disk uploads. Only the AI
// HTTP response is controlled so failures and overlap are reproducible.
describe('Queued uploads (integration)', () => {
  const originalEnv = { ...process.env };
  const schema = `queue_test_${randomUUID().replaceAll('-', '')}`;
  let orm: MikroORM<PostgreSqlDriver>;
  let app: INestApplication<App>;
  let embeddings: EmbeddingQueueService;
  let worker: EmbeddingWorkerService;
  let ai: Server;
  let uploads: string;
  let mode: 'success' | 'transient' | 'unavailable' | 'invalid' | 'fallback' =
    'success';
  let active = 0;
  let peak = 0;
  const calls = new Map<string, number>();
  const vectors = new Map<string, number[]>();

  beforeAll(async () => {
    process.env.USE_MOCK_DATA = 'false';
    process.env.QUEUE_PREFIX = schema;
    process.env.REDIS_PORT = process.env.QUEUE_TEST_REDIS_PORT || '6379';
    uploads = await mkdtemp(join(tmpdir(), 'pawsrescue-queue-'));
    process.env.UPLOAD_DIR = uploads;
    process.env.AI_REQUEST_TIMEOUT_MS = '5000';
    delete process.env.EMBEDDING_WORKER_ENABLED;

    ai = createServer((req, res) => {
      void (async () => {
        let body = '';
        for await (const chunk of req) body += String(chunk);
        const { imagePaths } = JSON.parse(body) as { imagePaths: string[] };
        const key = basename(imagePaths[0]);
        const count = (calls.get(key) ?? 0) + 1;
        calls.set(key, count);
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 40));
        const status =
          mode === 'invalid'
            ? 400
            : mode === 'unavailable' || (mode === 'transient' && count === 1)
              ? 503
              : 200;
        const embedding = Array<number>(1024).fill(0);
        embedding[0] = 1;
        embedding[1] =
          [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) / 10000;
        vectors.set(key, embedding);
        active -= 1;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            embedding,
            model: 'queue-test-model',
            fallbackUsed: mode === 'fallback',
          }),
        );
      })().catch(() => {
        res.writeHead(500);
        res.end();
      });
    });
    ai.listen(0, '127.0.0.1');
    await once(ai, 'listening');
    const address = ai.address();
    if (!address || typeof address === 'string')
      throw new Error('AI fixture failed');
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${address.port}`;

    orm = await MikroORM.init<PostgreSqlDriver>({
      ...dbConfig,
      ...(process.env.QUEUE_TEST_DATABASE_URL
        ? { clientUrl: process.env.QUEUE_TEST_DATABASE_URL }
        : {}),
      entities: [LostPetEntity],
      entitiesTs: [LostPetEntity],
      schema,
      debug: false,
      // Reconnected sessions must also stay in the disposable schema.
      pool: {
        min: 1,
        max: 1,
        afterCreate: (
          connection: {
            query: (
              sql: string,
              callback: (error: Error | null) => void,
            ) => void;
          },
          done: (error: Error | null, connection: unknown) => void,
        ) =>
          connection.query(
            `set search_path to "${schema}", public, extensions`,
            (error) => done(error, connection),
          ),
      },
      migrations: { ...dbConfig.migrations, snapshot: false },
    });
    await orm.em.getConnection().execute(`create schema "${schema}"`);
    const extensions = await orm.em
      .getConnection()
      .execute<Array<{ installed: boolean }>>(
        "select exists(select 1 from pg_extension where extname = 'vector') as installed",
      );
    if (!extensions[0].installed)
      throw new Error(
        'Install pgvector in the test database before running this suite',
      );
    await orm.em
      .getConnection()
      .execute(`set search_path to "${schema}", public, extensions`);
    await orm.getMigrator().up();
    await orm.getMigrator().up(); // Migration is safe to run again.

    const module = await Test.createTestingModule({
      controllers: [LostPetsController],
      providers: [
        LostPetsService,
        EmbeddingQueueService,
        EmbeddingWorkerService,
        { provide: MikroORM, useValue: orm },
        { provide: EntityManager, useValue: orm.em },
        {
          provide: getRepositoryToken(LostPetEntity),
          useValue: orm.em.getRepository(LostPetEntity),
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<App>>();
    app.useLogger(false);
    app.use((_req: unknown, _res: unknown, next: () => void) =>
      RequestContext.create(orm.em, next),
    );
    embeddings = app.get(EmbeddingQueueService);
    // Keep the production attempt count; shorten only the retry delays.
    embeddings.queue.opts.defaultJobOptions!.backoff = {
      type: 'fixed',
      delay: 50,
    };
    worker = app.get(EmbeddingWorkerService);
    await app.init();
  });

  afterAll(async () => {
    if (embeddings) await embeddings.queue.obliterate({ force: true });
    await app?.close();
    if (orm) {
      await orm.em
        .getConnection()
        .execute(`drop schema if exists "${schema}" cascade`);
      await orm.close(true);
    }
    if (ai) await new Promise<void>((resolve) => ai.close(() => resolve()));
    if (uploads) await rm(uploads, { recursive: true, force: true });
    process.env = originalEnv;
  });

  type Report = {
    id: number;
    embeddingStatus: string;
    imageUrls: string[];
    embeddingInfo: { model: string; fallbackUsed: boolean } | null;
  };

  function readReport(res: { body: unknown }): Report {
    return res.body as Report;
  }

  function upload(name: string, photo = true) {
    const req = request(app.getHttpServer())
      .post('/lost-pets')
      .field('name', name)
      .field('type', 'cat')
      .field('email', 'queue-test@example.com')
      .field('latitude', '45.75')
      .field('longitude', '21.23');
    return photo
      ? req.attach('photos', Buffer.from('fixture'), {
          filename: 'cat.jpg',
          contentType: 'image/jpeg',
        })
      : req;
  }

  async function waitFor(id: number, status: string, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/lost-pets/${id}`)
        .expect(200);
      if (readReport(res).embeddingStatus === status) return readReport(res);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    throw new Error(`Report ${id} did not reach ${status}`);
  }

  it('handles 12 simultaneous uploads without mixing vectors or exceeding one active AI request', async () => {
    const replica = new EmbeddingWorkerService(
      orm,
      app.get(LostPetsService),
      embeddings,
    );
    await replica.onApplicationBootstrap();
    try {
      await embeddings.queue.pause();
      const responses = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          upload(`Concurrent ${i}`).expect(201),
        ),
      );
      expect(new Set(responses.map((res) => readReport(res).id)).size).toBe(12);
      for (const res of responses) {
        expect(res.body).toMatchObject({
          embeddingStatus: 'pending',
          embeddingInfo: null,
        });
      }
      expect(calls.size).toBe(0); // HTTP finished while AI processing was paused.
      await embeddings.queue.resume();
      for (const res of responses) await waitFor(readReport(res).id, 'ready');
      expect(peak).toBe(1);
      expect(calls.size).toBe(12);
      const rows = await orm.em
        .getConnection()
        .execute<Array<{ image_urls: string[]; embedding: string }>>(
          'select image_urls, embedding::text as embedding from lost_pets',
        );
      for (const row of rows) {
        expect(JSON.parse(row.embedding)).toEqual(
          vectors.get(basename(row.image_urls[0])),
        );
      }
    } finally {
      await replica.beforeApplicationShutdown();
    }
  });

  it('deduplicates repeated scheduling and skips already completed reports', async () => {
    const res = await upload('Deduplication').expect(201);
    const id = readReport(res).id;
    await Promise.all(Array.from({ length: 10 }, () => embeddings.enqueue(id)));
    const report = await waitFor(id, 'ready');
    await RequestContext.create(orm.em, () =>
      app.get(LostPetsService).processEmbedding(id),
    );
    expect(calls.get(basename(report.imageUrls[0]))).toBe(1);
  });

  it('retries a temporary AI outage then becomes ready', async () => {
    mode = 'transient';
    const res = await upload('Transient failure').expect(201);
    const report = await waitFor(readReport(res).id, 'ready');
    expect(calls.get(basename(report.imageUrls[0]))).toBe(2);
    mode = 'success';
  });

  it.each(['unavailable', 'fallback'] as const)(
    'marks %s as failed after three attempts without saving a vector',
    async (failure) => {
      mode = failure;
      const res = await upload(failure).expect(201);
      const report = await waitFor(readReport(res).id, 'failed');
      expect(report.embeddingInfo).toBeNull();
      expect(calls.get(basename(report.imageUrls[0]))).toBe(3);
      mode = 'success';
    },
  );

  it('does not retry an invalid photo, and preserves the saved listing', async () => {
    mode = 'invalid';
    const res = await upload('Invalid image').expect(201);
    const report = await waitFor(readReport(res).id, 'failed');
    expect(calls.get(basename(report.imageUrls[0]))).toBe(1);
    mode = 'success';
  });

  it('keeps uploads without photos synchronous and does not enqueue inference', async () => {
    const previous = calls.size;
    const res = await upload('No photo', false).expect(201);
    expect(readReport(res).embeddingStatus).toBe('none');
    expect(
      await embeddings.queue.getJob(`embed-pet-${readReport(res).id}`),
    ).toBeUndefined();
    expect(calls.size).toBe(previous);
  });

  it('rejects invalid multipart input and removes its unsaved photo', async () => {
    const before = (await readdir(uploads)).sort();
    await request(app.getHttpServer())
      .post('/lost-pets')
      .field('name', 'Invalid report')
      .field('email', 'invalid')
      .field('type', 'cat')
      .field('latitude', '45')
      .field('longitude', '21')
      .attach('photos', Buffer.from('fixture'), {
        filename: 'invalid.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect((await readdir(uploads)).sort()).toEqual(before);
  });

  it('recovers a report saved while the Redis producer was disconnected', async () => {
    const redis = await embeddings.queue.client;
    redis.disconnect();
    const res = await upload('Redis unavailable').expect(201);
    expect(readReport(res).embeddingStatus).toBe('pending');
    expect(await readdir(uploads)).toContain(
      basename(readReport(res).imageUrls[0]),
    );
    await redis.connect();
    await worker.recover();
    await waitFor(readReport(res).id, 'ready');
  });

  it('processes queued work after the worker restarts', async () => {
    await worker.beforeApplicationShutdown();
    const res = await upload('Worker restarted').expect(201);
    expect(readReport(res).embeddingStatus).toBe('pending');
    await worker.onApplicationBootstrap();
    await waitFor(readReport(res).id, 'ready');
  });

  (process.env.QUEUE_TEST_REAL_AI_URL ? it : it.skip)(
    'processes an actual photo through the running AI model',
    async () => {
      const previousUrl = process.env.AI_SERVICE_URL;
      const previousDir = process.env.UPLOAD_DIR;
      const realUploads = join(process.cwd(), 'uploads');
      let storedPhoto: string | undefined;
      try {
        process.env.AI_SERVICE_URL = process.env.QUEUE_TEST_REAL_AI_URL;
        process.env.UPLOAD_DIR = realUploads;
        process.env.AI_REQUEST_TIMEOUT_MS = '180000';
        const photo = await readFile(
          join(realUploads, 'demo-unsplash-1513245543132-31f507417b26.jpg'),
        );
        const res = await upload('Real AI integration', false)
          .attach('photos', photo, {
            filename: 'real-cat.jpg',
            contentType: 'image/jpeg',
          })
          .expect(201);
        storedPhoto = join(realUploads, basename(readReport(res).imageUrls[0]));
        const ready = await waitFor(readReport(res).id, 'ready', 80000);
        expect(ready.embeddingInfo).toMatchObject({ fallbackUsed: false });
        expect(ready.embeddingInfo?.model).not.toBe('queue-test-model');
      } finally {
        process.env.AI_SERVICE_URL = previousUrl;
        process.env.UPLOAD_DIR = previousDir;
        process.env.AI_REQUEST_TIMEOUT_MS = '5000';
        if (storedPhoto) await rm(storedPhoto, { force: true });
      }
    },
  );

  it('still returns scan results synchronously and deletes only the temporary scan file', async () => {
    const before = await readdir(uploads);
    const res = await request(app.getHttpServer())
      .post('/lost-pets/match')
      .attach('photos', Buffer.from('fixture'), {
        filename: 'scan.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    const scan = res.body as {
      matches: unknown[];
      queryEmbedding: { model: string };
    };
    expect(Array.isArray(scan.matches)).toBe(true);
    expect(scan.queryEmbedding.model).toBe('queue-test-model');
    expect((await readdir(uploads)).sort()).toEqual(before.sort());
  });
});
