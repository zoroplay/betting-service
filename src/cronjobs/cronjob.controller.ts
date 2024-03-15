import { Controller, Get } from '@nestjs/common';

@Controller('cronjob')
export class CronjobController {
  constructor() {}

  @Get()
  async status() {
    return { status: 200, message: 'Ok' };
  }
}
