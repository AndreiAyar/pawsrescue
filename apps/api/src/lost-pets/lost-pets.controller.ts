import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { LostPetsService } from './lost-pets.service';
import { LostPetDTO } from './dtos/lost-pet.dto';
// import { LostPet } from './interfaces/lostPet.interface';

@Controller('lost-pets')
export class LostPetsController {
  constructor(private lostPetsService: LostPetsService) {}

  private static readonly CLUSTER_CACHE_CONTROL =
    'public, max-age=0, s-maxage=300, stale-while-revalidate=60';

  @Get('clusters')
  @Header('Cache-Control', LostPetsController.CLUSTER_CACHE_CONTROL)
  async getClusters(@Query('bbox') bbox: string, @Query('zoom') zoom: string) {
    return this.lostPetsService.getClusters(bbox, zoom);
  }

  @Get('clusters/tile/:z/:x/:y')
  @Header('Cache-Control', LostPetsController.CLUSTER_CACHE_CONTROL)
  async getClustersForTile(
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Query('buffer') buffer?: string,
  ) {
    return this.lostPetsService.getClustersForTile(z, x, y, buffer);
  }

  @Get()
  async findAll() {
    return this.lostPetsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const pet = await this.lostPetsService.findOne(id);
    if (!pet) {
      throw new NotFoundException(`Lost pet ${id} was not found`);
    }
    return pet;
  }

  @Post()
  create(@Body() lostPet: LostPetDTO) {
    return this.lostPetsService.create(lostPet);
  }
}
