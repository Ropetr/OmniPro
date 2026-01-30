import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Tenant } from './Tenant';
import { KnowledgeBase } from './KnowledgeBase';

@Entity('ai_agents')
export class AIAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  systemPrompt: string;

  @Column({ type: 'varchar', length: 100, default: 'gpt-4o' })
  model: string;

  @Column({ type: 'float', default: 0.7 })
  temperature: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: true })
  autoReply: boolean;

  @Column({ type: 'boolean', default: true })
  learnFromConversations: boolean;

  @Column({ type: 'jsonb', nullable: true })
  triggerChannels: string[]; // channel IDs where bot is active

  @Column({ type: 'jsonb', nullable: true })
  quickReplies: Array<{ trigger: string; response: string }>;

  @Column({ type: 'int', default: 0 })
  totalInteractions: number;

  @Column({ type: 'float', default: 0 })
  satisfactionScore: number;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.aiAgents)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @OneToMany(() => KnowledgeBase, (kb) => kb.aiAgent)
  knowledgeBases: KnowledgeBase[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
