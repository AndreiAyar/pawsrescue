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

const MOCK_DATA = true;
@Injectable()
export class LostPetsService {
  constructor(
    @InjectRepository(LostPetEntity)
    private readonly lostPetsRepository: EntityRepository<LostPetEntity>,
    private readonly em: EntityManager,
  ) {}

  async create(pet: LostPetDTO) {
    const createdPet = this.lostPetsRepository.create({
      name: pet.name,
      latitude: pet.latitude,
      longitude: pet.longitude,
      type: pet.type,
      email: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.em.persistAndFlush(createdPet);
    return createdPet;
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
      if (MOCK_DATA) {
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
  async findAll(): Promise<LostPetEntity[]> {
    return await this.lostPetsRepository.findAll();
  }
}
