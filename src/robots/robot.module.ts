import { Global, Module } from '@nestjs/common';
import { RobotService } from './robot.service';

@Global()
@Module({
  providers: [RobotService],
  exports: [RobotService],
})
export class RobotModule {}
