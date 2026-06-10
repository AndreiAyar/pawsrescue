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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ensureUploadsDir } from '../uploads/upload-config';
import { UploadedPhoto } from '../uploads/uploaded-photo.type';
import { LostPetsService } from './lost-pets.service';
import { LostPetDTO } from './dtos/lost-pet.dto';

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]);

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
  @UseInterceptors(
    FilesInterceptor('photos', 4, {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const uploadsDir = ensureUploadsDir();
          callback(null, uploadsDir);
        },
        filename: (_request, file, callback) => {
          const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const extension = extname(file.originalname || '').toLowerCase() || '.jpg';
          callback(null, `${uniquePrefix}${extension}`);
        },
      }),
      fileFilter: (_request, file, callback) => {
        callback(null, ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype.toLowerCase()));
      },
      limits: {
        files: 4,
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  create(
    @Body() lostPet: LostPetDTO,
    @UploadedFiles() photos: UploadedPhoto[] = [],
  ) {
    return this.lostPetsService.create(lostPet, photos);
  }
}
