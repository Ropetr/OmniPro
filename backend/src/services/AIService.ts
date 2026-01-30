import OpenAI from 'openai';
import { AppDataSource } from '../config/database';
import { AIAgent } from '../entities/AIAgent';
import { KnowledgeBase } from '../entities/KnowledgeBase';
import { Message } from '../entities/Message';
import { Conversation } from '../entities/Conversation';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';

const aiAgentRepo = () => AppDataSource.getRepository(AIAgent);
const kbRepo = () => AppDataSource.getRepository(KnowledgeBase);
const msgRepo = () => AppDataSource.getRepository(Message);
const convRepo = () => AppDataSource.getRepository(Conversation);

export class AIService {
  private static getClient(): OpenAI {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Generate reply for a conversation
  static async generateReply(tenantId: string, conversationId: string, userMessage: string): Promise<string | null> {
    try {
      // Find active AI agent for this tenant
      const aiAgent = await aiAgentRepo().findOne({
        where: { tenantId, isActive: true },
        relations: ['knowledgeBases'],
      });
      if (!aiAgent) return null;

      const client = this.getClient();

      // Build context from knowledge base
      const knowledge = await this.getRelevantKnowledge(aiAgent.id, userMessage);

      // Get conversation history (last 20 messages)
      const history = await msgRepo().find({
        where: { conversationId },
        order: { createdAt: 'DESC' },
        take: 20,
      });
      history.reverse();

      // Build messages array
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(aiAgent, knowledge),
        },
      ];

      // Add conversation history
      for (const msg of history) {
        if (msg.sender === 'contact') {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.sender === 'bot' || msg.sender === 'agent') {
          messages.push({ role: 'assistant', content: msg.content });
        }
      }

      // Add current message if not already in history
      if (!history.some(m => m.content === userMessage && m.sender === 'contact')) {
        messages.push({ role: 'user', content: userMessage });
      }

      // Generate response
      const response = await client.chat.completions.create({
        model: aiAgent.model || process.env.OPENAI_MODEL || 'gpt-4o',
        messages,
        temperature: aiAgent.temperature || 0.7,
        max_tokens: 1000,
      });

      const reply = response.choices[0]?.message?.content;
      if (!reply) return null;

      // Update stats
      await aiAgentRepo().increment({ id: aiAgent.id }, 'totalInteractions', 1);

      // Learn from conversation if enabled
      if (aiAgent.learnFromConversations) {
        await this.learnFromInteraction(aiAgent.id, userMessage, reply);
      }

      return reply;
    } catch (error) {
      logger.error('AI generate reply failed:', error);
      return null;
    }
  }

  // Build system prompt with knowledge context
  private static buildSystemPrompt(agent: AIAgent, knowledge: string): string {
    const basePrompt = agent.systemPrompt || `Você é um assistente virtual profissional de atendimento ao cliente.
Seja educado, objetivo e útil. Responda em português brasileiro.
Se não souber a resposta, seja honesto e ofereça transferir para um atendente humano.`;

    let prompt = basePrompt;

    if (knowledge) {
      prompt += `\n\n=== BASE DE CONHECIMENTO ===\nUse as informações abaixo para responder:\n${knowledge}\n=== FIM DA BASE ===`;
    }

    prompt += `\n\nRegras:
- Responda de forma concisa e direta
- Use linguagem amigável e profissional
- Se o cliente pedir para falar com humano, responda: "Vou transferir você para um atendente. Aguarde um momento."
- Não invente informações que não estão na base de conhecimento
- Se o assunto for complexo demais, sugira a transferência para atendente humano`;

    return prompt;
  }

  // Search relevant knowledge base entries
  private static async getRelevantKnowledge(agentId: string, query: string): Promise<string> {
    try {
      const entries = await kbRepo().find({
        where: { aiAgentId: agentId, isActive: true },
        order: { usageCount: 'DESC' },
        take: 10,
      });

      if (entries.length === 0) return '';

      // Simple keyword matching (can be replaced with vector search)
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

      const scored = entries.map(entry => {
        const contentLower = (entry.title + ' ' + entry.content).toLowerCase();
        let score = 0;
        for (const word of queryWords) {
          if (contentLower.includes(word)) score++;
        }
        return { entry, score };
      }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

      const relevant = scored.slice(0, 5);
      if (relevant.length === 0) return entries.slice(0, 3).map(e => `${e.title}: ${e.content}`).join('\n\n');

      // Update usage count
      for (const { entry } of relevant) {
        await kbRepo().increment({ id: entry.id }, 'usageCount', 1);
      }

      return relevant.map(({ entry }) => `${entry.title}: ${entry.content}`).join('\n\n');
    } catch (error) {
      logger.error('Knowledge base search failed:', error);
      return '';
    }
  }

  // Learn from conversation interaction
  private static async learnFromInteraction(agentId: string, question: string, answer: string) {
    try {
      const redis = getRedis();
      const key = `ai:learning:${agentId}`;

      // Store interaction in Redis for batch processing
      await redis.lpush(key, JSON.stringify({
        question,
        answer,
        timestamp: Date.now(),
      }));

      // Keep only last 1000 interactions
      await redis.ltrim(key, 0, 999);

      // Every 50 interactions, create knowledge base entry
      const count = await redis.llen(key);
      if (count % 50 === 0) {
        await this.processLearning(agentId);
      }
    } catch (error) {
      logger.debug('Learning storage failed:', error);
    }
  }

  // Process accumulated learning data
  static async processLearning(agentId: string) {
    try {
      const redis = getRedis();
      const key = `ai:learning:${agentId}`;
      const interactions = await redis.lrange(key, 0, 49);

      if (interactions.length < 10) return;

      const parsed = interactions.map(i => JSON.parse(i));

      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Analise as seguintes interações de atendimento ao cliente e extraia os padrões mais comuns de perguntas e respostas.
Retorne no formato JSON: [{"title": "Título do tópico", "content": "Pergunta comum e melhor resposta"}]
Retorne no máximo 5 itens. Foque nos padrões mais frequentes.`,
          },
          {
            role: 'user',
            content: JSON.stringify(parsed.slice(0, 30)),
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return;

      const result = JSON.parse(content);
      const items = result.items || result.data || (Array.isArray(result) ? result : []);

      for (const item of items) {
        if (item.title && item.content) {
          const existing = await kbRepo().findOne({
            where: { aiAgentId: agentId, title: item.title, source: 'conversation' },
          });

          if (existing) {
            existing.content = item.content;
            await kbRepo().save(existing);
          } else {
            await kbRepo().save(kbRepo().create({
              aiAgentId: agentId,
              title: item.title,
              content: item.content,
              source: 'conversation',
              contentType: 'faq',
            }));
          }
        }
      }

      logger.info(`AI learning processed for agent ${agentId}: ${items.length} entries`);
    } catch (error) {
      logger.error('AI learning processing failed:', error);
    }
  }

  // CRUD for AI Agents
  static async createAgent(tenantId: string, data: Partial<AIAgent>) {
    const agent = aiAgentRepo().create({ ...data, tenantId });
    return aiAgentRepo().save(agent);
  }

  static async updateAgent(id: string, tenantId: string, data: Partial<AIAgent>) {
    const agent = await aiAgentRepo().findOne({ where: { id, tenantId } });
    if (!agent) throw new Error('AI Agent not found');
    Object.assign(agent, data);
    return aiAgentRepo().save(agent);
  }

  static async getAgents(tenantId: string) {
    return aiAgentRepo().find({
      where: { tenantId },
      relations: ['knowledgeBases'],
    });
  }

  // CRUD for Knowledge Base
  static async addKnowledge(agentId: string, data: Partial<KnowledgeBase>) {
    const entry = kbRepo().create({ ...data, aiAgentId: agentId });
    return kbRepo().save(entry);
  }

  static async updateKnowledge(id: string, data: Partial<KnowledgeBase>) {
    const entry = await kbRepo().findOne({ where: { id } });
    if (!entry) throw new Error('Knowledge base entry not found');
    Object.assign(entry, data);
    return kbRepo().save(entry);
  }

  static async deleteKnowledge(id: string) {
    await kbRepo().delete(id);
  }

  static async getKnowledge(agentId: string) {
    return kbRepo().find({
      where: { aiAgentId: agentId },
      order: { createdAt: 'DESC' },
    });
  }
}
