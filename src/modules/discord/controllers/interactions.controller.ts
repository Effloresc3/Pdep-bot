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
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { InteractionsService } from '../services/interactions.service';

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
    @Body() body: any,
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
      case InteractionType.PING:
        return { type: InteractionResponseType.PONG };
      case InteractionType.APPLICATION_COMMAND:
        return this.interactionsService.handleCommand(body);
      case InteractionType.MESSAGE_COMPONENT:
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
}
