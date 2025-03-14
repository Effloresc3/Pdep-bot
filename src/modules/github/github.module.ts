import { Module } from '@nestjs/common';
import { IssuesService } from './services/issues.service';
import { GithubController } from './controllers/github.controller';
import { DiscordModule } from '@app/modules/discord/discord.module';
import { GoogleModule } from '@app/modules/google/google.module';

@Module({
  imports: [DiscordModule, GoogleModule],
  controllers: [GithubController],
  providers: [IssuesService],
})
export class GithubModule {}
