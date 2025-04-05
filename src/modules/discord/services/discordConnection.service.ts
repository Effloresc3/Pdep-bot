import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscordConnection } from '@app/modules/discord/entities/discordConnections.entity';

@Injectable()
export class DiscordConnectionService {
  constructor(
    @InjectRepository(DiscordConnection)
    private discordConnectionRepository: Repository<DiscordConnection>,
  ) {}

  findAll(): Promise<DiscordConnection[]> {
    return this.discordConnectionRepository.find();
  }

  findOne(id: number): Promise<DiscordConnection> {
    return this.discordConnectionRepository.findOneBy({ id });
  }

  create(
    discordConnection: Partial<DiscordConnection>,
  ): Promise<DiscordConnection> {
    const newDiscordConnection =
      this.discordConnectionRepository.create(discordConnection);
    return this.discordConnectionRepository.save(newDiscordConnection);
  }

  async remove(id: number): Promise<void> {
    await this.discordConnectionRepository.delete(id);
  }
}
