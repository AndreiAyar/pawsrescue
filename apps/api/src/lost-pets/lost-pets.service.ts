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
  private cluster: Supercluster;

  constructor(
    @InjectRepository(LostPetEntity)
    private readonly lostPetsRepository: EntityRepository<LostPetEntity>,
    private readonly em: EntityManager,
  ) {
    this.initializeMockCluster();
  }

  private initializeMockCluster() {
    const points: PetFeature[] = Array.from({ length: 200_000 }, (_, i) => ({
      type: 'Feature' as const,
      properties: {
        id: i,
        name: `Pet ${i}`,
        type: ['cat', 'dog', 'bird'][i % 3] as 'cat' | 'dog' | 'bird',
        status: 'lost' as const,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [
          Math.random() * 360 - 180, // lng
          Math.random() * 180 - 90, // lat
        ],
      },
    }));

    // Create Supercluster instance
    this.cluster = new Supercluster({
      radius: 60,
      maxZoom: 18,
    });

    this.cluster.load(points);
  }

  async create(_pet: LostPetDTO) {
    // const createdPet = this.lostPetsRepository.create({
    //   name: pet.name,
    //   location: pet.location,
    // });
    // await this.em.persistAndFlush(createdPet);
    // return createdPet;
  }
  getMockClusters(bboxString: string, zoomString: string): ClusteringResult {
    const bbox = bboxString.split(',').map(Number);
    const zoom = Number(zoomString);

    if (bbox.length !== 4 || bbox.some(isNaN)) {
      throw new BadRequestException('Invalid bbox format');
    }

    try {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      const clusters = this.cluster.getClusters(
        [minLng, minLat, maxLng, maxLat],
        zoom,
      );
      return {
        type: 'FeatureCollection',
        features: clusters as ClusteringResult['features'],
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
