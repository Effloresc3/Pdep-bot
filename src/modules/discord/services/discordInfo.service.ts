import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscordInfo } from '@app/modules/discord/entities/discordInfo.entity';

@Injectable()
export class DiscordInfoService {
  constructor(
    @InjectRepository(DiscordInfo)
    private discordInfoRepository: Repository<DiscordInfo>,
  ) {}

  findAll(): Promise<DiscordInfo[]> {
    return this.discordInfoRepository.find();
  }

  findOne(id: number): Promise<DiscordInfo> {
    return this.discordInfoRepository.findOneBy({ id });
  }

  findOneByGuildId(guildId: string): Promise<DiscordInfo> {
    return this.discordInfoRepository.findOneBy({ guildId: guildId });
  }

  findOneByOrganizationName(organizationName: string): Promise<DiscordInfo> {
    return this.discordInfoRepository.findOneBy({
      organizationName: organizationName,
    });
  }

  create(discordInfo: Partial<DiscordInfo>): Promise<DiscordInfo> {
    const newDiscordInfo = this.discordInfoRepository.create(discordInfo);
    return this.discordInfoRepository.save(newDiscordInfo);
  }

  async remove(id: number): Promise<void> {
    await this.discordInfoRepository.delete(id);
  }
}
