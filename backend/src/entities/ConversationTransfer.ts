import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Conversation } from './Conversation';
import { Department } from './Department';
import { User } from './User';

@Entity('conversation_transfers')
export class ConversationTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column({ type: 'uuid', nullable: true })
  fromDepartmentId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'fromDepartmentId' })
  fromDepartment: Department;

  @Column({ type: 'uuid', nullable: true })
  toDepartmentId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'toDepartmentId' })
  toDepartment: Department;

  @Column({ type: 'uuid', nullable: true })
  fromAgentId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'fromAgentId' })
  fromAgent: User;

  @Column({ type: 'uuid', nullable: true })
  toAgentId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'toAgentId' })
  toAgent: User;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn()
  transferredAt: Date;
}
