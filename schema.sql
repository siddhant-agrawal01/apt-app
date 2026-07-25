CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL PRIMARY KEY,
  customer   TEXT        NOT NULL,
  item       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- . Trigger function: auto-assign sequential next ID (MAX(id) + 1)
CREATE OR REPLACE FUNCTION set_next_order_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(id), 0) + 1 INTO NEW.id FROM orders;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_next_id ON orders;

CREATE TRIGGER trg_orders_next_id
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_next_order_id();

-- . Trigger function: auto-refresh updated_at on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger function: publish change event to NOTIFY channel
CREATE OR REPLACE FUNCTION notify_order_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload = json_build_object('operation', TG_OP, 'data', row_to_json(OLD));
  ELSE
    payload = json_build_object('operation', TG_OP, 'data', row_to_json(NEW));
  END IF;

  PERFORM pg_notify('orders_changes', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_notify ON orders;

CREATE TRIGGER trg_orders_notify
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_change();

TRUNCATE TABLE orders RESTART IDENTITY;

INSERT INTO orders (customer, item, status) VALUES
  ('Alice', 'Laptop',     'pending'),
  ('Bob',   'Headphones', 'shipped'),
  ('Carol', 'Keyboard',   'delivered');
