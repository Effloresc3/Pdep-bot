import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { DiscordInfo } from '@app/modules/discord/entities/discordInfo.entity';
import { User } from '@app/modules/discord/entities/user.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  messageId: string;

  @Column()
  channelId: string;

  @Column()
  groupName: string;

  @OneToMany(() => User, (user) => user.message)
  requiredUserIds: User[];

  @Column()
  guildId: string;

  @ManyToOne(() => DiscordInfo, (discordInfo) => discordInfo.messageWaitlist)
  discordInfo: DiscordInfo;
}
