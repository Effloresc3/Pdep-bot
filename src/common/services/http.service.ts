import { Injectable, Logger } from '@nestjs/common';

export interface DiscordRequestInput {
  endpoint: string;
  options: RequestInit;
  retryCount?: number;
}

type Data = { retry_after: number };

@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);

  async discordRequest(input: DiscordRequestInput): Promise<Response> {
    const { endpoint, options, retryCount = 0 } = input;

    const MAX_RETRIES = 3;
    const url = 'https://discord.com/api/v10/' + endpoint;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'User-Agent':
          'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
      },
      ...options,
    });

    // Handle rate limiting
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const data: Data = (await response.json()) as Data;
      const retryAfter: number = data.retry_after || 1;
      this.logger.warn(
        `Rate limited! Retry ${retryCount + 1}/${MAX_RETRIES} after ${retryAfter} seconds...`,
      );

      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

      // Retry with incremented counter
      return this.discordRequest(input);
    }

    if (!response.ok) {
      const data: unknown = await response.json();
      this.logger.error(
        `HTTP Error ${response.status}: ${JSON.stringify(data)}`,
      );

      throw new Error(JSON.stringify(data));
    }

    return response;
  }
}
