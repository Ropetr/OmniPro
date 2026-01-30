import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { Contact } from '../entities/Contact';

export const contactRouter = Router();
contactRouter.use(authenticate);

const contactRepo = () => AppDataSource.getRepository(Contact);

// List contacts
contactRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', search } = req.query;
    const qb = contactRepo().createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId: req.tenantId });

    if (search) {
      qb.andWhere('(c.name ILIKE :search OR c.email ILIKE :search OR c.phone ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('c.updatedAt', 'DESC')
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .take(parseInt(limit as string));

    const [contacts, total] = await qb.getManyAndCount();
    res.json({ contacts, total });
  } catch (error) {
    next(error);
  }
});

// Get contact
contactRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contact = await contactRepo().findOne({
      where: { id: req.params.id, tenantId: req.tenantId },
      relations: ['conversations'],
    });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Update contact
contactRouter.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contact = await contactRepo().findOne({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const { name, email, phone, tags, notes } = req.body;
    Object.assign(contact, { name, email, phone, tags, notes });
    await contactRepo().save(contact);
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Delete contact
contactRouter.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await contactRepo().delete({ id: req.params.id, tenantId: req.tenantId });
    res.json({ message: 'Contact deleted' });
  } catch (error) {
    next(error);
  }
});
