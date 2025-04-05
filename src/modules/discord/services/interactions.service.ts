import { Injectable, Logger } from '@nestjs/common';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
} from 'discord-interactions';
import { DiscordService } from './discord.service';
import { DiscordInteraction } from '@app/modules/discord/models/discord-interaction';
import { GoogleSheetsService } from '@app/modules/google/services/google.sheets';
import { DiscordInfoService } from '@app/modules/discord/services/discordInfo.service';

enum Commands {
  test = 'test',
  crear_grupo = 'crear_grupo',
  registrar = 'registrar',
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
      name: 'crear_grupo',
      description: 'Crea un grupo con canales de texto y voz',
      options: [
        {
          name: 'nombre_grupo',
          description: 'Nombre del grupo a crear',
          type: InteractionType.MESSAGE_COMPONENT,
          required: true,
        },
        {
          name: 'integrantes',
          description: 'Integrantes del grupo',
          type: InteractionType.MESSAGE_COMPONENT,
          required: true,
        },
      ],
    },
    {
      name: 'registrar',
      description: 'Registra tus datos',
      options: [
        {
          name: 'legajo',
          description: 'Tu legajo',
          type: InteractionType.MESSAGE_COMPONENT,
          required: true,
        },
        {
          name: 'nombre',
          description: 'Tu nombre',
          type: InteractionType.MESSAGE_COMPONENT,
          required: true,
        },
        {
          name: 'email',
          description: 'Tu email',
          type: InteractionType.MESSAGE_COMPONENT,
          required: true,
        },
        {
          name: 'github',
          description: 'Tu usuario de github',
          type: InteractionType.MESSAGE_COMPONENT,
          required: true,
        },
      ],
    },
  ];

  constructor(
    private readonly discordService: DiscordService,
    private readonly sheetsService: GoogleSheetsService,
    private readonly discordInfoService: DiscordInfoService,
  ) {}

  async handleCommand(interaction: DiscordInteraction): Promise<unknown> {
    const name = interaction.data.name;

    const eventsDictionary: Record<
      Commands | 'default',
      (interaction: DiscordInteraction) => Promise<unknown>
    > = {
      [Commands.test]: async () => Promise.resolve(this.handleTestCommand()),
      [Commands.registrar]: async () =>
        Promise.resolve(this.handleRegistration(interaction)),
      [Commands.crear_grupo]: async (interaction) =>
        this.handleCreateGroupCommand(interaction),
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

  private async handleCreateGroupCommand(
    interaction: DiscordInteraction,
  ): Promise<InteractionResponse> {
    try {
      const groupName = interaction.data.options.find(
        (option) => option.name === 'nombre_grupo',
      )?.value;

      const usersString = interaction.data.options.find(
        (option) => option.name === 'integrantes',
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
        currentUserId,
        interaction.guild_id,
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
          content: `Error al crear el grupo.`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      };
    }
  }

  private async handleRegistration(
    interaction: DiscordInteraction,
  ): Promise<InteractionResponse> {
    try {
      const legajo = interaction.data.options.find(
        (option) => option.name === 'legajo',
      )?.value;
      const name = interaction.data.options.find(
        (option) => option.name === 'nombre',
      )?.value;

      const email = interaction.data.options.find(
        (option) => option.name === 'email',
      )?.value;
      const github = interaction.data.options.find(
        (option) => option.name === 'github',
      )?.value;
      const discordInfo = await this.discordInfoService.findOneByGuildId(
        interaction.guild_id,
      );
      this.sheetsService.registerUser(
        legajo,
        name,
        email,
        github,
        discordInfo.spreadsheetId,
        discordInfo.spreadsheetName,
      );
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Se registro correctamente.`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      };
    } catch (error) {
      this.logger.error(`Error al registrarse: ${error}`);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Error al registrarse.`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      };
    }
  }

  async reloadCommands() {
    return this.discordService.reloadCommands(this.commands);
  }

  async reloadGuildCommands(guildId: string) {
    return this.discordService.reloadGuildCommands(guildId, this.commands);
  }
}
