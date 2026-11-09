import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/postgresql';
import { UploadedPhoto } from '../uploads/uploaded-photo.type';

jest.mock('supercluster', () => {
  return jest.fn().mockImplementation(() => ({
    load: jest.fn(),
    getClusters: jest.fn(() => []),
    getClusterExpansionZoom: jest.fn(() => 12),
  }));
});

import { LostPetsService } from './lost-pets.service';
import { LostPetEntity } from './lost-pets.entity';
import { EmbeddingQueueService } from '../embeddings/embedding-queue.service';

describe('LostPetsService', () => {
  let service: LostPetsService;

  const repository = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const execute = jest.fn();
  const enqueue = jest.fn();
  const entityManager = {
    getConnection: jest.fn(() => ({
      execute,
    })),
    persistAndFlush: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.USE_MOCK_DATA = 'true';
    process.env.AI_SERVICE_URL = 'http://localhost:8000';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LostPetsService,
        { provide: EmbeddingQueueService, useValue: { enqueue } },
        {
          provide: getRepositoryToken(LostPetEntity),
          useValue: repository,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
      ],
    }).compile();

    service = module.get(LostPetsService);
  });

  afterEach(() => {
    delete process.env.USE_MOCK_DATA;
    delete process.env.AI_SERVICE_URL;
    jest.restoreAllMocks();
  });

  it('returns normalized mock pets for list and detail views', async () => {
    const pets = await service.findAll();
    const pet = await service.findOne(9001);

    expect(pets).toHaveLength(3);
    expect(pets[0]).toMatchObject({
      id: 9001,
      name: 'Mimi',
      imageUrls: [],
      embeddingInfo: null,
    });
    expect(pet).toMatchObject({
      id: 9001,
      city: 'Bucuresti',
      rawLocation: 'Piata Romana',
      embeddingInfo: null,
    });
  });

  it('returns the same match response shape in mock mode', async () => {
    const result = await service.match([buildPhoto('/tmp/mock.jpg')], 'Cluj');

    expect(result).toMatchObject({
      mode: 'mock',
      queryEmbedding: null,
    });
    expect(result.matches).toEqual([
      expect.objectContaining({
        id: 9002,
        name: 'Rex',
        city: 'Cluj',
        imageUrl: null,
      }),
    ]);
  });

  it('normalizes real list/detail records and surfaces embedding metadata', async () => {
    process.env.USE_MOCK_DATA = 'false';
    repository.findAll.mockResolvedValue([buildEntity()]);
    repository.findOne.mockResolvedValue(buildEntity());

    const pets = await service.findAll();
    const pet = await service.findOne(1);

    expect(repository.findAll).toHaveBeenCalled();
    expect(repository.findOne).toHaveBeenCalledWith({ id: 1 });
    expect(pets[0]).toMatchObject({
      id: 1,
      latitude: 44.43,
      longitude: 26.1,
      imageUrls: ['/uploads/luna.jpg'],
      embeddingInfo: {
        model: 'timm:vit_base_patch16_224_dino+vit_base_patch8_224_dino',
        fallbackUsed: true,
        warning: 'offline fallback',
      },
    });
    expect(pet).toMatchObject({
      id: 1,
      name: 'Luna',
      embeddingInfo: {
        model: 'timm:vit_base_patch16_224_dino+vit_base_patch8_224_dino',
      },
    });
  });

  it('fills safe defaults for legacy real records with nullable fields', async () => {
    process.env.USE_MOCK_DATA = 'false';
    repository.findAll.mockResolvedValue([
      {
        ...buildEntity(),
        name: null,
        type: null,
        email: null,
        updatedAt: null,
      },
    ]);

    const pets = await service.findAll();

    expect(pets[0]).toMatchObject({
      name: 'Unknown pet',
      type: 'other',
      email: '',
    });
    expect(pets[0].updatedAt).toEqual(pets[0].createdAt);
  });

  it('returns a pending report without waiting for inference', async () => {
    process.env.USE_MOCK_DATA = 'false';

    const createdEntity = buildEntity();
    createdEntity.id = 21;
    createdEntity.embedding = undefined;
    createdEntity.embeddingModel = undefined;
    createdEntity.embeddingFallbackUsed = undefined;
    createdEntity.embeddingWarning = undefined;
    createdEntity.embeddingStatus = 'pending';
    repository.create.mockReturnValue(createdEntity);

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            model:
              'dinov3-cat-crop-v1:facebook/dinov3-vitl16-pretrain-lvd1689m',
            fallbackUsed: false,
            warning: null,
            embedding: Array.from({ length: 1024 }, (_, index) => index / 1000),
          }),
        ),
    } as Response);

    const result = await service.create(
      {
        name: 'Luna',
        type: 'dog',
        email: 'owner@example.com',
        latitude: 44.43,
        longitude: 26.1,
      },
      [buildPhoto('/shared-uploads/luna.jpg')],
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(21);
    expect(result).toMatchObject({
      embeddingStatus: 'pending',
      embeddingInfo: null,
    });
  });

  it('keeps a saved report and its photos when Redis is unavailable', async () => {
    process.env.USE_MOCK_DATA = 'false';

    const createdEntity = buildEntity();
    createdEntity.id = 22;
    createdEntity.embedding = undefined;
    createdEntity.embeddingModel = undefined;
    createdEntity.embeddingFallbackUsed = undefined;
    createdEntity.embeddingWarning = undefined;
    createdEntity.embeddingStatus = 'pending';
    repository.create.mockReturnValue(createdEntity);

    enqueue.mockRejectedValueOnce(new Error('Redis down'));
    (
      service as unknown as {
        logger: { error: (...args: unknown[]) => void };
      }
    ).logger.error = jest.fn();

    const result = await service.create(
      {
        name: 'Luna',
        type: 'dog',
        email: 'owner@example.com',
        latitude: 44.43,
        longitude: 26.1,
      },
      [buildPhoto('/shared-uploads/luna.jpg')],
    );

    expect(entityManager.persistAndFlush).toHaveBeenCalledWith(createdEntity);
    expect(result).toMatchObject({
      id: 22,
      embeddingStatus: 'pending',
      embeddingInfo: null,
    });
  });

  it('returns normalized real match results with query embedding metadata', async () => {
    process.env.USE_MOCK_DATA = 'false';

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            model: 'dinov2-cat-crop-v1:facebook/dinov2-small',
            fallbackUsed: false,
            warning: null,
            embedding: Array.from({ length: 1024 }, (_, index) => index / 1000),
          }),
        ),
      json: () =>
        Promise.resolve({
          model: 'dinov2-cat-crop-v1:facebook/dinov2-small',
          fallbackUsed: false,
          warning: null,
          embedding: Array.from({ length: 1024 }, (_, index) => index / 1000),
        }),
    } as Response);

    execute.mockResolvedValue([
      {
        id: 11,
        name: 'Pufi',
        type: 'cat',
        city: 'Bucuresti',
        imageUrls: ['/uploads/pufi.jpg'],
        latitude: '44.4400',
        longitude: '26.1000',
        score: '0.052',
      },
    ]);

    const result = await service.match(
      [buildPhoto('/shared-uploads/pufi.jpg')],
      'Bucuresti',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/embed',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(execute).toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('"embedding" <=> ?::vector'),
      expect.arrayContaining(['dinov2-cat-crop-v1:facebook/dinov2-small']),
    );
    expect(result).toMatchObject({
      mode: 'real',
      queryEmbedding: {
        model: 'dinov2-cat-crop-v1:facebook/dinov2-small',
        fallbackUsed: false,
        warning: null,
      },
      matches: [
        {
          id: 11,
          imageUrl: '/uploads/pufi.jpg',
          latitude: 44.44,
          longitude: 26.1,
          score: 0.052,
        },
      ],
    });
  });
  it.each([
    { latitude: null },
    { latitude: '' },
    { longitude: 181 },
    { latitude: -91 },
    { type: 'dragon' },
    { email: 'invalid' },
    { name: { value: 'cat' } },
    { description: 'x'.repeat(1001) },
  ])('rejects invalid report input before persistence: %j', async (invalid) => {
    await expect(
      service.create({
        name: 'Pufi',
        type: 'cat',
        email: 'a@example.com',
        latitude: 45,
        longitude: 21,
        ...invalid,
      } as never),
    ).rejects.toMatchObject({ status: 400 });
    expect(entityManager.persistAndFlush).not.toHaveBeenCalled();
  });

  it('returns 400 for missing and invalid cluster query parameters', async () => {
    await expect(
      service.getClusters(undefined as never, '10'),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.getClusters('0,0,1,1', 'NaN')).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.getClusters('0,0,Infinity,1', '10'),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.getClustersForTile(5, 1, 1, '999999'),
    ).rejects.toMatchObject({ status: 400 });
  });

  function mockEmbedding(fallbackUsed = false) {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            model: fallbackUsed
              ? 'fallback-hybrid'
              : 'dinov2-cat-crop-v1:facebook/dinov2-small',
            fallbackUsed,
            embedding: Array(1024).fill(0.1),
          }),
        ),
    } as Response);
  }

  it('returns an empty result instead of filling the list with distant photos', async () => {
    process.env.USE_MOCK_DATA = 'false';
    mockEmbedding();
    execute.mockResolvedValue([
      { id: 1, score: 0.8 },
      { id: 2, score: 1.1 },
    ]);
    const result = await service.match([buildPhoto('/tmp/cat.jpg')]);
    expect(result.matches).toEqual([]);
    expect(result.queryEmbedding?.fallbackUsed).toBe(false);
  });

  it('returns 503 rather than matching fabricated fallback vectors', async () => {
    process.env.USE_MOCK_DATA = 'false';
    mockEmbedding(true);
    await expect(
      service.match([buildPhoto('/tmp/cat.jpg')]),
    ).rejects.toMatchObject({ status: 503 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns 503 when the AI service cannot be reached', async () => {
    process.env.USE_MOCK_DATA = 'false';
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('unavailable'));
    await expect(
      service.match([buildPhoto('/tmp/cat.jpg')]),
    ).rejects.toMatchObject({ status: 503 });
  });
});

function buildPhoto(path: string): UploadedPhoto {
  return {
    fieldname: 'photos',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    destination: '/tmp',
    filename: 'photo.jpg',
    path,
    size: 1234,
  };
}

function buildEntity(): LostPetEntity {
  return {
    id: 1,
    name: 'Luna',
    type: 'dog',
    email: 'owner@example.com',
    phone: '0700000000',
    description: 'Brown dog near the park.',
    city: 'Bucuresti',
    rawLocation: 'Parc',
    latitude: 44.43,
    longitude: 26.1,
    imageUrls: ['/uploads/luna.jpg'],
    embedding: '[0.1,0.2,0.3]',
    embeddingStatus: 'ready',
    embeddingModel: 'timm:vit_base_patch16_224_dino+vit_base_patch8_224_dino',
    embeddingFallbackUsed: true,
    embeddingWarning: 'offline fallback',
    createdAt: new Date('2026-06-11T08:00:00.000Z'),
    updatedAt: new Date('2026-06-11T08:00:00.000Z'),
  };
}
