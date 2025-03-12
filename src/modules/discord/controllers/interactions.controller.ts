import {
  Controller,
  Post,
  Headers,
  Body,
  HttpCode,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import {
  InteractionType,
  InteractionResponseType,
  verifyKey,
  verifyKeyMiddleware,
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

      default:
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Unhandled interaction type' },
        };
    }
  }
}
