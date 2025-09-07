import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LostPetsModule } from './lost-pets/lost-pets.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import db_config from 'mikro-orm.config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MikroOrmModule.forRoot(db_config),
    ConfigModule.forRoot({
      envFilePath: ['.env.development.local', '.env.development'],
      isGlobal: true,
    }),
    LostPetsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
