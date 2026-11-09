import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { LostPetEntity, EmbeddingStatus } from './lost-pets.entity';
import { EmbeddingQueueService } from '../embeddings/embedding-queue.service';
import { EntityRepository } from '@mikro-orm/core';
import { LostPetDTO } from './dtos/lost-pet.dto';
import { EntityManager } from '@mikro-orm/postgresql';
import Supercluster from 'supercluster';
import { ClusteringResult, PetFeature } from './types';
import { tileToBbox } from './geo-tiles';
import { getMockClusters } from './mock-clusters';
import { existsSync } from 'fs';
import { basename, join } from 'path';
import { getUploadsDir, UPLOADS_ROUTE_PREFIX } from '../uploads/upload-config';
import { UploadedPhoto } from '../uploads/uploaded-photo.type';

const VECTOR_DIMENSIONS = 1024;

type EmbeddingResult = {
  embedding: number[];
  model: string;
  fallbackUsed: boolean;
  warning: string | null;
};

type AiEmbeddingResponse = {
  detail?: string;
  model?: string;
  embedding?: number[];
  fallbackUsed?: boolean;
  warning?: string;
};

type PetResponse = {
  id: number;
  name: string;
  type: string;
  email: string;
  phone: string | null;
  description: string | null;
  city: string | null;
  rawLocation: string | null;
  latitude: number;
  longitude: number;
  imageUrls: string[];
  embeddingStatus: EmbeddingStatus;
  embeddingInfo: {
    model: string;
    fallbackUsed: boolean;
    warning: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

type NormalizablePet = {
  id: number;
  name: string | null;
  type: LostPetEntity['type'] | null;
  email: string | null;
  phone?: string | null;
  description?: string | null;
  city?: string | null;
  rawLocation?: string | null;
  latitude: number;
  longitude: number;
  imageUrls?: string[] | null;
  embedding?: string | null;
  embeddingModel?: string | null;
  embeddingFallbackUsed?: boolean | null;
  embeddingWarning?: string | null;
  embeddingStatus?: EmbeddingStatus;
  createdAt: Date;
  updatedAt: Date | null;
};

type MatchResponse = {
  mode: 'mock' | 'real';
  queryEmbedding: {
    model: string;
    fallbackUsed: boolean;
    warning: string | null;
  } | null;
  matches: Array<{
    id: number;
    name: string;
    type: string;
    city: string | null;
    imageUrl: string | null;
    latitude: number;
    longitude: number;
    score: number;
  }>;
};

@Injectable()
export class LostPetsService {
  private readonly logger = new Logger(LostPetsService.name);

  constructor(
    @InjectRepository(LostPetEntity)
    private readonly lostPetsRepository: EntityRepository<LostPetEntity>,
    private readonly em: EntityManager,
    private readonly embeddings: EmbeddingQueueService,
  ) {}

  private normalizePet(pet: NormalizablePet): PetResponse {
    return {
      id: pet.id,
      name: pet.name ?? 'Unknown pet',
      type: pet.type ?? 'other',
      email: pet.email ?? '',
      phone: pet.phone ?? null,
      description: pet.description ?? null,
      city: pet.city ?? null,
      rawLocation: pet.rawLocation ?? null,
      latitude: Number(pet.latitude),
      longitude: Number(pet.longitude),
      imageUrls: pet.imageUrls ?? [],
      embeddingStatus:
        pet.embeddingStatus ?? (pet.embedding ? 'ready' : 'none'),
      embeddingInfo: pet.embedding
        ? {
            model: pet.embeddingModel ?? 'unknown',
            fallbackUsed: pet.embeddingFallbackUsed ?? false,
            warning: pet.embeddingWarning ?? null,
          }
        : null,
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt ?? pet.createdAt,
    };
  }

  private buildMatchResponse(
    mode: 'mock' | 'real',
    matches: MatchResponse['matches'],
    queryEmbedding: MatchResponse['queryEmbedding'] = null,
  ): MatchResponse {
    return {
      mode,
      queryEmbedding,
      matches,
    };
  }

  private isMockMode() {
    return process.env.USE_MOCK_DATA === 'true';
  }

  private getMockPets(): PetResponse[] {
    const mockPets: NormalizablePet[] = [
      {
        id: 9001,
        name: 'Mimi',
        type: 'cat',
        email: 'owner+mimi@example.com',
        phone: '0711111111',
        description: 'Pisica gri, prietenoasa, vazuta ultima data langa parc.',
        city: 'Bucuresti',
        rawLocation: 'Piata Romana',
        latitude: 44.4479,
        longitude: 26.0979,
        imageUrls: [],
        embedding: null,
        embeddingModel: null,
        embeddingFallbackUsed: null,
        embeddingWarning: null,
        createdAt: new Date('2026-06-08T10:00:00.000Z'),
        updatedAt: new Date('2026-06-08T10:00:00.000Z'),
      },
      {
        id: 9002,
        name: 'Rex',
        type: 'dog',
        email: 'owner+rex@example.com',
        phone: '0722222222',
        description: 'Caine maro, energic, cu zgarda neagra.',
        city: 'Cluj',
        rawLocation: 'Parcul Central',
        latitude: 46.7704,
        longitude: 23.5899,
        imageUrls: [],
        embedding: null,
        embeddingModel: null,
        embeddingFallbackUsed: null,
        embeddingWarning: null,
        createdAt: new Date('2026-06-07T14:30:00.000Z'),
        updatedAt: new Date('2026-06-07T14:30:00.000Z'),
      },
      {
        id: 9003,
        name: 'Cleo',
        type: 'cat',
        email: 'owner+cleo@example.com',
        phone: null,
        description: 'Pisica alba cu pete portocalii.',
        city: 'Iasi',
        rawLocation: 'Copou',
        latitude: 47.1739,
        longitude: 27.5748,
        imageUrls: [],
        embedding: null,
        embeddingModel: null,
        embeddingFallbackUsed: null,
        embeddingWarning: null,
        createdAt: new Date('2026-06-06T09:15:00.000Z'),
        updatedAt: new Date('2026-06-06T09:15:00.000Z'),
      },
    ];

    return mockPets.map((pet) => this.normalizePet(pet));
  }

  private buildStoredImageUrls(photos: UploadedPhoto[]) {
    return photos.map(
      (photo) => `${UPLOADS_ROUTE_PREFIX}/${basename(photo.filename)}`,
    );
  }

  private buildStoredImagePaths(photos: UploadedPhoto[]) {
    return photos.map((photo) => photo.path);
  }

  private buildVectorLiteral(embedding: number[]) {
    return `[${embedding.map((value) => Number(value).toFixed(6)).join(',')}]`;
  }

  private async saveEmbeddingForPet(
    id: number,
    embeddingResult: EmbeddingResult,
  ) {
    const vectorLiteral = this.buildVectorLiteral(embeddingResult.embedding);
    await this.em.getConnection().execute(
      `
        update "lost_pets"
        set
          "embedding" = ?::vector,
          "embedding_model" = ?,
          "embedding_fallback_used" = ?,
          "embedding_warning" = ?,
          "embedding_status" = 'ready',
          "updated_at" = now()
        where "id" = ?
      `,
      [
        vectorLiteral,
        embeddingResult.model,
        embeddingResult.fallbackUsed,
        embeddingResult.warning,
        id,
      ],
    );
  }

  private async requestEmbedding(imagePaths: string[]) {
    if (imagePaths.length === 0) {
      return null;
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL?.trim();
    const configuredTimeout = Number.parseInt(
      process.env.AI_REQUEST_TIMEOUT_MS || '180000',
      10,
    );
    const timeoutMs = Number.isFinite(configuredTimeout)
      ? configuredTimeout
      : 180000;
    if (!aiServiceUrl) {
      throw new InternalServerErrorException(
        'AI_SERVICE_URL is not configured',
      );
    }

    try {
      const response = await fetch(`${aiServiceUrl.replace(/\/$/, '')}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imagePaths }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const rawBody = await response.text();
      let data: AiEmbeddingResponse | null = null;

      if (rawBody) {
        try {
          data = JSON.parse(rawBody) as AiEmbeddingResponse;
        } catch {
          if (!response.ok) {
            throw new InternalServerErrorException(
              `AI service returned ${response.status} ${response.statusText}`,
            );
          }
          throw new InternalServerErrorException(
            'AI service returned an invalid JSON response',
          );
        }
      }

      if (response.status === 400 || response.status === 422) {
        throw new BadRequestException(
          'Use a valid JPG, PNG, GIF or WebP photo',
        );
      }
      if (response.status === 503) {
        throw new ServiceUnavailableException(
          'Photo search is temporarily unavailable',
        );
      }
      if (!response.ok || !Array.isArray(data?.embedding)) {
        throw new InternalServerErrorException(
          data?.detail || 'AI service failed to generate an embedding',
        );
      }

      if (
        data.embedding.length !== VECTOR_DIMENSIONS ||
        data.embedding.some(
          (value) => typeof value !== 'number' || !Number.isFinite(value),
        )
      ) {
        throw new InternalServerErrorException(
          'AI embedding dimensions are invalid',
        );
      }

      return {
        embedding: data.embedding.map((value) => Number(value)),
        model: data.model?.trim() || 'unknown',
        fallbackUsed: data.fallbackUsed === true,
        warning: data.warning?.trim() || null,
      } satisfies EmbeddingResult;
    } catch (error) {
      if (
        error instanceof InternalServerErrorException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.warn(
        `AI embedding request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'Photo search is temporarily unavailable',
      );
    }
  }

  async rebuildEmbeddings() {
    const pets = await this.lostPetsRepository.findAll();
    const result = {
      total: pets.length,
      updated: 0,
      skipped: 0,
      failed: [] as Array<{ id: number; reason: string }>,
    };

    for (const pet of pets) {
      const imagePaths = (pet.imageUrls ?? [])
        .map((imageUrl) => join(getUploadsDir(), basename(imageUrl)))
        .filter((imagePath) => existsSync(imagePath));

      if (imagePaths.length === 0) {
        result.skipped += 1;
        continue;
      }

      try {
        const embeddingResult = await this.requestEmbedding(imagePaths);
        if (!embeddingResult) {
          result.skipped += 1;
          continue;
        }

        await this.saveEmbeddingForPet(pet.id, embeddingResult);
        result.updated += 1;
      } catch (error) {
        result.failed.push({
          id: pet.id,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  async setEmbeddingStatus(id: number, status: EmbeddingStatus) {
    await this.em.getConnection().execute(
      `update "lost_pets" set "embedding_status" = ?, "updated_at" = now()
       where "id" = ? and "embedding_status" <> 'ready'`,
      [status, id],
    );
  }

  async processEmbedding(petId: number) {
    const pet = await this.lostPetsRepository.findOne({ id: petId });
    // Re-delivery and already rebuilt reports must not run inference again.
    if (!pet || pet.embeddingStatus === 'ready') return { petId };
    const imagePaths = (pet.imageUrls ?? []).map((url) =>
      join(getUploadsDir(), basename(url)),
    );
    if (!imagePaths.length) {
      await this.setEmbeddingStatus(petId, 'none');
      return { petId };
    }

    await this.setEmbeddingStatus(petId, 'processing');
    const result = await this.requestEmbedding(imagePaths);
    if (!result || result.fallbackUsed) {
      throw new ServiceUnavailableException('AI embedding is unavailable');
    }
    await this.saveEmbeddingForPet(petId, result);
    return { petId };
  }

  async recoverPendingEmbeddings() {
    const rows = await this.em.getConnection().execute<Array<{ id: number }>>(
      `select "id" from "lost_pets"
       where "embedding_status" in ('pending', 'processing')
       order by "updated_at", "id" limit 100`,
    );
    for (const { id } of rows) {
      const job = await this.embeddings.enqueue(id);
      if ((await job.getState()) === 'failed') {
        await this.setEmbeddingStatus(id, 'failed');
      }
    }
  }

  private getMockMatches(city?: string): MatchResponse['matches'] {
    return this.getMockPets()
      .filter(
        (pet) =>
          !city?.trim() ||
          pet.city?.toLowerCase() === city.trim().toLowerCase(),
      )
      .map((pet, index) => ({
        id: pet.id,
        name: pet.name,
        type: pet.type,
        city: pet.city,
        imageUrl: pet.imageUrls[0] ?? null,
        latitude: pet.latitude,
        longitude: pet.longitude,
        score: [0.042, 0.087, 0.131][index] ?? 0.2,
      }));
  }

  private validateCreateInput(pet: LostPetDTO) {
    const required = (value: unknown, label: string, max = 255) => {
      if (typeof value !== 'string' || !value.trim() || value.length > max) {
        throw new BadRequestException(
          `${label} must be a non-empty string (up to ${max} characters)`,
        );
      }
    };
    required(pet.name, 'Name');
    required(pet.email, 'Email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pet.email.trim())) {
      throw new BadRequestException('Enter a valid email address');
    }
    if (!['dog', 'cat', 'bird', 'other'].includes(pet.type)) {
      throw new BadRequestException('Choose a valid animal type');
    }
    for (const [label, value, max] of [
      ['Latitude', pet.latitude, 90],
      ['Longitude', pet.longitude, 180],
    ] as const) {
      if (
        (typeof value !== 'string' && typeof value !== 'number') ||
        String(value).trim() === '' ||
        !Number.isFinite(Number(value)) ||
        Math.abs(Number(value)) > max
      ) {
        throw new BadRequestException(
          `${label} must be between -${max} and ${max}`,
        );
      }
    }
    for (const [key, max] of [
      ['phone', 255],
      ['city', 255],
      ['rawLocation', 255],
      ['description', 1000],
    ] as const) {
      const value = pet[key];
      if (
        value !== undefined &&
        (typeof value !== 'string' || value.length > max)
      ) {
        throw new BadRequestException(
          `${key} must be a string of up to ${max} characters`,
        );
      }
    }
  }

  async create(pet: LostPetDTO, photos: UploadedPhoto[] = []) {
    this.validateCreateInput(pet);

    const uploadedImageUrls = this.buildStoredImageUrls(photos);

    const createdPet = this.lostPetsRepository.create({
      name: pet.name.trim(),
      latitude: Number(pet.latitude),
      longitude: Number(pet.longitude),
      type: pet.type,
      email: pet.email.trim(),
      phone: pet.phone?.trim() || undefined,
      description: pet.description?.trim() || undefined,
      city: pet.city?.trim() || undefined,
      rawLocation: pet.rawLocation?.trim() || undefined,
      imageUrls: uploadedImageUrls,
      embeddingStatus: photos.length > 0 ? 'pending' : 'none',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.em.persistAndFlush(createdPet);

    if (photos.length > 0) {
      try {
        await this.embeddings.enqueue(createdPet.id);
      } catch (error) {
        this.logger.error(
          `Pet ${createdPet.id} is saved; its pending embedding will be queued by recovery`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return this.normalizePet(createdPet);
  }
  async getClusters(
    bboxString: string,
    zoomString: string,
  ): Promise<ClusteringResult> {
    if (
      typeof bboxString !== 'string' ||
      typeof zoomString !== 'string' ||
      !zoomString.trim()
    ) {
      throw new BadRequestException('bbox and zoom are required');
    }
    const parts = bboxString.split(',');
    const bbox = parts.map(Number);
    const zoom = Number(zoomString);
    if (!Number.isInteger(zoom) || zoom < 0 || zoom > 24) {
      throw new BadRequestException('Invalid zoom level');
    }
    if (
      bbox.length !== 4 ||
      parts.some((value) => !value.trim()) ||
      bbox.some((value) => !Number.isFinite(value)) ||
      bbox[0] < -180 ||
      bbox[2] > 180 ||
      bbox[1] < -90 ||
      bbox[3] > 90 ||
      bbox[0] > bbox[2] ||
      bbox[1] > bbox[3]
    ) {
      throw new BadRequestException('Invalid bbox format');
    }

    try {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      if (this.isMockMode()) {
        return getMockClusters([minLng, minLat, maxLng, maxLat], zoom);
      }
      const pets = await this.lostPetsRepository.find(
        {
          latitude: { $gte: minLat, $lte: maxLat },
          longitude: { $gte: minLng, $lte: maxLng },
        },
        {
          fields: ['id', 'name', 'type', 'latitude', 'longitude'],
        },
      );

      const points: PetFeature[] = pets.map((pet) => ({
        type: 'Feature',
        properties: {
          id: pet.id,
          name: pet.name,
          type: pet.type as PetFeature['properties']['type'],
          status: 'lost',
        },
        geometry: {
          type: 'Point',
          coordinates: [Number(pet.longitude), Number(pet.latitude)],
        },
      }));

      const cluster = new Supercluster({
        radius: 60,
        maxZoom: 18,
      });

      cluster.load(points);

      const clusters = cluster.getClusters(
        [minLng, minLat, maxLng, maxLat],
        zoom,
      );
      const features = clusters.map((feature) => {
        const properties = feature.properties as
          | {
              cluster?: boolean;
              cluster_id?: number;
            }
          | undefined;
        if (properties?.cluster && typeof properties.cluster_id === 'number') {
          return {
            ...feature,
            properties: {
              ...feature.properties,
              expansion_zoom: cluster.getClusterExpansionZoom(
                properties.cluster_id,
              ),
            },
          };
        }
        return feature;
      });
      return {
        type: 'FeatureCollection',
        features: features as ClusteringResult['features'],
        meta: {
          count: features.length,
          zoom,
          bbox: [minLng, minLat, maxLng, maxLat],
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Clustering failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async getClustersForTile(
    zoom: number,
    x: number,
    y: number,
    buffer?: string,
  ): Promise<ClusteringResult> {
    if (!Number.isInteger(zoom) || zoom < 0 || zoom > 24) {
      throw new BadRequestException('Invalid zoom level');
    }
    const scale = Math.pow(2, zoom);
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= scale ||
      y >= scale
    ) {
      throw new BadRequestException('Invalid tile coordinates');
    }

    const bufferValue = buffer === undefined ? 1 : Number(buffer);
    if (!Number.isInteger(bufferValue) || bufferValue < 0 || bufferValue > 16) {
      throw new BadRequestException('Invalid tile buffer');
    }

    const bbox = tileToBbox({
      z: zoom,
      x,
      y,
      buffer: bufferValue,
    });

    return this.getClusters(bbox.join(','), String(zoom));
  }

  async findAll() {
    if (this.isMockMode()) {
      return this.getMockPets();
    }

    const pets = await this.lostPetsRepository.findAll({
      orderBy: { createdAt: 'desc' },
    });
    return pets.map((pet) => this.normalizePet(pet));
  }

  async findOne(id: number) {
    if (this.isMockMode()) {
      return this.getMockPets().find((pet) => pet.id === id) ?? null;
    }

    const pet = await this.lostPetsRepository.findOne({ id });
    if (!pet) {
      return null;
    }
    return this.normalizePet(pet);
  }

  async match(photos: UploadedPhoto[] = [], city?: string) {
    if (city !== undefined && (typeof city !== 'string' || city.length > 255)) {
      throw new BadRequestException(
        'City must be a string of up to 255 characters',
      );
    }
    if (photos.length === 0) {
      throw new BadRequestException('At least one photo is required');
    }

    if (this.isMockMode()) {
      return this.buildMatchResponse('mock', this.getMockMatches(city));
    }

    const embeddingResult = await this.requestEmbedding(
      this.buildStoredImagePaths(photos),
    );
    if (!embeddingResult) {
      return this.buildMatchResponse('real', []);
    }

    if (embeddingResult.fallbackUsed) {
      throw new ServiceUnavailableException(
        'Photo search is temporarily unavailable',
      );
    }
    const configuredDistance = Number(
      process.env.AI_MATCH_MAX_DISTANCE ?? '0.5',
    );
    const maxDistance =
      Number.isFinite(configuredDistance) &&
      configuredDistance >= 0 &&
      configuredDistance <= 2
        ? configuredDistance
        : 0.5;
    const vectorLiteral = this.buildVectorLiteral(embeddingResult.embedding);
    const params: (string | number)[] = [vectorLiteral, embeddingResult.model];
    let whereClause = 'where "embedding" is not null and "embedding_model" = ?';

    if (city?.trim()) {
      whereClause += ' and lower("city") = lower(?)';
      params.push(city.trim());
    }

    params.push(vectorLiteral);

    let rows: Array<{
      id: number;
      name: string;
      type: string;
      city: string | null;
      imageUrls: string[] | null;
      latitude: string | number;
      longitude: string | number;
      score: string | number;
    }>;

    try {
      rows = await this.em.getConnection().execute<typeof rows>(
        `
          select
            "id",
            "name",
            "type",
            "city",
            "image_urls" as "imageUrls",
            "latitude",
            "longitude",
            "embedding" <=> ?::vector as "score"
          from "lost_pets"
          ${whereClause}
          order by "embedding" <=> ?::vector asc
          limit 10
        `,
        params,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Match query failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.buildMatchResponse(
      'real',
      rows
        .filter(
          (row) =>
            Number.isFinite(Number(row.score)) &&
            Number(row.score) <= maxDistance,
        )
        .map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          city: row.city,
          imageUrl: row.imageUrls?.[0] ?? null,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          score: Number(row.score),
        })),
      {
        model: embeddingResult.model,
        fallbackUsed: embeddingResult.fallbackUsed,
        warning: embeddingResult.warning,
      },
    );
  }
}
