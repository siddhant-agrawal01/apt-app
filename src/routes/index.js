import { Router } from 'express';
import ordersRouter from './orders.routes.js';
import eventsRouter from './events.routes.js';

const router = Router();

router.use('/orders', ordersRouter);
router.use('/events', eventsRouter);

export default router;
