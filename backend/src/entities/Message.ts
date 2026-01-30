import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Conversation } from './Conversation';
import { User } from './User';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 50, default: 'text' })
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'location' | 'system';

  @Column({ type: 'varchar', length: 50 })
  sender: 'contact' | 'agent' | 'bot' | 'system';

  @Column({ type: 'uuid', nullable: true })
  agentId: string;

  @ManyToOne(() => User, (user) => user.messages, { nullable: true })
  @JoinColumn({ name: 'agentId' })
  agent: User;

  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, (conv) => conv.messages)
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column({ type: 'varchar', length: 500, nullable: true })
  externalId: string; // ID from external platform

  @Column({ type: 'varchar', length: 50, default: 'sent' })
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{
    url: string;
    name: string;
    type: string;
    size: number;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
