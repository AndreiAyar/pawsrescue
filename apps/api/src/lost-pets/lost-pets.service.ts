import { Injectable } from '@nestjs/common';
import { LostPet } from './interfaces/lostPet.interface';

@Injectable()
export class LostPetsService {
  private readonly pets: LostPet[] = [];

  create(pet: LostPet) {
    this.pets.push(pet);
  }

  findAll(): LostPet[] {
    return this.pets;
  }
}
