import { Injectable, Logger } from '@nestjs/common';
import {
  InteractionResponseFlags,
  InteractionResponseType,
} from 'discord-interactions';
import { DiscordService } from './discord.service';
import { OauthService } from '@app/modules/discord/services/oauth.service';
import { ApplicationCommand } from 'discord.js';
import { DiscordInteraction } from '@app/modules/discord/models/discord-interaction';

enum Commands {
  test = 'test',
  create_group = 'create_group',
  connect = 'connect',
}

interface InteractionResponse {
  type: InteractionResponseType;
  data: {
    content: string;
    flags?: number;
  };
}

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);
  private readonly commands = [
    {
      name: 'test',
      default_member_permissions: '8',
      description: 'Test command',
    },
    {
      name: 'create_group',
      description: 'Create a new group with text and voice channels',
      options: [
        {
          name: 'group_name',
          description: 'Name of the group to create',
          type: 3, // STRING type
          required: true,
        },
        {
          name: 'users',
          description: 'Users to add to the group (comma-separated mentions)',
          type: 3, // STRING type
          required: true,
        },
      ],
    },

    {
      name: 'connect',
      default_member_permissions: '8',
      description: 'Connect your Github account',
    },
  ];

  constructor(
    private readonly discordService: DiscordService,
    private readonly oauthService: OauthService,
  ) {}

  async handleCommand(interaction: DiscordInteraction): Promise<unknown> {
    const name = interaction.data.name;

    const eventsDictionary: Record<
      Commands | 'default',
      (interaction: DiscordInteraction) => Promise<unknown>
    > = {
      [Commands.test]: async () => Promise.resolve(this.handleTestCommand()),
      [Commands.create_group]: async (interaction) =>
        this.handleCreateGroupCommand(interaction),
      [Commands.connect]: async () => Promise.resolve(this.connect()),
      default: async (interaction) =>
        Promise.resolve({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Command not implemented: ${interaction.data.name}`,
          },
        }),
    };

    const handler =
      name in Commands
        ? eventsDictionary[name as Commands]
        : eventsDictionary['default'];
    return handler(interaction);
  }

  private handleTestCommand(): InteractionResponse {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Hello! The test command works!' },
    };
  }

  private connect(): InteractionResponse {
    const authorizationUrl = this.oauthService.generateAuthorizationUrl();
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `Connect your github account [here](${authorizationUrl})`,
      },
    };
  }

  private async handleCreateGroupCommand(
    interaction: DiscordInteraction,
  ): Promise<InteractionResponse> {
    try {
      const groupName = interaction.data.options.find(
        (option) => option.name === 'group_name',
      )?.value;

      const usersString = interaction.data.options.find(
        (option) => option.name === 'users',
      )?.value;

      if (!groupName || !usersString) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Error: El nombre del grupo y los usuarios son requeridos',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        };
      }

      // Parse user mentions
      const userIds =
        usersString
          .match(/<@!?(\d+)>/g)
          ?.map((mention) => mention.replace(/<@!?(\d+)>/, '$1')) || [];

      if (userIds.length === 0) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              'Error: No se proporcionaron menciones de usuarios válidas',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        };
      }

      const currentUserId = interaction.member.user.id;

      if (userIds.includes(currentUserId)) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              'Error: No puedes incluirte a ti mismo entre los miembros del grupo',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        };
      }

      // Create confirmation message
      await this.discordService.sendConfirmationMessage(
        interaction.channel_id,
        groupName,
        userIds,
        interaction.member.user.id,
      );

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `La solicitud de creación del grupo ha sido enviada.`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      };
    } catch (error) {
      this.logger.error(`Error creating group: ${error}`);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Error al crear el grupo: ${error}`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      };
    }
  }

  async reloadCommands() {
    return this.discordService.reloadCommands(this.commands);
  }
}
