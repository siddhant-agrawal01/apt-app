// In-memory registry of connected SSE clients.
// Each entry: { id: number, res: express.Response }
const clients = new Map();
let nextId = 1;

/**
 * Register a new SSE client.
 * @param {import('express').Response} res
 * @returns {number} assigned client id
 */
export function addClient(res) {
  const id = nextId++;
  clients.set(id, res);
  console.log(`[sse] client connected   id=${id}  total=${clients.size}`);
  return id;
}

/**
 * Remove a client when their connection closes.
 * @param {number} id
 */
export function removeClient(id) {
  clients.delete(id);
  console.log(`[sse] client disconnected id=${id}  total=${clients.size}`);
}

/**
 * Push an event to every connected SSE client.
 * @param {object} payload
 */
export function broadcast(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const [, res] of clients) {
    res.write(data);
  }
}
