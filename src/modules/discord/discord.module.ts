import { Module } from '@nestjs/common';
import { DiscordService } from './services/discord.service';
import { InteractionsController } from './controllers/interactions.controller';
import { InteractionsService } from './services/interactions.service';
import { HttpModule } from '@app/common/http.module';

@Module({
  imports: [HttpModule],
  controllers: [InteractionsController],
  providers: [DiscordService, InteractionsService],
  exports: [DiscordService],
})
export class DiscordModule {}
