import { Controller, Get } from '@nestjs/common';

@Controller('lost-pets')
export class LostPetsController {
  @Get()
  findAll(): string {
    return 'Lots pets route';
  }
}
