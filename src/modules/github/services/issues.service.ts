import { Injectable, Logger } from '@nestjs/common';
import { DiscordService } from '../../discord/services/discord.service';
import { IssuePayloadDto } from '../../discord/dto/webhook-payload.dto';

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);
  private readonly DISCORD_CHANNEL_ID = '1320487176927969352';
  private readonly DISCORD_CHANNEL_NAME = 'general';

  constructor(private readonly discordService: DiscordService) {}

  async handleIssueOpened(payload: IssuePayloadDto): Promise<void> {
    const { issue } = payload;
    const issueTitle = issue.title;
    const issueBody = issue.body;
    const issueUrl = issue.html_url;
    const issueCreator = issue.user.login;

    this.logger.log(`An issue was opened with title: ${issueTitle}`);

    try {
      const channelId = await this.discordService.getChannelByName(
        this.DISCORD_CHANNEL_ID,
        this.DISCORD_CHANNEL_NAME,
      );

      if (!channelId) {
        throw new Error('Discord channel not found');
      }

      const message = `📢 Se creo un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;
      await this.discordService.sendDiscordMessage(channelId, message);
      this.logger.log('Message sent to Discord channel successfully');
    } catch (error) {
      this.logger.error(
        `Failed to handle issue opened event: ${error.message}`,
      );
    }
  }

  async handleIssueClosed(payload: IssuePayloadDto): Promise<void> {
    const { issue } = payload;
    const issueTitle = issue.title;
    const issueBody = issue.body;
    const issueUrl = issue.html_url;
    const issueCreator = issue.user.login;

    try {
      const channelId = await this.discordService.getChannelByName(
        this.DISCORD_CHANNEL_ID,
        this.DISCORD_CHANNEL_NAME,
      );

      if (!channelId) {
        throw new Error('Discord channel not found');
      }

      const message = `📢 Se cerro un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver Issue](${issueUrl})`;
      await this.discordService.sendDiscordMessage(channelId, message);
      this.logger.log('Message sent to Discord channel successfully');
    } catch (error) {
      this.logger.error(
        `Failed to handle issue closed event: ${error.message}`,
      );
    }
  }

  async handleIssueComment(payload: any): Promise<void> {
    const issueTitle = payload.issue.title;
    const issueBody = payload.comment.body;
    const issueUrl = payload.issue.html_url;
    const issueCreator = payload.issue.user.login;

    try {
      const channelId = await this.discordService.getChannelByName(
        this.DISCORD_CHANNEL_ID,
        this.DISCORD_CHANNEL_NAME,
      );

      if (!channelId) {
        throw new Error('Discord channel not found');
      }

      const message = `📢 Se dejo un comentario en un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;
      await this.discordService.sendDiscordMessage(channelId, message);
      this.logger.log('Message sent to Discord channel successfully');
    } catch (error) {
      this.logger.error(
        `Failed to handle issue comment event: ${error.message}`,
      );
    }
  }
}
