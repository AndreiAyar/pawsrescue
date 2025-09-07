import { Entity, PrimaryKey, Property, EntityRepositoryType } from '@mikro-orm/core';
import { LostPetsRepository } from './lost-pets.repository';

@Entity({ repository: () => LostPetsRepository })
export class LostPetEntity {
  [EntityRepositoryType]?: LostPetsRepository;

  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property()
  location!: string;
}
