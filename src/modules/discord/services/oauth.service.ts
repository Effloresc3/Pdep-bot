import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@app/common/services/http.service';
import * as querystring from 'querystring';

export interface DiscordConnection {
  id: string;
  name: string;
  type: string;
  friend_sync: boolean;
  metadata_visibility: number;
  show_activity: boolean;
  two_way_link: boolean;
  verified: boolean;
  visibility: number;
}

interface DiscordOAuthTokenResponse {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

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

  async exchangeCodeForToken(code: string): Promise<DiscordOAuthTokenResponse> {
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
        const errorText = await response.text();
        this.logger.error(
          `Failed to exchange code for token. Status: ${response.status}, Response: ${errorText}`,
        );
        throw new Error(`Failed to exchange code for token: ${errorText}`);
      }

      return (await response.json()) as DiscordOAuthTokenResponse;
    } catch (error) {
      this.logger.error(`Error exchanging code for token: ${error}`);
      throw error;
    }
  }

  async fetchUserConnections(
    accessToken: string,
  ): Promise<DiscordConnection[]> {
    try {
      const response = await fetch(
        'https://discord.com/api/users/@me/connections',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error('Failed to fetch user connections');
      }

      return (await response.json()) as DiscordConnection[];
    } catch (error) {
      this.logger.error(`Error fetching user connections: ${error}`);
      throw error;
    }
  }
}
