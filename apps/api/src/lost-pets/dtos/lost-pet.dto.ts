export class LostPetDTO {
  name!: string;
  type!: 'dog' | 'cat' | 'bird' | 'other';
  email!: string;
  latitude!: number;
  longitude!: number;
  description?: string;
  phone?: string;
  city?: string;
  rawLocation?: string;
  imageUrls?: string[];
}
