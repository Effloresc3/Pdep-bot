import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { OauthService } from '../services/oauth.service';
import { DiscordService } from '@app/modules/discord/services/discord.service';

@Controller('oauth2')
export class OauthController {
  constructor(
    private readonly oauthService: OauthService,
    private readonly discordService: DiscordService,
  ) {}

  @Get('/callback')
  async handleOauthCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      return res.status(400).send('Authorization code is missing.');
    }

    try {
      // Exchange the code for an access token
      const tokenData = await this.oauthService.exchangeCodeForToken(code);

      // Fetch the user's connections
      const connections = await this.oauthService.fetchUserConnections(
        tokenData.access_token,
      );
      const githubConnections = connections.filter(
        (connection) => connection.type === 'github',
      );

      this.discordService.addGithubUsers(
        connections
          .filter((connection) => connection.type === 'github')
          .map((connection) => connection.name),
      );

      // Respond to the user
      res.send('Authorization complete! You may now close this page.');
    } catch (error) {
      console.error('Error occurred:', error.message);
      res.status(500).send('An error occurred.');
    }
  }
}
