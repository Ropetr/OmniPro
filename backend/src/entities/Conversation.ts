import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { Tenant } from './Tenant';
import { Channel } from './Channel';
import { Contact } from './Contact';
import { Message } from './Message';
import { User } from './User';
import { Department } from './Department';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  status: 'open' | 'pending' | 'assigned' | 'closed' | 'archived';

  @Column({ type: 'varchar', length: 50, default: 'normal' })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  @Column({ length: 500, nullable: true })
  subject: string;

  @Column({ type: 'uuid', nullable: true })
  assignedToId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User;

  @Column({ type: 'uuid' })
  channelId: string;

  @ManyToOne(() => Channel, (channel) => channel.conversations)
  @JoinColumn({ name: 'channelId' })
  channel: Channel;

  @Column({ type: 'uuid' })
  contactId: string;

  @ManyToOne(() => Contact, (contact) => contact.conversations)
  @JoinColumn({ name: 'contactId' })
  contact: Contact;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.conversations)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @OneToMany(() => Message, (msg) => msg.conversation)
  messages: Message[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date;

  @Column({ type: 'boolean', default: false })
  isBot: boolean; // Being handled by AI

  @Column({ type: 'uuid', nullable: true })
  departmentId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ type: 'varchar', length: 50, default: 'queued' })
  queueStatus: 'queued' | 'routing' | 'routed' | 'manual';

  @Column({ type: 'int', default: 0 })
  queuePosition: number;

  @Column({ type: 'timestamp', nullable: true })
  queuedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  firstResponseAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
