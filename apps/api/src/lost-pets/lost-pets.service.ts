import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { LostPetEntity } from './lost-pets.entity';
import { EntityRepository } from '@mikro-orm/core';
import { LostPetDTO } from './dtos/lost-pet.dto';
import { EntityManager } from '@mikro-orm/postgresql';

@Injectable()
export class LostPetsService {
  constructor(
    @InjectRepository(LostPetEntity)
    private readonly lostPetsRepository: EntityRepository<LostPetEntity>,
    private readonly em: EntityManager,
  ) {}

  async create(pet: LostPetDTO) {
    // const createdPet = this.lostPetsRepository.create({
    //   name: pet.name,
    //   location: pet.location,
    // });
    // await this.em.persistAndFlush(createdPet);
    // return createdPet;
  }

  async findAll(): Promise<LostPetEntity[]> {
    return await this.lostPetsRepository.findAll();
  }
}
