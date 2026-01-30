import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { AIService } from '../services/AIService';

export const aiRouter = Router();
aiRouter.use(authenticate);

// === AI Agents ===

// List AI agents
aiRouter.get('/agents', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agents = await AIService.getAgents(req.tenantId!);
    res.json(agents);
  } catch (error) {
    next(error);
  }
});

// Create AI agent
aiRouter.post('/agents', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, systemPrompt, model, temperature, autoReply, learnFromConversations, triggerChannels } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const agent = await AIService.createAgent(req.tenantId!, {
      name,
      systemPrompt,
      model,
      temperature,
      autoReply,
      learnFromConversations,
      triggerChannels,
    });
    res.status(201).json(agent);
  } catch (error) {
    next(error);
  }
});

// Update AI agent
aiRouter.put('/agents/:id', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agent = await AIService.updateAgent(req.params.id, req.tenantId!, req.body);
    res.json(agent);
  } catch (error) {
    next(error);
  }
});

// === Knowledge Base ===

// Get knowledge base for an agent
aiRouter.get('/agents/:agentId/knowledge', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entries = await AIService.getKnowledge(req.params.agentId);
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

// Add knowledge entry
aiRouter.post('/agents/:agentId/knowledge', authorize('admin', 'supervisor'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, content, contentType, tags } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

    const entry = await AIService.addKnowledge(req.params.agentId, {
      title,
      content,
      contentType,
      tags,
      source: 'manual',
    });
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

// Update knowledge entry
aiRouter.put('/knowledge/:id', authorize('admin', 'supervisor'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await AIService.updateKnowledge(req.params.id, req.body);
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

// Delete knowledge entry
aiRouter.delete('/knowledge/:id', authorize('admin', 'supervisor'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await AIService.deleteKnowledge(req.params.id);
    res.json({ message: 'Knowledge entry deleted' });
  } catch (error) {
    next(error);
  }
});

// Force learning processing
aiRouter.post('/agents/:agentId/learn', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await AIService.processLearning(req.params.agentId);
    res.json({ message: 'Learning process triggered' });
  } catch (error) {
    next(error);
  }
});

// Test AI reply (counts toward readiness)
aiRouter.post('/agents/:agentId/test', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const reply = await AIService.generateReply(req.tenantId!, 'test', message);

    // Record test interaction for readiness tracking
    await AIService.recordTestInteraction(req.params.agentId);

    // Check if readiness changed
    const readiness = await AIService.checkReadiness(req.params.agentId);

    res.json({
      reply: reply || 'Sem resposta gerada',
      readiness,
    });
  } catch (error) {
    next(error);
  }
});

// Check readiness status
aiRouter.get('/agents/:agentId/readiness', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const readiness = await AIService.checkReadiness(req.params.agentId);
    res.json(readiness);
  } catch (error) {
    next(error);
  }
});

// Activate bot for live auto-replies
aiRouter.post('/agents/:agentId/activate', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agent = await AIService.activate(req.params.agentId, req.tenantId!);
    res.json({ message: 'Agente IA ativado para atendimento ao vivo', agent });
  } catch (error) {
    next(error);
  }
});

// Pause bot
aiRouter.post('/agents/:agentId/pause', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agent = await AIService.pause(req.params.agentId, req.tenantId!);
    res.json({ message: 'Agente IA pausado', agent });
  } catch (error) {
    next(error);
  }
});
