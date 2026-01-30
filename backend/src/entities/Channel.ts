import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { Tenant } from './Tenant';
import { Conversation } from './Conversation';

export type ChannelType = 'webchat' | 'whatsapp' | 'instagram' | 'facebook' | 'mercadolivre' | 'email';

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  type: ChannelType;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any>;
  // webchat: { widgetColor, welcomeMessage, ... }
  // whatsapp: { instanceName, apiKey, ... }
  // instagram: { pageId, accessToken, ... }
  // facebook: { pageId, accessToken, ... }
  // mercadolivre: { sellerId, accessToken, refreshToken, ... }
  // email: { imapHost, smtpHost, user, password, ... }

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.channels)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @OneToMany(() => Conversation, (conv) => conv.channel)
  conversations: Conversation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
