import { Injectable, Logger } from '@nestjs/common';
import { DiscordService } from '../../discord/services/discord.service';
import { GoogleSheetsService } from '@app/modules/google/services/google.sheets';

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  async handleIssueOpened(payload): Promise<void> {
    const { issue } = payload;
    const issueTitle = issue.title;
    const issueBody = issue.body;
    const issueUrl = issue.html_url;
    const issueCreator = issue.user.login;

    this.logger.log(`An issue was opened with title: ${issueTitle}`);
    const { paradigm, assignment, teamName } = this.splitRepositoryName(
      payload.repository.name,
    );
    console.log(paradigm, assignment, teamName);
    try {
      const channelId = await this.discordService.getChannelByName(teamName);

      const docentesChannelId =
        await this.discordService.getChannelByName('docentes');
      this.googleSheetsService.updateTpStatus(
        'Alumnes',
        paradigm,
        teamName,
        assignment,
        'Correcciones pendientes',
      );
      if (!channelId) {
        throw new Error('Discord channel not found');
      }
      if (this.discordService.getGithubUsers().includes(issueCreator)) {
        const message = `📢 Se creo un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;
        await this.discordService.sendDiscordMessage(channelId, message);
      } else {
        const message = `📢 Se creo un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;
        await this.discordService.sendDiscordMessage(
          docentesChannelId,
          message,
        );
      }

      this.logger.log('Message sent to Discord channel successfully');
    } catch (error) {
      this.logger.error(
        `Failed to handle issue opened event: ${error.message}`,
      );
    }
  }

  async handleIssueClosed(payload): Promise<void> {
    const { issue } = payload;
    const issueTitle = issue.title;
    const issueBody = issue.body;
    const issueUrl = issue.html_url;
    const issueCreator = issue.user.login;

    try {
      const { paradigm, assignment, teamName } = this.splitRepositoryName(
        payload.repository.name,
      );
      console.log('paradigm:', paradigm);
      console.log('assignment:', assignment);
      console.log('teamName:', teamName);

      const channelId = await this.discordService.getChannelByName(teamName);

      const docentesChannelId =
        await this.discordService.getChannelByName('docentes');

      this.googleSheetsService.updateTpStatus(
        'Alumnes',
        paradigm,
        teamName,
        assignment,
        'Aprobado',
      );
      if (!channelId) {
        throw new Error('Discord channel not found');
      }
      if (this.discordService.getGithubUsers().includes(issueCreator)) {
        const message = `📢 Se cerro un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver Issue](${issueUrl})`;
        await this.discordService.sendDiscordMessage(channelId, message);
      } else {
        const message = `📢 Se cerro un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver Issue](${issueUrl})`;
        await this.discordService.sendDiscordMessage(
          docentesChannelId,
          message,
        );
      }

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
      const { paradigm, assignment, teamName } = this.splitRepositoryName(
        payload.repository.name,
      );
      console.log('paradigm:', paradigm);
      console.log('assignment:', assignment);
      console.log('teamName:', teamName);

      const channelId = await this.discordService.getChannelByName(teamName);
      const docentesChannelId =
        await this.discordService.getChannelByName('docentes');
      if (!channelId) {
        throw new Error('Discord channel not found');
      }

      if (this.discordService.getGithubUsers().includes(issueCreator)) {
        const message = `📢 Se dejo un comentario en un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;
        await this.discordService.sendDiscordMessage(channelId, message);
      } else {
        const message = `📢 Se dejo un comentario en un issue!\n**Titulo**: ${issueTitle}\n**Creador**: ${issueCreator}\n**Detalles**: ${issueBody}\n[Ver issue](${issueUrl})`;
        await this.discordService.sendDiscordMessage(
          docentesChannelId,
          message,
        );
      }

      this.logger.log('Message sent to Discord channel successfully');
    } catch (error) {
      this.logger.error(
        `Failed to handle issue comment event: ${error.message}`,
      );
    }
  }

  private splitRepositoryName(repositoryName: string): {
    paradigm: string;
    assignment: string;
    teamName: string;
  } {
    const parts = repositoryName.split('-');

    return {
      paradigm: parts[1], // "objetos"
      assignment: `${parts[2]}-${parts[3]}`, // "tp-6"
      teamName: parts[4].split('_')[0], // "swifties" (remove "_objetos" suffix)
    };
  }
}
