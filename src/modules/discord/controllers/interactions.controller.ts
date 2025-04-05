import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { InteractionResponseType, verifyKey } from 'discord-interactions';
import { InteractionsService } from '../services/interactions.service';
import { InteractionType } from 'discord-api-types/v10';
import { DiscordInteraction } from '../models/discord-interaction';

@Controller('interactions')
export class InteractionsController {
  private readonly logger = new Logger(InteractionsController.name);

  constructor(private interactionsService: InteractionsService) {}

  @Post('')
  @HttpCode(200)
  async handleInteraction(
    @Headers('x-signature-ed25519') signature: string,
    @Headers('x-signature-timestamp') timestamp: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: DiscordInteraction,
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(body);
    const isValidRequest = await verifyKey(
      rawBody,
      signature,
      timestamp,
      process.env.PUBLIC_KEY,
    );
    if (!isValidRequest) {
      throw new UnauthorizedException('Invalid request signature');
    }
    switch (body.type) {
      case InteractionType.Ping:
        return { type: InteractionResponseType.PONG };
      case InteractionType.ApplicationCommand:
        return this.interactionsService.handleCommand(body);
      case InteractionType.MessageComponent:
        return;
      default:
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Unhandled interaction type' },
        };
    }
  }

  @Post('reload-commands')
  async reloadCommands() {
    try {
      return await this.interactionsService.reloadCommands();
    } catch (error) {
      this.logger.error('Failed to reload commands:', error);
      throw error;
    }
  }

  @Post('reload-guild-commands')
  async reloadGuildCommands(@Body() body: { guildId: string }) {
    try {
      return await this.interactionsService.reloadGuildCommands(body.guildId);
    } catch (error) {
      this.logger.error('Failed to reload commands:', error);
      throw error;
    }
  }
}
