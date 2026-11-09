import { Module } from '@nestjs/common';
import { LostPetsController } from './lost-pets.controller';
import { LostPetsService } from './lost-pets.service';
import { LostPetEntity } from './lost-pets.entity';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmbeddingQueueService } from '../embeddings/embedding-queue.service';

@Module({
  imports: [MikroOrmModule.forFeature([LostPetEntity])],
  controllers: [LostPetsController],
  providers: [LostPetsService, EmbeddingQueueService],
})
export class LostPetsModule {}
