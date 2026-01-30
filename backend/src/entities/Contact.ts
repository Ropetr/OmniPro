import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { Tenant } from './Tenant';
import { Conversation } from './Conversation';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: true })
  name: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ length: 255, nullable: true })
  avatar: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  externalId: string; // WhatsApp number, Instagram ID, FB ID, etc.

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string; // webchat, whatsapp, instagram, facebook, mercadolivre, email

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Extra data from source

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.contacts)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @OneToMany(() => Conversation, (conv) => conv.contact)
  conversations: Conversation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
