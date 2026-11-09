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
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
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

const UPLOAD_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

function buildUploadFilename(file: { mimetype: string }, prefix = '') {
  const extension = UPLOAD_EXTENSION_BY_MIME_TYPE[file.mimetype.toLowerCase()];
  return `${prefix}${Date.now()}-${randomUUID()}${extension ?? '.jpg'}`;
}

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
          callback(null, buildUploadFilename(file));
        },
      }),
      fileFilter: (_request, file, callback) => {
        callback(
          null,
          ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype.toLowerCase()),
        );
      },
      limits: {
        files: 4,
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  async create(
    @Body() lostPet: LostPetDTO,
    @UploadedFiles() photos: UploadedPhoto[] = [],
  ) {
    try {
      return await this.lostPetsService.create(lostPet, photos);
    } catch (error) {
      await Promise.allSettled(photos.map((photo) => unlink(photo.path)));
      throw error;
    }
  }

  @Post('match')
  @UseInterceptors(
    FilesInterceptor('photos', 4, {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const uploadsDir = ensureUploadsDir();
          callback(null, uploadsDir);
        },
        filename: (_request, file, callback) => {
          callback(null, buildUploadFilename(file, 'match-'));
        },
      }),
      fileFilter: (_request, file, callback) => {
        callback(
          null,
          ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype.toLowerCase()),
        );
      },
      limits: {
        files: 4,
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  async match(
    @Body('city') city: string | undefined,
    @UploadedFiles() photos: UploadedPhoto[] = [],
  ) {
    try {
      return await this.lostPetsService.match(photos, city);
    } finally {
      await Promise.allSettled(photos.map((photo) => unlink(photo.path)));
    }
  }
}
