import { Module } from '@nestjs/common';
import { OauthController } from './controllers/oauth.controller';
import { DiscordService } from './services/discord.service';
import { OauthService } from './services/oauth.service';
import { InteractionsController } from './controllers/interactions.controller';
import { InteractionsService } from './services/interactions.service';
import { HttpModule } from '@app/common/http.module';

@Module({
  imports: [HttpModule],
  controllers: [OauthController, InteractionsController],
  providers: [DiscordService, InteractionsService, OauthService],
  exports: [DiscordService],
})
export class DiscordModule {}
