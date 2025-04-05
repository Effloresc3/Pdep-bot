import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { DiscordConnection } from '@app/modules/discord/entities/discordConnections.entity';
import { Message } from '@app/modules/discord/entities/message.entity';

@Entity()
export class DiscordInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  organizationName: string;

  @Column({ unique: true })
  guildId: string;

  @Column({ unique: true })
  spreadsheetId: string;

  @Column({ unique: true })
  spreadsheetName: string;

  @OneToMany(
    () => DiscordConnection,
    (discordConnection) => discordConnection.discordInfo,
  )
  discordConnections: DiscordConnection[];

  @OneToMany(() => Message, (message) => message.discordInfo)
  messageWaitlist: Message[];
}
