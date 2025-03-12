import { Injectable, Logger } from '@nestjs/common';
import { InteractionResponseType } from 'discord-interactions';
import { DiscordService } from './discord.service';

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);

  constructor(private discordService: DiscordService) {

  }

  async handleCommand(interaction: any) {
    const { name } = interaction.data;
    this.logger.log(`Handling command: ${name}`);

    switch (name) {
      case 'test':
        return this.handleTestCommand(interaction);

      case 'create_group':
        return this.handleCreateGroupCommand(interaction);

      default:
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Command not implemented: ${name}`,
          },
        };
    }
  }

  private handleTestCommand(interaction: any) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Hello! The test command works!',
      },
    };
  }

  private async handleCreateGroupCommand(interaction: any) {
    try {
      // Extract the group name from the options
      const groupName = interaction.data.options.find(
        (option) => option.name === 'group_name',
      )?.value;

      if (!groupName) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Error: No group name provided',
          },
        };
      }

      // Create the group channels and role (deferred to the service for implementation)
      await this.discordService.createGroupTextAndVoiceChannels(
        interaction.guild_id,
        groupName,
      );

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Group "${groupName}" created successfully with text and voice channels!`,
        },
      };
    } catch (error) {
      this.logger.error(`Error creating group: ${error.message}`);

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Failed to create group: ${error.message}`,
          // Make the error message only visible to the command invoker
          flags: 64,
        },
      };
    }
  }
}
