import {
  Entity,
  PrimaryKey,
  Property,
  EntityRepositoryType,
  Index,
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
  @Index()
  country?: string;

  // Coordinates (from MapBox or user selection)
  @Property({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  @Index()
  latitude?: number;

  @Property({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  @Index()
  longitude?: number;

  @Property({ type: 'datetime', onCreate: () => new Date(), nullable: true })
  createdAt?: Date;

  @Property({ type: 'datetime', onUpdate: () => new Date(), nullable: true })
  updatedAt?: Date;
}
