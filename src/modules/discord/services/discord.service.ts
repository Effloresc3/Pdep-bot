import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@app/common/services/http.service';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(private httpService: HttpService) {}

  async getChannelByName(
    guildId: string,
    channelName: string,
  ): Promise<string | null> {
    try {
      const endpoint = `guilds/${guildId}/channels`;
      const response = await this.httpService.discordRequest(endpoint, {
        method: 'GET',
      });

      if (response.ok) {
        const channels = await response.json();
        const channel = channels.find((c) => c.name === channelName);
        return channel ? channel.id : null;
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to get channel by name: ${error.message}`);
      return null;
    }
  }

  async sendDiscordMessage(
    channelId: string,
    message: string,
  ): Promise<boolean> {
    try {
      const body = { content: message };
      const response = await this.httpService.discordRequest(
        `channels/${channelId}/messages`,
        {
          method: 'POST',
          body,
        },
      );

      this.logger.log('Message sent successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      return false;
    }
  }

  async createGroupTextAndVoiceChannels(
    guildId: string,
    groupName: string,
  ): Promise<boolean> {
    try {
      // Create role for the group
      const roleResponse = await this.httpService.discordRequest(
        `guilds/${guildId}/roles`,
        {
          method: 'POST',
          body: {
            name: groupName,
            permissions: '0', // Basic permissions
            color: Math.floor(Math.random() * 16777215), // Random color
            mentionable: true,
          },
        },
      );

      const roleData = await roleResponse.json();
      const roleId = roleData.id;

      // Create category channel
      const categoryResponse = await this.httpService.discordRequest(
        `guilds/${guildId}/channels`,
        {
          method: 'POST',
          body: {
            name: groupName,
            type: 4, // GUILD_CATEGORY
            permission_overwrites: [
              {
                id: guildId, // @everyone role
                type: 0,
                deny: '1024', // VIEW_CHANNEL
              },
              {
                id: roleId,
                type: 0,
                allow: '1024', // VIEW_CHANNEL
              },
            ],
          },
        },
      );

      const categoryData = await categoryResponse.json();
      const categoryId = categoryData.id;

      // Create text channel
      await this.httpService.discordRequest(`guilds/${guildId}/channels`, {
        method: 'POST',
        body: {
          name: `${groupName}-text`,
          type: 0, // GUILD_TEXT
          parent_id: categoryId,
        },
      });

      // Create voice channel
      await this.httpService.discordRequest(`guilds/${guildId}/channels`, {
        method: 'POST',
        body: {
          name: `${groupName}-voice`,
          type: 2, // GUILD_VOICE
          parent_id: categoryId,
        },
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to create group channels: ${error.message}`);
      throw error;
    }
  }

  async addUserToRole(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<boolean> {
    try {
      await this.httpService.discordRequest(
        `guilds/${guildId}/members/${userId}/roles/${roleId}`,
        {
          method: 'PUT',
        },
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to add user to role: ${error.message}`);
      return false;
    }
  }
}
