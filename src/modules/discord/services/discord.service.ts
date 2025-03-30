import { Injectable, Logger } from '@nestjs/common';
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

interface PermissionOverwriteData {
  id: string;
  type: OverwriteType;
  allow?: bigint;
  deny?: bigint;
}

@Injectable()
export class DiscordService {
  private githubUsers: [string];
  private readonly logger = new Logger(DiscordService.name);
  private readonly guildId = process.env.GUILD_ID;

  constructor(private httpService: HttpService) {}

  addGithubUsers(usernames: string[]) {
    this.githubUsers.push(...usernames);
  }

  getGithubUsers() {
    return this.githubUsers;
  }

  async getChannelByName(channelName: string): Promise<string | null> {
    try {
      const endpoint = `guilds/${this.guildId}/channels`;
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

  async getRoleByName(roleName: string): Promise<string | null> {
    try {
      const endpoint = `guilds/${this.guildId}/roles`;
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

  async createGroupTextAndVoiceChannels(groupName: string): Promise<boolean> {
    try {
      const roleId = await this.createRole(groupName);

      const docentesRoleId = await this.getRoleByName('docentes');

      if (!docentesRoleId) this.logger.error('Docentes role not found');

      // Get the text category ID
      const textCategoryId = await this.getChannelByName('grupos-de-tps');
      // Get the voice category ID
      const voiceCategoryId = await this.getChannelByName('grupos-de-tps-voz');

      if (!textCategoryId || !voiceCategoryId)
        this.logger.error('Required categories not found');

      const permissionOverwrites: PermissionOverwriteData[] = [
        {
          id: this.guildId,
          type: OverwriteType.Role,
          deny: PermissionsBitField.Flags.ViewChannel,
        },
        {
          id: roleId,
          type: OverwriteType.Role,
          allow: PermissionsBitField.Flags.ViewChannel,
        },
        {
          id: docentesRoleId,
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
  ): Promise<any> {
    const userMentions = userIds.map((id) => `<@${id}>`).join(', ');
    const message = `Solicitud de Creación de Grupo para "${groupName}"\n\nCreador: <@${creatorId}>\nUsuarios Invitados: ${userMentions}\n\nPor favor, reacciona con ✅ para confirmar que te unis al grupo.`;
    const messageData: Message = await this.sendDiscordMessage(
      channelId,
      message,
    );
    await this.reactMessage(channelId, messageData.id);

    // Start watching for reactions
    this.watchConfirmations(
      channelId,
      messageData.id,
      groupName,
      userIds,
      creatorId,
    );

    return messageData;
  }

  private watchConfirmations(
    channelId: string,
    messageId: string,
    groupName: string,
    requiredUserIds: string[],
    creatorId: string,
  ) {
    const checkReactions = () => {
      void (async () => {
        try {
          const reactions: ReactionEmoji[] = await this.getMessageReactions(
            channelId,
            messageId,
          );
          const confirmedUsers = reactions.map((reaction) => reaction.id);

          const allConfirmed = requiredUserIds.every((userId) =>
            confirmedUsers.includes(userId),
          );

          if (allConfirmed) {
            clearInterval(interval);

            await this.createGroupTextAndVoiceChannels(groupName);

            // Assign roles to all users
            const roleId = await this.getRoleByName(groupName);
            requiredUserIds.push(creatorId);
            await Promise.all(
              requiredUserIds.map((userId) =>
                this.assignRoleToUser(userId, roleId),
              ),
            );

            const message = `El grupo "${groupName}" ha sido creado exitosamente!`;
            await this.sendDiscordMessage(channelId, message);
          }
        } catch (error) {
          this.logger.error(`Error checking reactions: ${error}`);
        }
      })();
    };

    // Check every 15 minutes until done
    const interval = setInterval(
      checkReactions,
      Duration.fromObject({ minute: 15 }).toMillis(),
    );
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    const endpoint = `guilds/${this.guildId}/members/${userId}/roles/${roleId}`;
    const options = { method: 'PUT' };

    try {
      await this.httpService.discordRequest({ endpoint, options });
    } catch (error) {
      this.logger.error(`Failed to assign role to user: ${error}`);
      throw error;
    }
  }

  private async createRole(roleName: string) {
    const endpoint = `guilds/${this.guildId}/roles`;
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
    categoryId?: string,
  ) {
    const endpoint = `guilds/${this.guildId}/channels`;

    const body = JSON.stringify({
      name: `${channelName.toLowerCase().replace(/\s+/g, '-')}`,
      type: channelType,
      parent_id: categoryId,
      permission_overwrites: permissions,
    });

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
        method: 'GET',
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
