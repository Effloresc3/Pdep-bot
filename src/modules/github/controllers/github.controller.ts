import { Controller, Post, Body, Headers, HttpCode, Get } from '@nestjs/common';

import { IssuesService } from '../services/issues.service';
import { GitHubIssuePayload } from '@app/modules/github/models/github-interfaces';

enum Events {
  issues = 'issues',
  issue_comment = 'issue_comment',
}

@Controller('webhook')
export class GithubController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post('')
  @HttpCode(202)
  async handleWebhook(
    @Headers('x-github-event') githubEvent: Events,
    @Body() payload: GitHubIssuePayload,
  ) {
    const eventsDictionary: Record<Events, () => Promise<void>> = {
      [Events.issues]: async () => {
        const action = payload.action;
        if (action === 'opened') {
          await this.issuesService.handleIssueOpened(payload);
        } else if (action === 'closed') {
          await this.issuesService.handleIssueClosed(payload);
        }
      },
      [Events.issue_comment]: async () =>
        await this.issuesService.handleIssueComment(payload),
    };
    await eventsDictionary[githubEvent]?.();

    return { message: 'Accepted' };
  }
}
