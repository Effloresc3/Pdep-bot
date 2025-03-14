import { Injectable, Logger } from '@nestjs/common';
import { InteractionResponseType } from 'discord-interactions';
import { DiscordService } from './discord.service';
import { OauthService } from '@app/modules/discord/services/oauth.service';

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

  async handleCommand(interaction: any) {
    const { name } = interaction.data;
    this.logger.log(`Handling command: ${name}`);

    switch (name) {
      case 'test':
        return this.handleTestCommand();

      case 'create_group':
        return this.handleCreateGroupCommand(interaction);

      case 'connect':
        return this.connect();

      default:
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Command not implemented: ${name}`,
          },
        };
    }
  }

  private handleTestCommand() {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Hello! The test command works!',
      },
    };
  }

  private connect() {
    const authorizationUrl = this.oauthService.generateAuthorizationUrl();
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `Connect your github account [here](${authorizationUrl})`,
      },
    };
  }

  private async handleCreateGroupCommand(interaction: any) {
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
            content: 'Error: Group name and users are required',
            flags: 64, // Ephemeral message
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
            content: 'Error: No valid user mentions provided',
            flags: 64,
          },
        };
      }

      const currentUserId = interaction.member.user.id;

      if (userIds.includes(currentUserId)) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Error: You cannot include yourself in the group members',
            flags: 64, // Ephemeral message
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
          content: `Group creation request has been sent.`,
          flags: 64,
        },
      };
    } catch (error) {
      this.logger.error(`Error creating group: ${error.message}`);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Failed to create group: ${error.message}`,
          flags: 64,
        },
      };
    }
  }

  async reloadCommands() {
    try {
      const endpoint = `https://discord.com/api/v10/applications/${process.env.DISCORD_CLIENT_ID}/commands`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.commands),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to reload commands: ${JSON.stringify(errorData)}`,
        );
      }

      const result = await response.json();
      this.logger.log('Successfully reloaded application commands');
      return {
        success: true,
        message: 'Commands reloaded successfully',
        result,
      };
    } catch (error) {
      this.logger.error('Error reloading commands:', error);
      throw error;
    }
  }
}
