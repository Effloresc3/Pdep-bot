import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '../../../common/services/http.service';
import * as querystring from 'querystring';

@Injectable()
export class OauthService {
  private readonly logger = new Logger(OauthService.name);
  private readonly clientId = process.env.DISCORD_CLIENT_ID;
  private readonly clientSecret = process.env.DISCORD_CLIENT_SECRET;
  private readonly redirectUri = process.env.DISCORD_REDIRECT_URI;

  constructor(private readonly httpService: HttpService) {}

  generateAuthorizationUrl(): string {
    const params = {
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'identify connections',
    };

    return `https://discord.com/api/oauth2/authorize?${querystring.stringify(params)}`;
  }

  async exchangeCodeForToken(code: string): Promise<any> {
    try {
      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: querystring.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for token');
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error exchanging code for token: ${error.message}`);
      throw error;
    }
  }

  async fetchUserConnections(accessToken: string): Promise<any[]> {
    try {
      const response = await fetch('https://discord.com/api/users/@me/connections', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user connections');
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error fetching user connections: ${error.message}`);
      throw error;
    }
  }
}