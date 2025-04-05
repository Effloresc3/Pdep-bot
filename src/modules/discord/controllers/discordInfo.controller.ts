import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { DiscordInfo } from '@app/modules/discord/entities/discordInfo.entity';
import { DiscordInfoService } from '@app/modules/discord/services/discordInfo.service';

@Controller('information')
export class InteractionsController {
  constructor(private discordInfoService: DiscordInfoService) {}

  @Post('')
  @HttpCode(200)
  async handleInteraction(@Body() body: DiscordInfo) {
    return await this.discordInfoService.create(body);
  }
}
