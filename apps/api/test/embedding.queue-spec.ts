import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { fork, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { Queue } from 'bullmq';
import dbConfig from '../mikro-orm.config';
import { LostPetEntity } from '../src/lost-pets/lost-pets.entity';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Report = { id: number; imageUrls: string[]; embeddingStatus: string };

// Real Nest and Python processes, Redis and Postgres. No production rows are changed.
describe('Nest producer → Python worker', () => {
  const schema = `queue_test_${randomUUID().replaceAll('-', '')}`;
  const apiDir = process.cwd();
  const aiDir = resolve(apiDir, '../ai');
  let orm: MikroORM<PostgreSqlDriver>;
  let queue: Queue;
  let api: ChildProcess;
  let python: ChildProcess;
  let url: string;
  let uploads: string;
  let control: string;
  let childEnv: NodeJS.ProcessEnv;
  let logs = '';

  function capture(child: ChildProcess) {
    child.stderr?.on('data', (chunk) => {
      logs = (logs + String(chunk)).slice(-6000);
    });
    return child;
  }

  async function startApi(redisPort = childEnv.REDIS_PORT) {
    api = capture(
      fork(join(apiDir, 'test/queue-api.fixture.ts'), [], {
        cwd: apiDir,
        env: { ...childEnv, REDIS_PORT: redisPort },
        execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'],
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      }),
    );
    const message = await Promise.race([
      once(api, 'message').then(([value]) => value as { port: number }),
      once(api, 'exit').then(() => {
        throw new Error(`Nest failed to start: ${logs}`);
      }),
    ]);
    url = `http://127.0.0.1:${message.port}`;
  }

  async function stop(
    child?: ChildProcess,
    signal: NodeJS.Signals = 'SIGTERM',
  ) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill(signal);
    await exited;
  }

  function startPython() {
    python = capture(
      spawn(
        process.env.QUEUE_TEST_PYTHON || join(aiDir, '.venv/bin/python'),
        ['queue_test_worker.py'],
        { cwd: aiDir, env: childEnv, stdio: ['ignore', 'ignore', 'pipe'] },
      ),
    );
    return once(python, 'spawn');
  }

  async function mode(value: string, seconds = 0.1) {
    await writeFile(control, JSON.stringify({ mode: value, delay: seconds }));
  }

  async function waitFor<T>(
    read: () => Promise<T>,
    accept: (value: T) => boolean,
    timeout = 30000,
  ): Promise<T> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = await read();
      if (accept(value)) return value;
      await delay(50);
    }
    throw new Error(`Timed out waiting for queue state. ${logs}`);
  }

  async function row(id: number) {
    const rows = await orm.em.getConnection().execute<
      Array<{
        embedding_status: string;
        embedding: string | null;
        embedding_model: string | null;
        embedding_fallback_used: boolean | null;
      }>
    >(`select embedding_status, embedding::text, embedding_model, embedding_fallback_used from "${schema}".lost_pets where id = ?`, [id]);
    return rows[0];
  }

  async function ready(id: number) {
    return waitFor(
      () => row(id),
      (r) => r.embedding_status === 'ready',
      90000,
    );
  }

  async function upload(name: string, photo?: Buffer): Promise<Report> {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      name,
      type: 'cat',
      email: 'queue-test@example.com',
      latitude: '45.75',
      longitude: '21.23',
    }))
      form.set(key, value);
    if (photo)
      form.append(
        'photos',
        new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }),
        'cat.jpg',
      );
    const response = await fetch(`${url}/lost-pets`, {
      method: 'POST',
      body: form,
    });
    expect(response.status).toBe(201);
    return response.json() as Promise<Report>;
  }

  async function events() {
    return (
      await readFile(control.replace(/\.json$/, '.events'), 'utf8').catch(
        () => '',
      )
    )
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { file: string; attempt: number });
  }

  beforeAll(async () => {
    uploads = await mkdtemp(join(tmpdir(), 'pawsrescue-python-queue-'));
    control = join(uploads, 'control.json');
    await mode('success');
    childEnv = {
      ...process.env,
      USE_MOCK_DATA: 'false',
      QUEUE_PREFIX: schema,
      QUEUE_TEST_SCHEMA: schema,
      DB_SCHEMA: schema,
      UPLOAD_DIR: uploads,
      QUEUE_TEST_CONTROL: control,
      PYTHONUNBUFFERED: '1',
      REDIS_PORT: process.env.QUEUE_TEST_REDIS_PORT || '6379',
    };
    orm = await MikroORM.init<PostgreSqlDriver>({
      ...dbConfig,
      entities: [LostPetEntity],
      entitiesTs: [LostPetEntity],
      schema,
      debug: false,
      pool: {
        min: 1,
        max: 1,
        afterCreate: (
          connection: {
            query: (sql: string, cb: (error: Error | null) => void) => void;
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
    // Shared extension types must outlive the disposable test schema. On a
    // fresh database migrations would otherwise install vector inside it.
    await orm.em
      .getConnection()
      .execute('create extension if not exists vector with schema public');
    await orm.em.getConnection().execute(`create schema "${schema}"`);
    await orm.getMigrator().up();
    await orm.getMigrator().up();
    queue = new Queue('pet-embeddings', {
      prefix: schema,
      connection: {
        host: childEnv.REDIS_HOST || '127.0.0.1',
        port: Number(childEnv.REDIS_PORT),
        password: childEnv.REDIS_PASSWORD || undefined,
      },
    });
    await startApi();
    await startPython();
  }, 60000);

  afterAll(async () => {
    await stop(api);
    await stop(python);
    await queue?.obliterate({ force: true });
    await queue?.close();
    if (orm) {
      await orm.em
        .getConnection()
        .execute(`drop schema if exists "${schema}" cascade`);
      await orm.close(true);
    }
    if (uploads) await rm(uploads, { recursive: true, force: true });
  });

  it('processes concurrent uploads in Python and keeps their vectors separate', async () => {
    await queue.pause();
    const reports = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        upload(`Cat ${i}`, Buffer.from('fixture')),
      ),
    );
    expect(reports.every((r) => r.embeddingStatus === 'pending')).toBe(true);
    expect(new Set(reports.map((r) => r.id)).size).toBe(12);
    await queue.resume();
    await Promise.all(reports.map((r) => ready(r.id)));
    const vectors = await Promise.all(reports.map((r) => row(r.id)));
    expect(new Set(vectors.map((r) => r.embedding)).size).toBe(12);
    const jobs = await Promise.all(
      reports.map((r) => queue.getJob(`embed-pet-${r.id}`)),
    );
    const timings = jobs
      .map((j) => ({ start: j!.processedOn!, end: j!.finishedOn! }))
      .sort((a, b) => a.start - b.start);
    for (let i = 1; i < timings.length; i++)
      expect(timings[i].start).toBeGreaterThanOrEqual(timings[i - 1].end);
  });

  it('deduplicates scheduling and skips inference when a committed report is delivered again', async () => {
    const report = await upload('Deduplication', Buffer.from('fixture'));
    await Promise.all(
      Array.from({ length: 10 }, () =>
        queue.add(
          'generate-embedding',
          { petId: report.id },
          { jobId: `embed-pet-${report.id}` },
        ),
      ),
    );
    const first = await ready(report.id);
    const before = (await events()).length;
    const replay = await queue.add(
      'generate-embedding',
      { petId: report.id },
      { jobId: `replay-${report.id}` },
    );
    await waitFor(
      () => replay.getState(),
      (state) => state === 'completed',
    );
    expect((await events()).length).toBe(before);
    expect((await row(report.id)).embedding).toBe(first.embedding);
  });

  it('retries transient model failures', async () => {
    await mode('transient');
    const report = await upload('Retry', Buffer.from('fixture'));
    await ready(report.id);
    expect(
      (await events()).filter((e) => e.file === basename(report.imageUrls[0]))
        .length,
    ).toBe(2);
    await mode('success');
  });

  it.each(['unavailable', 'fallback', 'invalid'])(
    'handles %s without indexing a bad vector',
    async (failure) => {
      await mode(failure);
      const report = await upload(failure, Buffer.from('fixture'));
      const result = await waitFor(
        () => row(report.id),
        (r) => r.embedding_status === 'failed',
      );
      expect(result.embedding).toBeNull();
      expect(
        (await events()).filter((e) => e.file === basename(report.imageUrls[0]))
          .length,
      ).toBe(failure === 'invalid' ? 1 : 3);
      await mode('success');
    },
  );

  it('does not queue a report without photos', async () => {
    const report = await upload('No photos');
    expect(report.embeddingStatus).toBe('none');
    expect(await queue.getJob(`embed-pet-${report.id}`)).toBeUndefined();
  });

  it('recovers a saved report when the producer could not reach Redis', async () => {
    await stop(python);
    await stop(api);
    await startApi('1');
    const report = await upload('Redis unavailable', Buffer.from('fixture'));
    expect(report.embeddingStatus).toBe('pending');
    await stop(api);
    await startApi();
    await startPython();
    await ready(report.id);
  });

  it('Python saves the embedding and completes the job after Nest is killed mid-processing', async () => {
    await mode('success', 2);
    const report = await upload('Survives API crash', Buffer.from('fixture'));
    await waitFor(
      () => events(),
      (values) => values.some((e) => e.file === basename(report.imageUrls[0])),
    );
    await stop(api, 'SIGKILL');
    await expect(fetch(`${url}/lost-pets/${report.id}`)).rejects.toThrow();
    const result = await ready(report.id); // Read Postgres directly: Nest stays dead.
    expect(result.embedding_model).toBe('queue-test-model');
    const job = await queue.getJob(`embed-pet-${report.id}`);
    await waitFor(
      () => job!.getState(),
      (state) => state === 'completed',
    );
    expect(api.signalCode).toBe('SIGKILL');
    await startApi();
    await mode('success');
  });

  (process.env.QUEUE_TEST_REAL_AI === 'true' ? it : it.skip)(
    'finishes a real cat photo with Nest stopped',
    async () => {
      await mode('real', 1);
      const photo = await readFile(
        join(apiDir, 'uploads/demo-unsplash-1511044568932-338cba0ad803.jpg'),
      );
      const report = await upload('Real AI, no Nest', photo);
      await waitFor(
        () => events(),
        (values) =>
          values.some((e) => e.file === basename(report.imageUrls[0])),
      );
      await stop(api, 'SIGKILL');
      const result = await ready(report.id);
      expect(result.embedding_model).toContain('dinov2');
      expect(result.embedding_fallback_used).toBe(false);
      expect(JSON.parse(result.embedding!) as number[]).toHaveLength(1024);
      const job = await queue.getJob(`embed-pet-${report.id}`);
      await waitFor(
        () => job!.getState(),
        (state) => state === 'completed',
      );
      expect(api.signalCode).toBe('SIGKILL');
      await startApi();
      await mode('success');
    },
  );

  it('preserves photos belonging to saved reports', async () => {
    const photos = (await readdir(uploads)).filter((name) =>
      name.endsWith('.jpg'),
    );
    expect(photos.length).toBeGreaterThanOrEqual(19);
  });
});
