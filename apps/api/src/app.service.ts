import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'PawsRescue API';
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'api',
    };
  }
}
