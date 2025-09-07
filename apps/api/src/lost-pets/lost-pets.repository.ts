import { EntityRepository } from '@mikro-orm/core';
import { LostPetEntity } from './lost-pets.entity';

export class LostPetsRepository extends EntityRepository<LostPetEntity> {
  // Custom methods can be added here
}
