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

const { LostPetsService } = require('./lost-pets.service') as typeof import('./lost-pets.service');
const { LostPetEntity } = require('./lost-pets.entity') as typeof import('./lost-pets.entity');

describe('LostPetsService', () => {
  let service: LostPetsService;

  const repository = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const execute = jest.fn();
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

  it('returns embedding metadata immediately after a real create with photos', async () => {
    process.env.USE_MOCK_DATA = 'false';

    const createdEntity = buildEntity();
    createdEntity.id = 21;
    createdEntity.embedding = undefined;
    createdEntity.embeddingModel = undefined;
    createdEntity.embeddingFallbackUsed = undefined;
    createdEntity.embeddingWarning = undefined;
    repository.create.mockReturnValue(createdEntity);

    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          model: 'transformers:facebook/dinov3-vitl16-pretrain-lvd1689m',
          fallbackUsed: false,
          warning: null,
          embedding: Array.from({ length: 768 }, (_, index) => index / 1000),
        }),
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

    expect(fetchMock).toHaveBeenCalled();
    expect(result.embeddingInfo).toMatchObject({
      model: 'transformers:facebook/dinov3-vitl16-pretrain-lvd1689m',
      fallbackUsed: false,
      warning: null,
    });
  });

  it('returns normalized real match results with query embedding metadata', async () => {
    process.env.USE_MOCK_DATA = 'false';

    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          model: 'fallback-hybrid',
          fallbackUsed: true,
          warning: 'model download unavailable',
          embedding: Array.from({ length: 768 }, (_, index) => index / 1000),
        }),
      json: async () => ({
        model: 'fallback-hybrid',
        fallbackUsed: true,
        warning: 'model download unavailable',
        embedding: Array.from({ length: 768 }, (_, index) => index / 1000),
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
    expect(result).toMatchObject({
      mode: 'real',
      queryEmbedding: {
        model: 'fallback-hybrid',
        fallbackUsed: true,
        warning: 'model download unavailable',
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
    embeddingModel: 'timm:vit_base_patch16_224_dino+vit_base_patch8_224_dino',
    embeddingFallbackUsed: true,
    embeddingWarning: 'offline fallback',
    createdAt: new Date('2026-06-11T08:00:00.000Z'),
    updatedAt: new Date('2026-06-11T08:00:00.000Z'),
  } as LostPetEntity;
}
