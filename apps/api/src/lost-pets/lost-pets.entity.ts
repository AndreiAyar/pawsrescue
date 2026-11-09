import {
  Entity,
  PrimaryKey,
  Property,
  EntityRepositoryType,
  Index,
} from '@mikro-orm/core';
import { LostPetsRepository } from './lost-pets.repository';

export type EmbeddingStatus =
  'none' | 'pending' | 'processing' | 'ready' | 'failed';

@Entity({
  tableName: 'lost_pets',
  repository: () => LostPetsRepository,
})
/**
 * Represents a lost pet entry in the system.
 *
 * Stores information about a lost pet, including its name, location details,
 * geographic coordinates (latitude and longitude), and timestamps for creation and updates.
 *
 * Location data is enriched using MapTiler's geocoding API for both forward and reverse geocoding.
 * See: https://docs.maptiler.com/cloud/api/geocoding/
 */

//npx mikro-orm migration:create
//npm run migration:up
export class LostPetEntity {
  [EntityRepositoryType]?: LostPetsRepository;

  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ type: 'text', nullable: true, length: 1000 })
  description?: string;

  @Property()
  type!: 'dog' | 'cat' | 'bird' | 'other';

  @Property()
  email!: string;

  @Property({ nullable: true })
  phone?: string;

  @Property({ type: 'json', nullable: true })
  imageUrls?: string[]; // Store multiple image URLs or paths, referencing file storage or another DB

  // Raw location input (user-provided address or location description)
  @Property({ nullable: true })
  rawLocation?: string;

  // Structured address components from MapTiler geocoding
  @Property({ nullable: true })
  streetAddress?: string;

  @Property({ nullable: true })
  @Index() // For city-based filtering
  city?: string;

  @Property({ nullable: true })
  @Index() // For regional filtering
  region?: string; // state/province/region

  @Property({ nullable: true })
  @Index() // For country-based filtering
  country?: string;

  @Property({ nullable: true })
  postalCode?: string;

  // Formatted address from MapTiler response
  @Property({ nullable: true })
  formattedAddress?: string;

  @Property({ nullable: true })
  placeName?: string; // MapTiler place name

  // Coordinates for mapping and proximity searches
  @Property({ type: 'decimal', precision: 10, scale: 8 })
  @Index() // Essential for proximity queries
  latitude!: number;

  @Property({ type: 'decimal', precision: 11, scale: 8 })
  @Index() // Essential for proximity queries
  longitude!: number;

  // Location metadata
  @Property({ nullable: true })
  locationAccuracy?: number; // Accuracy in meters if available

  @Property({ nullable: true })
  locationSource?: 'gps' | 'user_input' | 'maptiler_geocoded';

  // Store full MapTiler response for future reference
  @Property({ type: 'json', nullable: true })
  mapTilerData?: any;

  @Property({ type: 'text', nullable: true, columnType: 'vector(1024)' })
  embedding?: string;

  @Property({ nullable: true })
  embeddingModel?: string;

  @Property({ nullable: true })
  embeddingFallbackUsed?: boolean;

  @Property({ type: 'text', nullable: true })
  embeddingWarning?: string;

  @Property({ default: 'none', length: 20 })
  embeddingStatus: EmbeddingStatus = 'none';

  @Property({ onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ onUpdate: () => new Date() })
  updatedAt!: Date;
}
