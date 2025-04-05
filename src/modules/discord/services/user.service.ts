import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@app/modules/discord/entities/user.entity';
import { Message } from '@app/modules/discord/entities/message.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  findOne(id: number): Promise<User> {
    return this.userRepository.findOneBy({ id });
  }

  findOneByMessageId(message: Message): Promise<User> {
    return this.userRepository.findOneBy({ message: message });
  }

  create(User: Partial<User>): Promise<User> {
    const newUser = this.userRepository.create(User);
    return this.userRepository.save(newUser);
  }

  createMany(users: Partial<User>[]): Promise<User[]> {
    const newUsers = this.userRepository.create(users);
    return this.userRepository.save(newUsers);
  }
  async remove(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }
}
