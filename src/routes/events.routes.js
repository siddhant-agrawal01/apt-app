import { Router } from 'express';
import { addClient, removeClient } from '../sse/registry.js';

const router = Router();

router.get('/', (req, res) => {
  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders();

  const id = addClient(res);

  // beat every 30 s — keeps idle connections alive through proxies.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(id);
  });
});

export default router;
