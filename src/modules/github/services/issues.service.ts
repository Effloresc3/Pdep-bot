import { Injectable, Logger } from '@nestjs/common';
import { DiscordService } from '../../discord/services/discord.service';
import { GoogleSheetsService } from '@app/modules/google/services/google.sheets';
import { GitHubIssuePayload } from '@app/modules/github/models/github-interfaces';
import { DiscordInfoService } from '@app/modules/discord/services/discordInfo.service';

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly discordInfoService: DiscordInfoService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  async handleIssueOpened(payload: GitHubIssuePayload): Promise<void> {
    const { issue } = payload;
    const issueTitle = issue.title;
    const issueBody = issue.body;
    const issueUrl = issue.html_url;
    const issueCreator = issue.user.login;
    const organization = payload.repository.owner.login;

    this.logger.log(`An issue was opened with title: ${issueTitle}`);
    const { paradigm, assignment, teamName } = this.splitRepositoryName(
      payload.repository.name,
    );
    try {
      const discordInfo =
        await this.discordInfoService.findOneByOrganizationName(organization);
      if (discordInfo.spreadSheetId !== null) {
        await this.googleSheetsService.updateTpStatus(
          discordInfo.spreadSheetName,
          paradigm,
          teamName,
          assignment,
          SpreadSheetStatus.approved,
        );
      }
      const message = `📢 Se creo un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;

      const guildId = discordInfo.guildId;
      const channelId = await this.discordService.getChannelByName(
        teamName,
        guildId,
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
    const organization = payload.repository.owner.login;

    try {
      const { paradigm, assignment, teamName } = this.splitRepositoryName(
        payload.repository.name,
      );

      const discordInfo =
        await this.discordInfoService.findOneByOrganizationName(organization);
      if (discordInfo.spreadSheetId !== null) {
        await this.googleSheetsService.updateTpStatus(
          discordInfo.spreadSheetName,
          paradigm,
          teamName,
          assignment,
          SpreadSheetStatus.approved,
        );
      }

      const message = `📢 Se cerro un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver Issue](${issueUrl})`;

      const guildId = discordInfo.guildId;
      const channelId = await this.discordService.getChannelByName(
        teamName,
        guildId,
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
    const organization = payload.repository.owner.login;

    try {
      const { teamName } = this.splitRepositoryName(payload.repository.name);
      const message = `📢 Se dejo un comentario en un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;
      const discordInfo =
        await this.discordInfoService.findOneByOrganizationName(organization);
      const guildId = discordInfo.guildId;
      const channelId = await this.discordService.getChannelByName(
        teamName,
        guildId,
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
