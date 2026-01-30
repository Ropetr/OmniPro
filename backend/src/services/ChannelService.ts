import { AppDataSource } from '../config/database';
import { Channel, ChannelType } from '../entities/Channel';
import { AppError } from '../middleware/errorHandler';

const channelRepo = () => AppDataSource.getRepository(Channel);

export class ChannelService {
  static async list(tenantId: string) {
    return channelRepo().find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  static async getById(id: string, tenantId: string) {
    const channel = await channelRepo().findOne({ where: { id, tenantId } });
    if (!channel) throw new AppError('Channel not found', 404);
    return channel;
  }

  static async create(tenantId: string, data: {
    name: string;
    type: ChannelType;
    config?: Record<string, any>;
  }) {
    const channel = channelRepo().create({
      name: data.name,
      type: data.type,
      config: data.config || {},
      tenantId,
    });
    return channelRepo().save(channel);
  }

  static async update(id: string, tenantId: string, data: Partial<{
    name: string;
    config: Record<string, any>;
    isActive: boolean;
  }>) {
    const channel = await this.getById(id, tenantId);
    Object.assign(channel, data);
    return channelRepo().save(channel);
  }

  static async delete(id: string, tenantId: string) {
    const channel = await this.getById(id, tenantId);
    await channelRepo().remove(channel);
  }

  static async getByType(tenantId: string, type: ChannelType) {
    return channelRepo().find({ where: { tenantId, type, isActive: true } });
  }
}
