import { Injectable, Logger } from '@nestjs/common';
import { DiscordService } from '../../discord/services/discord.service';
import { GoogleSheetsService } from '@app/modules/google/services/google.sheets';
import { GitHubIssuePayload } from '@app/modules/github/models/github-interfaces';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);
  private readonly guildId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly discordService: DiscordService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {
    this.guildId = this.configService.get<string>('GUILD_ID');
  }

  async handleIssueOpened(payload: GitHubIssuePayload): Promise<void> {
    const { issue } = payload;
    const issueTitle = issue.title;
    const issueBody = issue.body;
    const issueUrl = issue.html_url;
    const issueCreator = issue.user.login;

    this.logger.log(`An issue was opened with title: ${issueTitle}`);
    const { paradigm, assignment, teamName } = this.splitRepositoryName(
      payload.repository.name,
    );
    try {
      await this.googleSheetsService.updateTpStatus(
        'Alumnes',
        paradigm,
        teamName,
        assignment,
        'Correcciones pendientes',
      );

      const message = `📢 Se creo un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;

      const channelId = await this.discordService.getChannelByName(
        this.guildId,
        teamName,
      );
      if (!channelId) {
        this.logger.error('Group channel not found');
      }
      await this.discordService.sendDiscordMessage(channelId, message);

      this.logger.log('Message sent to Discord channel successfully');
    } catch (error) {
      this.logger.error(`Failed to handle issue opened event: ${error}`);
    }
  }

  async handleIssueClosed(payload: GitHubIssuePayload): Promise<void> {
    const { issue } = payload;
    const issueTitle = issue.title;
    const issueBody = issue.body;
    const issueUrl = issue.html_url;
    const issueCreator = issue.user.login;

    try {
      const { paradigm, assignment, teamName } = this.splitRepositoryName(
        payload.repository.name,
      );

      await this.googleSheetsService.updateTpStatus(
        'Alumnes',
        paradigm,
        teamName,
        assignment,
        'Aprobado',
      );

      const message = `📢 Se cerro un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver Issue](${issueUrl})`;

      const channelId = await this.discordService.getChannelByName(
        this.guildId,
        teamName,
      );
      if (!channelId) {
        this.logger.error('Group channel not found');
      }
      await this.discordService.sendDiscordMessage(channelId, message);

      this.logger.log('Message sent to Discord channel successfully');
    } catch (error) {
      this.logger.error(`Failed to handle issue closed event: ${error}`);
    }
  }

  async handleIssueComment(payload: GitHubIssuePayload): Promise<void> {
    const issueTitle = payload.issue.title;
    const issueBody = payload.comment.body;
    const issueUrl = payload.issue.html_url;
    const issueCreator = payload.issue.user.login;

    try {
      const { teamName } = this.splitRepositoryName(payload.repository.name);
      const message = `📢 Se dejo un comentario en un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;
      const channelId = await this.discordService.getChannelByName(
        this.guildId,
        teamName,
      );
      if (!channelId) {
        this.logger.error('Group channel not found');
      }
      await this.discordService.sendDiscordMessage(channelId, message);

      this.logger.log('Message sent to Discord channel successfully');
    } catch (error) {
      this.logger.error(`Failed to handle issue comment event: ${error}`);
    }
  }

  private splitRepositoryName(repositoryName: string): {
    paradigm: string;
    assignment: string;
    teamName: string;
  } {
    const parts = repositoryName.split('-');

    return {
      paradigm: parts[1],
      assignment: `${parts[2]}-${parts[3]}`,
      teamName: parts[4].split('_')[0],
    };
  }
}
