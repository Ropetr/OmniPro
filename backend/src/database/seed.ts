import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initializeDatabase, AppDataSource } from '../config/database';
import { Tenant } from '../entities/Tenant';
import { User } from '../entities/User';
import { Channel } from '../entities/Channel';
import { AIAgent } from '../entities/AIAgent';
import { KnowledgeBase } from '../entities/KnowledgeBase';
import { logger } from '../utils/logger';

async function seed() {
  await initializeDatabase();
  logger.info('Database connected. Running seed...');

  const tenantRepo = AppDataSource.getRepository(Tenant);
  const userRepo = AppDataSource.getRepository(User);
  const channelRepo = AppDataSource.getRepository(Channel);
  const aiAgentRepo = AppDataSource.getRepository(AIAgent);
  const kbRepo = AppDataSource.getRepository(KnowledgeBase);

  // Create demo tenant
  let tenant = await tenantRepo.findOne({ where: { slug: 'demo' } });
  if (!tenant) {
    tenant = tenantRepo.create({
      name: 'Demo Company',
      slug: 'demo',
      status: 'active',
      plan: 'professional',
      settings: {
        widgetColor: '#4F46E5',
        welcomeMessage: 'Olá! Como podemos ajudar você hoje?',
        offlineMessage: 'Estamos offline no momento. Deixe sua mensagem que retornaremos em breve!',
      },
    });
    await tenantRepo.save(tenant);
    logger.info('Demo tenant created');
  }

  // Create admin user
  let admin = await userRepo.findOne({ where: { email: 'admin@omnipro.com' } });
  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    admin = userRepo.create({
      name: 'Administrador',
      email: 'admin@omnipro.com',
      password: hashedPassword,
      role: 'admin',
      tenantId: tenant.id,
      status: 'online',
    });
    await userRepo.save(admin);
    logger.info('Admin user created: admin@omnipro.com / admin123');
  }

  // Create agent user
  let agent = await userRepo.findOne({ where: { email: 'agente@omnipro.com' } });
  if (!agent) {
    const hashedPassword = await bcrypt.hash('agent123', 12);
    agent = userRepo.create({
      name: 'Agente de Suporte',
      email: 'agente@omnipro.com',
      password: hashedPassword,
      role: 'agent',
      tenantId: tenant.id,
    });
    await userRepo.save(agent);
    logger.info('Agent user created: agente@omnipro.com / agent123');
  }

  // Create channels
  const channelDefs = [
    { name: 'Chat do Site', type: 'webchat' as const, config: { widgetColor: '#4F46E5', welcomeMessage: 'Olá! Como podemos ajudar?' } },
    { name: 'WhatsApp', type: 'whatsapp' as const, config: { instanceName: 'omnipro_demo' } },
    { name: 'Instagram', type: 'instagram' as const, config: {} },
    { name: 'Facebook Messenger', type: 'facebook' as const, config: {} },
    { name: 'MercadoLivre', type: 'mercadolivre' as const, config: {} },
    { name: 'Email', type: 'email' as const, config: {} },
  ];

  for (const def of channelDefs) {
    const existing = await channelRepo.findOne({
      where: { tenantId: tenant.id, type: def.type },
    });
    if (!existing) {
      await channelRepo.save(channelRepo.create({
        ...def,
        tenantId: tenant.id,
      }));
      logger.info(`Channel created: ${def.name}`);
    }
  }

  // Create AI Agent
  let aiAgent = await aiAgentRepo.findOne({ where: { tenantId: tenant.id } });
  if (!aiAgent) {
    aiAgent = aiAgentRepo.create({
      name: 'Assistente OmniPro',
      systemPrompt: `Você é o assistente virtual da Demo Company.
Seja educado, prestativo e objetivo.
Responda sempre em português brasileiro.
Se não souber a resposta, ofereça transferir para um atendente humano.`,
      model: 'gpt-4o',
      temperature: 0.7,
      isActive: true,
      autoReply: true,
      learnFromConversations: true,
      tenantId: tenant.id,
    });
    await aiAgentRepo.save(aiAgent);
    logger.info('AI Agent created');

    // Add knowledge base entries
    const kbEntries = [
      {
        title: 'Horário de Funcionamento',
        content: 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Aos sábados das 8h às 12h.',
        contentType: 'faq' as const,
      },
      {
        title: 'Política de Devolução',
        content: 'Aceitamos devoluções em até 30 dias após a compra, desde que o produto esteja em sua embalagem original e sem uso.',
        contentType: 'faq' as const,
      },
      {
        title: 'Formas de Pagamento',
        content: 'Aceitamos cartão de crédito (até 12x), débito, PIX e boleto bancário. Parcelamento sem juros em compras acima de R$100.',
        contentType: 'faq' as const,
      },
      {
        title: 'Prazo de Entrega',
        content: 'O prazo de entrega varia de 3 a 10 dias úteis, dependendo da sua localização. Frete grátis para compras acima de R$200.',
        contentType: 'faq' as const,
      },
      {
        title: 'Contato',
        content: 'Telefone: (11) 1234-5678 | Email: contato@democompany.com | WhatsApp: (11) 91234-5678',
        contentType: 'faq' as const,
      },
    ];

    for (const entry of kbEntries) {
      await kbRepo.save(kbRepo.create({
        ...entry,
        source: 'manual',
        aiAgentId: aiAgent.id,
      }));
    }
    logger.info('Knowledge base entries created');
  }

  logger.info('Seed completed!');
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
