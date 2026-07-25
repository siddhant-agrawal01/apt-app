# Real-Time Order Updates System

A backend service that pushes live updates to connected clients the instant a
row in the `orders` table is inserted, updated, or deleted — no client
polling.

**Final Architecture:**
`PostgreSQL (LISTEN/NOTIFY) → Node.js Backend → Server-Sent Events (SSE) → Browser Client`

---

## 1. High-Level Design (HLD)

```
┌─────────────┐        ┌──────────────────────────┐        ┌──────────────┐
│  PostgreSQL │        │        Node.js            │        │   Browser    │
│             │        │        Backend            │        │   Client(s)  │
│  orders     │ Trigger│                            │  SSE   │              │
│  table      ├───────▶│  ┌──────────────────────┐  ├───────▶│ EventSource  │
│             │        │  │ LISTEN connection     │  │        │ + live table │
│  AFTER      │NOTIFY  │  │ (channel:             │  │        │              │
│  INSERT/    ├───────▶│  │  orders_changes)      │  │        └──────────────┘
│  UPDATE/    │        │  └──────────┬───────────┘  │
│  DELETE     │        │             │broadcast()    │
│  trigger    │        │  ┌──────────▼───────────┐  │
│             │        │  │ SSE connection        │  │
└─────────────┘        │  │ registry (in-memory)  │  │
      ▲                │  └──────────────────────┘  │
      │                │                            │
      │  REST (CRUD)   │  ┌──────────────────────┐  │
      └────────────────┤  │ Express REST API      │◀─┼── POST/PUT/DELETE
                        │  │ /api/orders           │  │    (from client)
                        │  └──────────────────────┘  │
                        └──────────────────────────┘
```

### Components

| Component | Role |
|---|---|
| **PostgreSQL** | Stores `orders`. A trigger fires on every row-level `INSERT`/`UPDATE`/`DELETE` and publishes a JSON change event via `pg_notify()`. |
| **Trigger function** | Builds `{ operation, data }` payload and calls `pg_notify('orders_changes', payload)`. |
| **Node.js backend** | Holds one dedicated `LISTEN orders_changes` connection. On each notification, parses the payload and broadcasts it to all open SSE connections. Also exposes REST endpoints for CRUD operations on `orders`. |
| **SSE layer (`/events`)** | Each connected client holds one open HTTP response stream. Backend writes `data: {...}\n\n` to every stream when a change occurs. |
| **Browser client** | Opens `new EventSource('/events')`, listens for `message` events, updates the UI in place — no polling, no manual refresh. |

### Data Flow (end to end)

1. A write happens on `orders` — via the REST API, `psql`, a script, or any other source.
2. PostgreSQL commits the transaction; the `AFTER` trigger fires and calls `pg_notify()`.
3. The backend's LISTEN connection receives the notification asynchronously.
4. The backend parses the JSON payload and calls `broadcast()`, writing the event to every connected SSE client.
5. Each browser's `EventSource.onmessage` fires, updating the order table live.

---

## 2. Project Structure

```
realtime-orders/
├── schema.sql        # Table, trigger function, trigger, seed data
├── server.js         # Express API + PG LISTEN connection + SSE broadcast
├── package.json
└── public/
    └── index.html    # Browser client (EventSource + live table)
```

---

## 3. Implementation Workflow

### Step 1 — Set up PostgreSQL

```bash
createdb orders_db
```

### Step 2 — Define the schema and trigger (`schema.sql`)

- Create the `orders` table.
- Create a trigger function `notify_order_change()` that:
  - Uses `row_to_json(NEW)` for `INSERT`/`UPDATE`.
  - Uses `row_to_json(OLD)` for `DELETE` (since `NEW` doesn't exist on delete).
  - Wraps the result as `{ "operation": TG_OP, "data": {...} }`.
  - Calls `pg_notify('orders_changes', payload::text)`.
- Attach it with `CREATE TRIGGER ... AFTER INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION notify_order_change();`
- Add a `BEFORE UPDATE` trigger to auto-refresh `updated_at`.

Apply it:
```bash
psql -d orders_db -f schema.sql
```

### Step 3 — Build the Node.js backend (`server.js`)

1. **REST layer** — Express routes for `GET/POST/PUT/DELETE /api/orders` using a connection **pool** (`pg.Pool`) for normal query/response traffic.
2. **Listener layer** — a **separate, single `pg.Client`** (not from the pool, since it must stay open indefinitely):
   ```js
   const listener = new Client({ connectionString: DATABASE_URL });
   await listener.connect();
   await listener.query('LISTEN orders_changes');
   listener.on('notification', (msg) => {
     const event = JSON.parse(msg.payload);
     broadcast(event);
   });
   ```
   Include an `error` handler that reconnects after a delay if the connection drops.
3. **SSE layer** — `GET /events`:
   ```js
   app.get('/events', (req, res) => {
     res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
     res.flushHeaders();
     sseClients.push({ id, res });
     req.on('close', () => { /* remove from sseClients */ });
   });
   ```
   `broadcast(event)` loops over `sseClients` and writes `data: ${JSON.stringify(event)}\n\n` to each.
   Send a periodic `: ping\n\n` comment (e.g. every 30s) to keep idle connections alive through proxies.

### Step 4 — Build the browser client (`public/index.html`)

1. On load, `fetch('/api/orders')` to render initial state.
2. Open `const source = new EventSource('/events')`.
3. `source.onmessage = (e) => { const { operation, data } = JSON.parse(e.data); /* update local order map + re-render */ }`.
4. Provide simple buttons/forms that call the REST API to create orders / advance status / delete — this is what generates changes to observe live.

### Step 5 — Run and verify

```bash
npm install
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/orders_db"
npm start
```
Open `http://localhost:3000` in two browser tabs. Trigger a change from either tab, or directly via:
```bash
psql -d orders_db -c "UPDATE orders SET status = 'shipped' WHERE id = 1;"
```
Both tabs should update instantly with no refresh — confirming changes are captured regardless of source, and delivered in real time without polling.

---

## 4. Correctness Checklist

- [x] Trigger fires on `INSERT`, `UPDATE`, and `DELETE`.
- [x] Payload always reflects the final row state (`NEW` vs `OLD` handled correctly).
- [x] `updated_at` is auto-maintained, not client-supplied.
- [x] LISTEN connection auto-reconnects on failure.
- [x] SSE connections clean up (`req.on('close')`) to avoid memory leaks from stale clients.
- [x] Heartbeat pings prevent idle-timeout disconnects.

---

<!-- 1. Insert an order
bash
npm run db:query "INSERT INTO orders (customer, item, status) VALUES ('Test User', 'Test Product', 'pending')"
2. Update an order
bash
npm run db:query "UPDATE orders SET status = 'shipped' WHERE id = 1"
3. Delete an order
bash
npm run db:query "DELETE FROM orders WHERE id = 2"
4. View all orders
bash
npm run db:query "SELECT id, customer, item, status FROM orders" -->