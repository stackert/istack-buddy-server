import { Injectable } from '@nestjs/common';
import { CreateIstackBuddyDataProxyDto } from './dto/create-istack-buddy-data-proxy.dto';
import { UpdateIstackBuddyDataProxyDto } from './dto/update-istack-buddy-data-proxy.dto';

@Injectable()
export class IstackBuddyDataProxyService {
  create(createIstackBuddyDataProxyDto: CreateIstackBuddyDataProxyDto) {
    return 'This action adds a new istackBuddyDataProxy';
  }

  findAll() {
    return `This action returns all istackBuddyDataProxy`;
  }

  findOne(id: number) {
    return `This action returns a #${id} istackBuddyDataProxy`;
  }

  update(id: number, updateIstackBuddyDataProxyDto: UpdateIstackBuddyDataProxyDto) {
    return `This action updates a #${id} istackBuddyDataProxy`;
  }

  remove(id: number) {
    return `This action removes a #${id} istackBuddyDataProxy`;
  }
}
