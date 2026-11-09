import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';

@Injectable()
export class AppService {
  constructor(@Optional() private readonly orm?: MikroORM) {}

  getHello(): string {
    return 'PawsRescue API';
  }

  getHealth() {
    return { status: 'ok', service: 'api' };
  }

  async getReadiness() {
    try {
      if (!this.orm) throw new Error('Database is not configured');
      await this.orm.em.getConnection().execute('select 1');
      return { status: 'ready', service: 'api' };
    } catch {
      throw new ServiceUnavailableException(
        'Database is temporarily unavailable',
      );
    }
  }
}
