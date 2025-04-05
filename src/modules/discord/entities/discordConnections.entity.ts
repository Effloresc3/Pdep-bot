import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { DiscordInfo } from '@app/modules/discord/entities/discordInfo.entity';

@Entity()
export class DiscordConnection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  discordUserId: string;

  @Column()
  githubUserId: string;

  @ManyToOne(() => DiscordInfo, discordInfo => discordInfo.discordConnections)
  discordInfo: DiscordInfo;
}
