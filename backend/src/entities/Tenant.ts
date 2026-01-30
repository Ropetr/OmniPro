import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { User } from './User';
import { Channel } from './Channel';
import { Contact } from './Contact';
import { Conversation } from './Conversation';
import { AIAgent } from './AIAgent';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, unique: true })
  slug: string;

  @Column({ length: 255, nullable: true })
  domain: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'inactive' | 'suspended';

  @Column({ type: 'varchar', length: 50, default: 'free' })
  plan: 'free' | 'starter' | 'professional' | 'enterprise';

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Channel, (channel) => channel.tenant)
  channels: Channel[];

  @OneToMany(() => Contact, (contact) => contact.tenant)
  contacts: Contact[];

  @OneToMany(() => Conversation, (conv) => conv.tenant)
  conversations: Conversation[];

  @OneToMany(() => AIAgent, (agent) => agent.tenant)
  aiAgents: AIAgent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
