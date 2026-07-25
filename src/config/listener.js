import pg from 'pg';
import { broadcast } from '../sse/registry.js';

const { Client } = pg;

const BASE_DELAY = 2000;
const MAX_DELAY = 40000;

function getDbConfig(url) {
  if (!url) return {};
  const isCloudOrSsl = url.includes('sslmode=') ||
    url.includes('aivencloud.com');

  const cleanUrl = url.replace(/\?sslmode=[^&]*/, '');

  return {
    connectionString: cleanUrl,
    ...(isCloudOrSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

/**
 * Connect a dedicated pg.Client and start listening on 'orders_changes'.
 * Automatically reconnects if the connection drops.
 */
export async function startListener(delay = BASE_DELAY) {
  const listener = new Client(getDbConfig(process.env.DATABASE_URL));

  listener.on('error', (err) => {
    console.error('[listener] Connection error:', err.message);
  });

  listener.on('end', () => {
    const nextDelay = Math.min(delay * 2, MAX_DELAY);
    console.warn(`[listener] Connection ended. Reconnecting in ${nextDelay}ms...`);
    setTimeout(() => startListener(nextDelay), nextDelay);
  });

  try {
    await listener.connect();
    await listener.query('LISTEN orders_changes');
    console.log('[listener] Successfully connected to PostgreSQL listener on channel "orders_changes"');

    listener.on('notification', (msg) => {
      try {
        const event = JSON.parse(msg.payload);
        broadcast(event);
      } catch (err) {
        console.error('[listener] Failed to parse notification payload:', err.message);
      }
    });
  } catch (err) {
    console.error('[listener] Could not connect to PostgreSQL listener:', err.message);
    const nextDelay = Math.min(delay * 2, MAX_DELAY);
    setTimeout(() => startListener(nextDelay), nextDelay);
  }
}
