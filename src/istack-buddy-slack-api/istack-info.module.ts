import { Module, Global } from '@nestjs/common';
import { Redis } from 'ioredis';
import { IStackInfoService } from './istack-info.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        redis.on('connect', () => {
          console.log('Redis connected for IStackInfoService');
        });

        redis.on('error', (err) => {
          console.error('Redis connection error for IStackInfoService:', err);
        });

        return redis;
      },
    },
    {
      provide: IStackInfoService,
      useFactory: (redisClient: Redis) => {
        return new IStackInfoService(redisClient);
      },
      inject: ['REDIS_CLIENT'],
    },
  ],
  exports: [IStackInfoService],
})
export class IStackInfoModule {}
