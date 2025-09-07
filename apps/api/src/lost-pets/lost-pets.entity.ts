import {
  Entity,
  PrimaryKey,
  Property,
  EntityRepositoryType,
} from '@mikro-orm/core';
import { LostPetsRepository } from './lost-pets.repository';

@Entity({
  tableName: 'lost_pets',
  repository: () => LostPetsRepository,
})
export class LostPetEntity {
  [EntityRepositoryType]?: LostPetsRepository;

  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property()
  location!: string;

  @Property({ nullable: true })
  city?: string;

  @Property({ nullable: true })
  lat?: number;

  @Property({ nullable: true })
  lon?: number;

  @Property({ type: 'datetime', onCreate: () => new Date(), nullable: true })
  createdAt?: Date;

  @Property({ type: 'datetime', onUpdate: () => new Date(), nullable: true })
  updatedAt?: Date;
}
