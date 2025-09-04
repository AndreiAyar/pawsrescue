import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { LostPetsService } from './lost-pets.service';
import { LostPetDTO } from './dtos/lost-pet.dto';
import { LostPet } from './interfaces/lostPet.interface';

@Controller('lost-pets')
export class LostPetsController {
  constructor(private lostPetsService: LostPetsService) {}
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): LostPet[] {
    return this.lostPetsService.findAll();
  }

  @Post()
  create(@Body() lostCat: LostPetDTO) {
    return this.lostPetsService.create(lostCat);
  }
}
