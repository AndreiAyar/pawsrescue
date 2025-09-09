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
/**
 * Represents a lost pet entry in the system.
 * 
 * Stores information about a lost pet, including its name, location, city, country,
 * geographic coordinates (latitude and longitude), and timestamps for creation and updates.
 * 
 * Coordinates can be provided by the user or retrieved from MapBox geocoding services.
 */
export class LostPetEntity {
  [EntityRepositoryType]?: LostPetsRepository;
  //https://www.mapbox.com/geocoding -> see this to add more
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
