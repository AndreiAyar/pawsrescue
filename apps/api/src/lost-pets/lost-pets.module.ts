import { Module } from '@nestjs/common';
import { LostPetsController } from './lost-pets.controller';
import { LostPetsService } from './lost-pets.service';

@Module({
  imports: [],
  controllers: [LostPetsController],
  providers: [LostPetsService],
})
export class LostPetsModule {}
