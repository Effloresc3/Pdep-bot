import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@app/common/services/http.service';

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
      const response = await this.httpService.discordRequest(endpoint, {
        method: 'GET',
      });

      if (response.ok) {
        const channels = await response.json();
        console.log(channels);
        const channel = channels.find((c) => c.name === channelName);
        return channel ? channel.id : null;
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to get channel by name: ${error.message}`);
      return null;
    }
  }

  async getRoleByName(roleName: string): Promise<string | null> {
    try {
      const endpoint = `guilds/${this.guildId}/roles`;
      const response = await this.httpService.discordRequest(endpoint, {
        method: 'GET',
      });

      if (response.ok) {
        const roles = await response.json();
        const role = roles.find((r) => r.name === roleName);
        return role ? role.id : null;
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to get role by name: ${error.message}`);
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

  async createGroupTextAndVoiceChannels(groupName: string): Promise<boolean> {
    try {
      // Create role for the group
      const roleResponse = await this.httpService.discordRequest(
        `guilds/${this.guildId}/roles`,
        {
          method: 'POST',
          body: {
            name: groupName,
            permissions: '0',
            color: Math.floor(Math.random() * 16777215),
            mentionable: true,
          },
        },
      );

      const roleData = await roleResponse.json();
      const roleId = roleData.id;

      // Get the docentes role ID
      const docentesRoleId = await this.getRoleByName('docentes');
      if (!docentesRoleId) {
        throw new Error('Docentes role not found');
      }

      // Get the text category ID
      const textCategoryId = await this.getChannelByName('grupos-de-tps');
      // Get the voice category ID
      const voiceCategoryId = await this.getChannelByName('grupos-de-tps-voz');

      console.log(textCategoryId, voiceCategoryId);

      if (!textCategoryId || !voiceCategoryId) {
        throw new Error('Required categories not found');
      }

      const permissionOverwrites = [
        {
          id: this.guildId, // @everyone role
          type: 0,
          deny: '1024', // VIEW_CHANNEL permission
        },
        {
          id: roleId, // group role
          type: 0,
          allow: '1024', // VIEW_CHANNEL permission
        },
        {
          id: docentesRoleId, // docentes role
          type: 0,
          allow: '1024', // VIEW_CHANNEL permission
        },
      ];

      // Create text channel in grupos-de-tps category
      await this.httpService.discordRequest(`guilds/${this.guildId}/channels`, {
        method: 'POST',
        body: {
          name: `${groupName.toLowerCase().replace(/\s+/g, '-')}`,
          type: 0, // GUILD_TEXT
          parent_id: textCategoryId,
          permission_overwrites: permissionOverwrites,
        },
      });

      // Create voice channel in grupos-de-tp-voz category
      await this.httpService.discordRequest(`guilds/${this.guildId}/channels`, {
        method: 'POST',
        body: {
          name: groupName,
          type: 2, // GUILD_VOICE
          parent_id: voiceCategoryId,
          permission_overwrites: permissionOverwrites,
        },
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to create group channels: ${error.message}`);
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
    const message = `Group Creation Request for "${groupName}"\n\nCreator: <@${creatorId}>\nInvited Users: ${userMentions}\n\nPlease react with ✅ to confirm joining the group.`;

    const response = await this.httpService.discordRequest(
      `channels/${channelId}/messages`,
      {
        method: 'POST',
        body: { content: message },
      },
    );

    const messageData = await response.json();

    // Add the checkmark reaction
    await this.httpService.discordRequest(
      `channels/${channelId}/messages/${messageData.id}/reactions/✅/@me`,
      {
        method: 'PUT',
      },
    );

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
    const checkReactions = async () => {
      const response = await this.httpService.discordRequest(
        `channels/${channelId}/messages/${messageId}/reactions/✅`,
        {
          method: 'GET',
        },
      );

      const reactions = await response.json();
      const confirmedUsers = reactions.map((r) => r.id);

      // Check if all required users have reacted
      const allConfirmed = requiredUserIds.every((userId) =>
        confirmedUsers.includes(userId),
      );

      if (allConfirmed) {
        clearInterval(interval);

        // Create the group and assign roles
        await this.createGroupTextAndVoiceChannels(groupName);

        // Assign roles to all users
        const roleId = await this.getRoleByName(groupName);
        if (roleId) {
          for (const userId of requiredUserIds) {
            await this.assignRoleToUser(userId, roleId);
          }
          await this.assignRoleToUser(creatorId, roleId);
        }

        await this.httpService.discordRequest(
          `channels/${channelId}/messages/${messageId}`,
          {
            method: 'PATCH',
            body: {
              content: `Group ${groupName}" has been created successfully!`,
            },
          },
        );
      }
    };

    // Check every 5 seconds for 5 minutes
    const interval = setInterval(checkReactions, 5000);
    setTimeout(() => {
      clearInterval(interval);
      this.sendDiscordMessage(
        channelId,
        `Group creation request for "${groupName}" has expired.`,
      );
    }, 300000); // 5 minutes timeout
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    await this.httpService.discordRequest(
      `guilds/${this.guildId}/members/${userId}/roles/${roleId}`,
      {
        method: 'PUT',
      },
    );
  }
}
