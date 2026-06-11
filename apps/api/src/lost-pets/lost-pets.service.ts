import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { LostPetEntity } from './lost-pets.entity';
import { EntityRepository } from '@mikro-orm/core';
import { LostPetDTO } from './dtos/lost-pet.dto';
import { EntityManager } from '@mikro-orm/postgresql';
import Supercluster from 'supercluster';
import { ClusteringResult, PetFeature } from './types';
import { tileToBbox } from './geo-tiles';
import { getMockClusters } from './mock-clusters';
import { basename } from 'path';
import { UPLOADS_ROUTE_PREFIX } from '../uploads/upload-config';
import { UploadedPhoto } from '../uploads/uploaded-photo.type';

const VECTOR_DIMENSIONS = 768;

type EmbeddingResult = {
  embedding: number[];
  model: string;
  fallbackUsed: boolean;
  warning: string | null;
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
  name: string;
  type: LostPetEntity['type'];
  email: string;
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
  createdAt: Date;
  updatedAt: Date;
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
  constructor(
    @InjectRepository(LostPetEntity)
    private readonly lostPetsRepository: EntityRepository<LostPetEntity>,
    private readonly em: EntityManager,
  ) {}

  private normalizePet(pet: NormalizablePet): PetResponse {
    return {
      id: pet.id,
      name: pet.name,
      type: pet.type,
      email: pet.email,
      phone: pet.phone ?? null,
      description: pet.description ?? null,
      city: pet.city ?? null,
      rawLocation: pet.rawLocation ?? null,
      latitude: Number(pet.latitude),
      longitude: Number(pet.longitude),
      imageUrls: pet.imageUrls ?? [],
      embeddingInfo: pet.embedding
        ? {
            model: pet.embeddingModel ?? 'unknown',
            fallbackUsed: pet.embeddingFallbackUsed ?? false,
            warning: pet.embeddingWarning ?? null,
          }
        : null,
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt,
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
    return process.env.USE_MOCK_DATA !== 'false';
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
    return photos.map((photo) => `${UPLOADS_ROUTE_PREFIX}/${basename(photo.filename)}`);
  }

  private buildStoredImagePaths(photos: UploadedPhoto[]) {
    return photos.map((photo) => photo.path);
  }

  private buildVectorLiteral(embedding: number[]) {
    return `[${embedding.map((value) => Number(value).toFixed(6)).join(',')}]`;
  }

  private async saveEmbeddingForPet(id: number, embeddingResult: EmbeddingResult) {
    const vectorLiteral = this.buildVectorLiteral(embeddingResult.embedding);
    await this.em.getConnection().execute(
      `
        update "lost_pets"
        set
          "embedding" = ?::vector,
          "embedding_model" = ?,
          "embedding_fallback_used" = ?,
          "embedding_warning" = ?
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
    if (!aiServiceUrl) {
      throw new InternalServerErrorException('AI_SERVICE_URL is not configured');
    }

    const response = await fetch(`${aiServiceUrl.replace(/\/$/, '')}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imagePaths }),
    });

    const data = (await response.json()) as {
      detail?: string;
      model?: string;
      embedding?: number[];
      fallbackUsed?: boolean;
      warning?: string;
    };

    if (!response.ok || !Array.isArray(data.embedding)) {
      throw new InternalServerErrorException(
        data.detail || 'AI service failed to generate an embedding',
      );
    }

    if (data.embedding.length !== VECTOR_DIMENSIONS) {
      throw new InternalServerErrorException('AI embedding dimensions are invalid');
    }

    return {
      embedding: data.embedding.map((value) => Number(value)),
      model: data.model?.trim() || 'unknown',
      fallbackUsed: data.fallbackUsed === true,
      warning: data.warning?.trim() || null,
    } satisfies EmbeddingResult;
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
    if (!pet.name?.trim()) {
      throw new BadRequestException('Name is required');
    }
    if (!pet.email?.trim()) {
      throw new BadRequestException('Email is required');
    }
    if (!pet.type) {
      throw new BadRequestException('Type is required');
    }
    if (!Number.isFinite(Number(pet.latitude))) {
      throw new BadRequestException('Latitude must be a valid number');
    }
    if (!Number.isFinite(Number(pet.longitude))) {
      throw new BadRequestException('Longitude must be a valid number');
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.em.persistAndFlush(createdPet);

    if (photos.length > 0) {
      const embeddingResult = await this.requestEmbedding(
        this.buildStoredImagePaths(photos),
      );
      if (embeddingResult) {
        await this.saveEmbeddingForPet(createdPet.id, embeddingResult);
        createdPet.embeddingModel = embeddingResult.model;
        createdPet.embeddingFallbackUsed = embeddingResult.fallbackUsed;
        createdPet.embeddingWarning = embeddingResult.warning ?? undefined;
      }
    }

    return this.normalizePet(createdPet);
  }
  async getClusters(
    bboxString: string,
    zoomString: string,
  ): Promise<ClusteringResult> {
    const bbox = bboxString.split(',').map(Number);
    const zoom = Number(zoomString);

    if (bbox.length !== 4 || bbox.some(isNaN)) {
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

    const bufferValue = buffer === undefined ? 1 : Number.parseInt(buffer, 10);
    if (!Number.isFinite(bufferValue) || bufferValue < 0) {
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

    const vectorLiteral = this.buildVectorLiteral(embeddingResult.embedding);
    const params: (string | number)[] = [vectorLiteral];
    let whereClause = 'where "embedding" is not null';

    if (city?.trim()) {
      whereClause += ' and lower("city") = lower(?)';
      params.push(city.trim());
    }

    params.push(vectorLiteral);

    const rows = (await this.em.getConnection().execute(
      `
        select
          "id",
          "name",
          "type",
          "city",
          "image_urls" as "imageUrls",
          "latitude",
          "longitude",
          "embedding" <-> ?::vector as "score"
        from "lost_pets"
        ${whereClause}
        order by "embedding" <-> ?::vector asc
        limit 10
      `,
      params,
    )) as Array<{
      id: number;
      name: string;
      type: string;
      city: string | null;
      imageUrls: string[] | null;
      latitude: string | number;
      longitude: string | number;
      score: string | number;
    }>;

    return this.buildMatchResponse(
      'real',
      rows.map((row) => ({
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
