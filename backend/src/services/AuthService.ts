import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Tenant } from '../entities/Tenant';
import { AppError } from '../middleware/errorHandler';

const userRepo = () => AppDataSource.getRepository(User);
const tenantRepo = () => AppDataSource.getRepository(Tenant);

export class AuthService {
  static async register(data: {
    name: string;
    email: string;
    password: string;
    tenantName: string;
  }) {
    const existing = await userRepo().findOne({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409);

    // Create tenant
    const slug = data.tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const tenant = tenantRepo().create({
      name: data.tenantName,
      slug,
      status: 'active',
      plan: 'free',
      settings: {
        widgetColor: '#4F46E5',
        welcomeMessage: 'Olá! Como podemos ajudar?',
        offlineMessage: 'Estamos offline no momento. Deixe sua mensagem!',
        businessHours: {
          enabled: false,
          timezone: 'America/Sao_Paulo',
        },
      },
    });
    await tenantRepo().save(tenant);

    // Create admin user
    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = userRepo().create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: 'admin',
      tenantId: tenant.id,
    });
    await userRepo().save(user);

    const tokens = this.generateTokens(user, tenant.id);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      ...tokens,
    };
  }

  static async login(email: string, password: string) {
    const user = await userRepo().findOne({
      where: { email },
      relations: ['tenant'],
    });
    if (!user) throw new AppError('Invalid credentials', 401);
    if (!user.isActive) throw new AppError('Account deactivated', 403);

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new AppError('Invalid credentials', 401);

    const tokens = this.generateTokens(user, user.tenantId);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
      tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
      ...tokens,
    };
  }

  static async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      const user = await userRepo().findOne({ where: { id: decoded.userId } });
      if (!user) throw new AppError('User not found', 404);

      return this.generateTokens(user, decoded.tenantId);
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  private static generateTokens(user: User, tenantId: string) {
    const accessToken = jwt.sign(
      { userId: user.id, tenantId, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRATION || '15m' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, tenantId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d' }
    );

    return { accessToken, refreshToken };
  }
}
