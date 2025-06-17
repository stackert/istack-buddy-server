import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { IstackBuddyDataProxyService } from './istack-buddy-data-proxy.service';
import { CreateIstackBuddyDataProxyDto } from './dto/create-istack-buddy-data-proxy.dto';
import { UpdateIstackBuddyDataProxyDto } from './dto/update-istack-buddy-data-proxy.dto';

@Controller('istack-buddy-data-proxy')
export class IstackBuddyDataProxyController {
  constructor(private readonly istackBuddyDataProxyService: IstackBuddyDataProxyService) {}

  @Post()
  create(@Body() createIstackBuddyDataProxyDto: CreateIstackBuddyDataProxyDto) {
    return this.istackBuddyDataProxyService.create(createIstackBuddyDataProxyDto);
  }

  @Get()
  findAll() {
    return this.istackBuddyDataProxyService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.istackBuddyDataProxyService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateIstackBuddyDataProxyDto: UpdateIstackBuddyDataProxyDto) {
    return this.istackBuddyDataProxyService.update(+id, updateIstackBuddyDataProxyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.istackBuddyDataProxyService.remove(+id);
  }
}
