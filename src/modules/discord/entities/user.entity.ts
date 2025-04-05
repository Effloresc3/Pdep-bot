import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Message } from '@app/modules/discord/entities/message.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: string;

  @ManyToOne(() => Message, (message) => message.requiredUserIds)
  message: Message;
}
