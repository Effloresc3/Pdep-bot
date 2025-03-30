import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DiscordModule } from './modules/discord/discord.module';
import { GithubModule } from './modules/github/github.module';
import { GoogleModule } from '@app/modules/google/google.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DiscordModule,
    GithubModule,
    GoogleModule,
  ],
})
export class AppModule {}
