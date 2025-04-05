import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { DiscordInfo } from '@app/modules/discord/entities/discordInfo.entity';
import { DiscordInfoService } from '@app/modules/discord/services/discordInfo.service';

@Controller('information')
export class DiscordInfoController {
  constructor(private discordInfoService: DiscordInfoService) {}

  @Post('')
  @HttpCode(200)
  async createInformation(@Body() body: DiscordInfo) {
    return await this.discordInfoService.create(body);
  }
}
