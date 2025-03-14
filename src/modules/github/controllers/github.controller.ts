import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { IssuesService } from '../services/issues.service';

@Controller('webhook')
export class GithubController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post('')
  @HttpCode(202)
  async handleWebhook(
    @Headers('x-github-event') githubEvent: string,
    @Body() payload: any,
  ) {
    console.log(payload.repository.name);
    if (githubEvent === 'issues') {
      const action = payload.action;
      if (action === 'opened') {
        await this.issuesService.handleIssueOpened(payload);
      } else if (action === 'closed') {
        await this.issuesService.handleIssueClosed(payload);
      }
    } else if (githubEvent === 'issue_comment') {
      await this.issuesService.handleIssueComment(payload);
    }

    return { message: 'Accepted' };
  }
}
