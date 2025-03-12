import { Module } from '@nestjs/common';
import { IssuesService } from './services/issues.service';
import { GithubController } from './controllers/github.controller';
import { DiscordModule } from '@app/modules/discord/discord.module';

@Module({
  imports: [DiscordModule],
  controllers: [GithubController],
  providers: [IssuesService],
})
export class GithubModule {}
