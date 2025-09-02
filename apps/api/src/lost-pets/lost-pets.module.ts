import { Module } from '@nestjs/common';
import { LostPetsController } from './lost-pets.controller';

@Module({
  imports: [],
  controllers: [LostPetsController],
  //providers: [LostPe],
})
export class LostPetsModule {}
