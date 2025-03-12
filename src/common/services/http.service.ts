import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);

  constructor() {}

  async discordRequest(
    endpoint: string,
    options: any,
    retryCount = 0,
  ): Promise<Response> {
    const MAX_RETRIES = 3;
    const url = 'https://discord.com/api/v10/' + endpoint;

    if (options.body) {
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'User-Agent':
          'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
      },
      ...options,
    });

    // Handle rate limiting
    if (res.status === 429 && retryCount < MAX_RETRIES) {
      const data = await res.json();
      const retryAfter = data.retry_after || 1;
      this.logger.warn(
        `Rate limited! Retry ${retryCount + 1}/${MAX_RETRIES} after ${retryAfter} seconds...`,
      );

      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

      // Retry with incremented counter
      return this.discordRequest(endpoint, options, retryCount + 1);
    }

    if (!res.ok) {
      const data = await res.json();
      this.logger.error(`HTTP Error ${res.status}: ${JSON.stringify(data)}`);
      throw new Error(JSON.stringify(data));
    }

    return res;
  }
}
