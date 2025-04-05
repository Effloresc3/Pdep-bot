import { Module } from '@nestjs/common';
import { DiscordService } from './services/discord.service';
import { InteractionsController } from './controllers/interactions.controller';
import { InteractionsService } from './services/interactions.service';
import { HttpModule } from '@app/common/http.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscordInfo } from '@app/modules/discord/entities/discordInfo.entity';
import { DiscordInfoService } from '@app/modules/discord/services/discordInfo.service';
import { DiscordConnectionService } from '@app/modules/discord/services/discordConnection.service';
import { MessageService } from '@app/modules/discord/services/message.service';
import { DiscordConnection } from '@app/modules/discord/entities/discordConnections.entity';
import { Message } from '@app/modules/discord/entities/message.entity';
import { UserService } from '@app/modules/discord/services/user.service';
import { User } from '@app/modules/discord/entities/user.entity';
import { GoogleModule } from '@app/modules/google/google.module';
import { DiscordInfoController } from '@app/modules/discord/controllers/discordInfo.controller';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([DiscordInfo, DiscordConnection, Message, User]),
    GoogleModule,
  ],
  controllers: [InteractionsController, DiscordInfoController],
  providers: [
    DiscordService,
    InteractionsService,
    DiscordInfoService,
    DiscordConnectionService,
    MessageService,
    UserService,
  ],
  exports: [DiscordService, DiscordInfoService],
})
export class DiscordModule {}
