import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { HttpService } from '@app/common/services/http.service';
import {
  ApplicationCommand,
  Channel,
  GuildChannel,
  Message,
  PermissionsBitField,
  ReactionEmoji,
  Role,
} from 'discord.js';
import { OverwriteType } from 'discord-api-types/v10';
import { Duration } from 'luxon';
import { ChannelTypes } from 'discord-interactions';
import { DiscordInfoService } from '@app/modules/discord/services/discordInfo.service';
import { MessageService } from '@app/modules/discord/services/message.service';
import { UserService } from '@app/modules/discord/services/user.service';

interface PermissionOverwriteData {
  id: string;
  type: OverwriteType;
  allow?: bigint;
  deny?: bigint;
}

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private confirmationsInterval: NodeJS.Timeout;

  constructor(
    private httpService: HttpService,
    private discordInfoService: DiscordInfoService,
    private messageService: MessageService,
    private userService: UserService,
  ) {}

  onModuleInit() {
    this.logger.log('Starting to watch message confirmations');
    this.watchConfirmations();
  }

  onModuleDestroy() {
    if (this.confirmationsInterval) {
      clearInterval(this.confirmationsInterval);
      this.logger.log('Stopped watching message confirmations');
    }
  }

  async getChannelByName(
    channelName: string,
    guildId: string,
  ): Promise<string | null> {
    try {
      const endpoint = `guilds/${guildId}/channels`;
      const response = await this.httpService.discordRequest({
        endpoint,
        options: {
          method: 'GET',
        },
      });

      const channels: GuildChannel[] =
        (await response.json()) as GuildChannel[];

      const channel = channels.find((c) => c.name === channelName);

      return channel?.id;
    } catch (error) {
      this.logger.error(`Failed to get channel by name: ${error}`);

      return null;
    }
  }

  async getRoleByName(
    roleName: string,
    guildId: string,
  ): Promise<string | null> {
    try {
      const endpoint = `guilds/${guildId}/roles`;
      const response = await this.httpService.discordRequest({
        endpoint,
        options: {
          method: 'GET',
        },
      });

      const roles: Role[] = (await response.json()) as Role[];
      const role: Role = roles.find((r) => r.name === roleName);
      return role?.id;
    } catch (error) {
      this.logger.error(`Failed to get role by name: ${error}`);
      return null;
    }
  }

  async sendDiscordMessage(
    channelId: string,
    message: string,
  ): Promise<Message> {
    try {
      const body = JSON.stringify({ content: message });
      const endpoint = `channels/${channelId}/messages`;
      const options = {
        method: 'POST',
        body: body,
      };
      const response = await this.httpService.discordRequest({
        endpoint,
        options,
      });
      this.logger.log('Message sent successfully');
      return (await response.json()) as Message;
    } catch (error) {
      this.logger.error(`Failed to send message: ${error}`);
    }
  }

  async createGroupTextAndVoiceChannels(
    groupName: string,
    guildId: string,
  ): Promise<boolean> {
    try {
      const roleId = await this.createRole(groupName, guildId);

      // Get the text category ID
      const textCategoryId = await this.getChannelByName(
        'grupos-de-tps',
        guildId,
      );
      // Get the voice category ID
      const voiceCategoryId = await this.getChannelByName(
        'grupos-de-tps-voz',
        guildId,
      );

      if (!textCategoryId || !voiceCategoryId)
        this.logger.error('Required categories not found');

      const permissionOverwrites: PermissionOverwriteData[] = [
        {
          id: guildId,
          type: OverwriteType.Role,
          deny: PermissionsBitField.Flags.ViewChannel,
        },
        {
          id: roleId,
          type: OverwriteType.Role,
          allow: PermissionsBitField.Flags.ViewChannel,
        },
      ];

      // Create text channel in grupos-de-tps category
      await this.createChannel(
        groupName,
        ChannelTypes.GUILD_TEXT,
        permissionOverwrites,
        textCategoryId,
      );

      await this.createChannel(
        groupName,
        ChannelTypes.GUILD_VOICE,
        permissionOverwrites,
        voiceCategoryId,
      );

      return true;
    } catch (error) {
      this.logger.error(`Failed to create group channels: ${error}`);
      return false;
    }
  }

  async sendConfirmationMessage(
    channelId: string,
    groupName: string,
    userIds: string[],
    creatorId: string,
    guildId: string,
  ): Promise<any> {
    const userMentions = userIds.map((id) => `<@${id}>`).join(', ');
    const message = `Solicitud de Creación de Grupo para "${groupName}"\n\nCreador: <@${creatorId}>\nUsuarios Invitados: ${userMentions}\n\nPor favor, reacciona con ✅ para confirmar que te unis al grupo.`;
    const messageData: Message = await this.sendDiscordMessage(
      channelId,
      message,
    );
    await this.reactMessage(channelId, messageData.id);

    const discordInfo = await this.discordInfoService.findOneByGuildId(guildId);
    const users = userIds.map((id) => ({ userId: id }));
    const createdUsers = await this.userService.createMany(users);
    await this.messageService.create({
      channelId: channelId,
      messageId: messageData.id,
      groupName: groupName,
      requiredUserIds: createdUsers,
      guildId: guildId,
      discordInfo: discordInfo,
    });

    return messageData;
  }

  private watchConfirmations() {
    const checkReactions = () => {
      void (async () => {
        try {
          const messages = await this.messageService.findAll();

          for (const message of messages) {
            const reactions: ReactionEmoji[] = await this.getMessageReactions(
              message.channelId,
              message.messageId,
            );
            const confirmedUsers = reactions.map((reaction) => reaction.id);

            const allConfirmed = message.requiredUserIds.every((user) =>
              confirmedUsers.includes(user.userId),
            );

            if (allConfirmed) {
              await this.createGroupTextAndVoiceChannels(
                message.groupName,
                message.guildId,
              );

              // Assign roles to all users
              const roleId = await this.getRoleByName(
                message.groupName,
                message.guildId,
              );
              await Promise.all(
                message.requiredUserIds.map((user) =>
                  this.assignRoleToUser(user.userId, roleId, message.guildId),
                ),
              );

              const sentMessage = `El grupo "${message.groupName}" ha sido creado exitosamente!`;
              await this.messageService.remove(message.id);
              await this.sendDiscordMessage(message.channelId, sentMessage);
            }
          }
        } catch (error) {
          this.logger.error(`Error checking reactions: ${error}`);
        }
      })();
    };

    // Check every 40 seconds until done
    this.confirmationsInterval = setInterval(
      checkReactions,
      Duration.fromObject({ seconds: 40 }).toMillis(),
    );
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    guildId: string,
  ): Promise<void> {
    const endpoint = `guilds/${guildId}/members/${userId}/roles/${roleId}`;
    const options = { method: 'PUT' };

    try {
      await this.httpService.discordRequest({ endpoint, options });
    } catch (error) {
      this.logger.error(`Failed to assign role to user: ${error}`);
      throw error;
    }
  }

  private async createRole(roleName: string, guildId: string) {
    const endpoint = `guilds/${guildId}/roles`;
    const body = JSON.stringify({
      name: roleName,
      permissions: '0',
      color: Math.floor(Math.random() * 16777215),
      mentionable: true,
    });
    const options = {
      method: 'POST',
      body: body,
    };

    try {
      const roleResponse = await this.httpService.discordRequest({
        endpoint,
        options,
      });

      const role: Role = (await roleResponse.json()) as Role;
      return role?.id;
    } catch (error) {
      this.logger.error(`Failed to create role ${roleName}: ${error}`);
      throw error;
    }
  }

  private async createChannel(
    channelName: string,
    channelType: number,
    permissions: PermissionOverwriteData[],
    guildId: string,
    categoryId?: string,
  ) {
    const endpoint = `guilds/${guildId}/channels`;
    const body = JSON.stringify(
      {
        name: `${channelName.toLowerCase().replace(/\s+/g, '-')}`,
        type: channelType,
        parent_id: categoryId,
        permission_overwrites: permissions,
      },
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    );

    const options = {
      method: 'POST',
      body,
    };

    try {
      const response = await this.httpService.discordRequest({
        endpoint: endpoint,
        options: options,
      });
      const channel = (await response.json()) as Channel;
      return channel.id;
    } catch (error) {
      this.logger.error(`Failed to create channel ${channelName}: ${error}`);
      throw error;
    }
  }

  private async reactMessage(channelId: string, messageId: string) {
    const endpoint = `channels/${channelId}/messages/${messageId}/reactions/✅/@me`;
    const options = {
      method: 'PUT',
    };

    try {
      const response = await this.httpService.discordRequest({
        endpoint: endpoint,
        options: options,
      });

      if (response.status === 204) {
        return { success: true };
      }
      if (response.headers.get('content-length') !== '0') {
        return (await response.json()) as ReactionEmoji;
      }
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to react to message: ${error}`);
      throw error;
    }
  }

  private async getMessageReactions(channelId: string, messageId: string) {
    const reactionEndpoint = `channels/${channelId}/messages/${messageId}/reactions/✅`;
    const reactionOptions = {
      method: 'GET',
    };

    try {
      const response = await this.httpService.discordRequest({
        endpoint: reactionEndpoint,
        options: reactionOptions,
      });

      return (await response.json()) as ReactionEmoji[];
    } catch (error) {
      this.logger.error(`Failed to react to message: ${error}`);
      throw error;
    }
  }

  async reloadCommands(commands: unknown) {
    try {
      const endpoint = `applications/${process.env.DISCORD_CLIENT_ID}/commands`;

      const body = JSON.stringify(commands);
      const options = {
        method: 'PUT',
        body,
      };
      const response = await this.httpService.discordRequest({
        endpoint: endpoint,
        options: options,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as Error;
        this.logger.log(
          `Failed to reload commands: ${JSON.stringify(errorData)}`,
        );
      }

      const result = (await response.json()) as ApplicationCommand;
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
