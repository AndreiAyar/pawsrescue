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
      return {
        type: 'FeatureCollection',
        features: clusters as ClusteringResult['features'],
        meta: {
          count: clusters.length,
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
  async findAll(): Promise<LostPetEntity[]> {
    return await this.lostPetsRepository.findAll();
  }
}
