import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LostPetsModule } from './lost-pets/lost-pets.module';

@Module({
  imports: [LostPetsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
