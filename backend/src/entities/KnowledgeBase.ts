import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { AIAgent } from './AIAgent';

@Entity('knowledge_bases')
export class KnowledgeBase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 50, default: 'manual' })
  source: 'manual' | 'conversation' | 'file' | 'url';

  @Column({ type: 'varchar', length: 500, nullable: true })
  sourceRef: string; // URL or file path

  @Column({ type: 'varchar', length: 50, default: 'text' })
  contentType: 'text' | 'faq' | 'product' | 'procedure';

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'uuid' })
  aiAgentId: string;

  @ManyToOne(() => AIAgent, (agent) => agent.knowledgeBases)
  @JoinColumn({ name: 'aiAgentId' })
  aiAgent: AIAgent;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
