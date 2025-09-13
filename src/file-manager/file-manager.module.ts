import { Module } from '@nestjs/common';
import { FileManagerService } from './file-manager.service';
import { FileController } from './file-controller';

@Module({
  controllers: [FileController],
  providers: [FileManagerService],
  exports: [FileManagerService],
})
export class FileManagerModule {}
