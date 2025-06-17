import { PartialType } from '@nestjs/mapped-types';
import { CreateIstackBuddyDataProxyDto } from './create-istack-buddy-data-proxy.dto';

export class UpdateIstackBuddyDataProxyDto extends PartialType(CreateIstackBuddyDataProxyDto) {}
