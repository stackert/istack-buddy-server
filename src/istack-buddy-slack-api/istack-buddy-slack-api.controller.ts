import { Controller } from '@nestjs/common';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';

@Controller('istack-buddy-slack-api')
export class IstackBuddySlackApiController {
  constructor(
    private readonly istackBuddySlackApiService: IstackBuddySlackApiService,
  ) {}
}
