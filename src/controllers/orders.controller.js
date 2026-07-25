import pool from '../config/db.js';

export async function getAllOrders(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function createOrder(req, res, next) {
  const { customer, item, status = 'pending' } = req.body;
  if (!customer || !item) {
    return res.status(400).json({ error: '"customer" and "item" are required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO orders (customer, item, status) VALUES ($1, $2, $3) RETURNING *',
      [customer, item, status]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateOrder(req, res, next) {
  const { customer, item, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE orders
          SET customer = COALESCE($1, customer),
              item     = COALESCE($2, item),
              status   = COALESCE($3, status)
        WHERE id = $4
    RETURNING *`,
      [customer, item, status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function deleteOrder(req, res, next) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted', order: rows[0] });
  } catch (err) {
    next(err);
  }
}
