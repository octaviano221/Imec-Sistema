const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const writeRoles = ['admin', 'rh', 'engenharia'];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clean(value) {
  return value == null ? null : String(value).trim();
}

async function audit(userId, action, entityType, entityId, description) {
  try {
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, description]
    );
  } catch (err) {
    console.warn('Auditoria do almoxarifado ignorada:', err && err.message ? err.message : err);
  }
}

async function nextOrderNumber(conn) {
  const year = new Date().getFullYear();
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS total FROM purchase_orders WHERE order_number LIKE ?',
    [`PC-${year}-%`]
  );
  const seq = String((rows[0] && rows[0].total ? Number(rows[0].total) : 0) + 1).padStart(4, '0');
  return `PC-${year}-${seq}`;
}

function orderStatus(order) {
  if (order.status === 'recebido' || order.status === 'cancelado') return order.status;
  if (!order.expected_date) return order.status || 'rascunho';
  const due = new Date(order.expected_date);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due < today) return 'atrasado';
  return order.status || 'solicitado';
}

async function listOrders() {
  const [orders] = await db.query(`
    SELECT po.*, s.name AS supplier_name, p.name AS project_name
    FROM purchase_orders po
    LEFT JOIN stock_suppliers s ON s.id = po.supplier_id
    LEFT JOIN projects p ON p.id = po.project_id
    ORDER BY po.created_at DESC
  `);
  const [items] = await db.query(`
    SELECT poi.*, si.name AS stock_item_name, si.category AS stock_item_category
    FROM purchase_order_items poi
    LEFT JOIN stock_items si ON si.id = poi.stock_item_id
    ORDER BY poi.id ASC
  `);
  const grouped = items.reduce((acc, item) => {
    const key = String(item.purchase_order_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  return orders.map((order) => ({
    ...order,
    computed_status: orderStatus(order),
    items: grouped[String(order.id)] || []
  }));
}

router.get('/summary', authenticate, async (req, res) => {
  try {
    const [suppliers] = await db.query('SELECT * FROM stock_suppliers ORDER BY name ASC');
    const [items] = await db.query(`
      SELECT si.*, ss.name AS supplier_name
      FROM stock_items si
      LEFT JOIN stock_suppliers ss ON ss.id = si.supplier_id
      ORDER BY si.name ASC
    `);
    const orders = await listOrders();
    const openOrders = orders.filter((order) => !['recebido', 'cancelado'].includes(order.status));
    const lowStock = items.filter((item) => num(item.current_stock) <= num(item.minimum_stock));
    const totalOpen = openOrders.reduce((sum, order) => sum + num(order.total_value), 0);
    res.json({
      suppliers,
      items,
      orders,
      metrics: {
        suppliers: suppliers.length,
        items: items.length,
        open_orders: openOrders.length,
        low_stock: lowStock.length,
        total_open: totalOpen
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar almoxarifado' });
  }
});

router.get('/suppliers', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM stock_suppliers ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar fornecedores' });
  }
});

router.post('/suppliers', authenticate, authorize(...writeRoles), async (req, res) => {
  try {
    const data = req.body || {};
    const [result] = await db.query(
      `INSERT INTO stock_suppliers
      (name, cnpj, contact_name, phone, email, address, city, state, payment_terms, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clean(data.name), clean(data.cnpj), clean(data.contact_name), clean(data.phone), clean(data.email),
        clean(data.address), clean(data.city), clean(data.state), clean(data.payment_terms),
        clean(data.status) || 'ativo', clean(data.notes)
      ]
    );
    await audit(req.user.id, 'create', 'stock_supplier', result.insertId, `Fornecedor ${data.name || result.insertId} cadastrado`);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar fornecedor' });
  }
});

router.put('/suppliers/:id', authenticate, authorize(...writeRoles), async (req, res) => {
  try {
    const data = req.body || {};
    await db.query(
      `UPDATE stock_suppliers SET
        name=?, cnpj=?, contact_name=?, phone=?, email=?, address=?, city=?, state=?, payment_terms=?, status=?, notes=?
      WHERE id=?`,
      [
        clean(data.name), clean(data.cnpj), clean(data.contact_name), clean(data.phone), clean(data.email),
        clean(data.address), clean(data.city), clean(data.state), clean(data.payment_terms),
        clean(data.status) || 'ativo', clean(data.notes), req.params.id
      ]
    );
    await audit(req.user.id, 'update', 'stock_supplier', req.params.id, `Fornecedor ${req.params.id} atualizado`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
  }
});

router.delete('/suppliers/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM stock_suppliers WHERE id=?', [req.params.id]);
    await audit(req.user.id, 'delete', 'stock_supplier', req.params.id, `Fornecedor ${req.params.id} excluido`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir fornecedor' });
  }
});

router.get('/items', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT si.*, ss.name AS supplier_name
      FROM stock_items si
      LEFT JOIN stock_suppliers ss ON ss.id = si.supplier_id
      ORDER BY si.name ASC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar itens' });
  }
});

router.post('/items', authenticate, authorize(...writeRoles), async (req, res) => {
  try {
    const data = req.body || {};
    const [result] = await db.query(
      `INSERT INTO stock_items
      (name, category, unit, sku, ca_number, current_stock, minimum_stock, average_cost, location, supplier_id, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clean(data.name), clean(data.category), clean(data.unit) || 'un', clean(data.sku), clean(data.ca_number),
        num(data.current_stock), num(data.minimum_stock), num(data.average_cost), clean(data.location),
        data.supplier_id || null, clean(data.status) || 'ativo', clean(data.notes)
      ]
    );
    await audit(req.user.id, 'create', 'stock_item', result.insertId, `Item ${data.name || result.insertId} cadastrado`);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar item' });
  }
});

router.put('/items/:id', authenticate, authorize(...writeRoles), async (req, res) => {
  try {
    const data = req.body || {};
    await db.query(
      `UPDATE stock_items SET
        name=?, category=?, unit=?, sku=?, ca_number=?, current_stock=?, minimum_stock=?, average_cost=?,
        location=?, supplier_id=?, status=?, notes=?
      WHERE id=?`,
      [
        clean(data.name), clean(data.category), clean(data.unit) || 'un', clean(data.sku), clean(data.ca_number),
        num(data.current_stock), num(data.minimum_stock), num(data.average_cost), clean(data.location),
        data.supplier_id || null, clean(data.status) || 'ativo', clean(data.notes), req.params.id
      ]
    );
    await audit(req.user.id, 'update', 'stock_item', req.params.id, `Item ${req.params.id} atualizado`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

router.delete('/items/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM stock_items WHERE id=?', [req.params.id]);
    await audit(req.user.id, 'delete', 'stock_item', req.params.id, `Item ${req.params.id} excluido`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir item' });
  }
});

router.get('/orders', authenticate, async (req, res) => {
  try {
    res.json(await listOrders());
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

router.post('/orders', authenticate, authorize(...writeRoles), async (req, res) => {
  const conn = await db.getConnection();
  try {
    const data = req.body || {};
    const items = Array.isArray(data.items) ? data.items : [];
    await conn.beginTransaction();
    const orderNumber = clean(data.order_number) || await nextOrderNumber(conn);
    const total = items.reduce((sum, item) => sum + (num(item.quantity) * num(item.unit_price)), 0) + num(data.freight_cost) - num(data.discount_value);
    const [result] = await conn.query(
      `INSERT INTO purchase_orders
      (order_number, supplier_id, requester_name, department, project_id, request_date, expected_date, delivery_date,
       status, priority, payment_terms, freight_cost, discount_value, total_value, file_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber, data.supplier_id || null, clean(data.requester_name), clean(data.department), data.project_id || null,
        data.request_date || new Date().toISOString().slice(0, 10), data.expected_date || null, data.delivery_date || null,
        clean(data.status) || 'solicitado', clean(data.priority) || 'normal', clean(data.payment_terms),
        num(data.freight_cost), num(data.discount_value), total, clean(data.file_url), clean(data.notes)
      ]
    );
    const orderId = result.insertId;
    for (const item of items) {
      const qty = num(item.quantity);
      const price = num(item.unit_price);
      await conn.query(
        `INSERT INTO purchase_order_items
        (purchase_order_id, stock_item_id, description, quantity, unit, unit_price, total_price, delivered_quantity, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId, item.stock_item_id || null, clean(item.description), qty, clean(item.unit) || 'un',
          price, qty * price, num(item.delivered_quantity), clean(item.notes)
        ]
      );
    }
    await conn.commit();
    await audit(req.user.id, 'create', 'purchase_order', orderId, `Pedido de compra ${orderNumber} criado`);
    res.status(201).json({ id: orderId, order_number: orderNumber });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar pedido de compra' });
  } finally {
    conn.release();
  }
});

router.put('/orders/:id', authenticate, authorize(...writeRoles), async (req, res) => {
  const conn = await db.getConnection();
  try {
    const data = req.body || {};
    const items = Array.isArray(data.items) ? data.items : [];
    await conn.beginTransaction();
    const total = items.reduce((sum, item) => sum + (num(item.quantity) * num(item.unit_price)), 0) + num(data.freight_cost) - num(data.discount_value);
    await conn.query(
      `UPDATE purchase_orders SET
        order_number=?, supplier_id=?, requester_name=?, department=?, project_id=?, request_date=?, expected_date=?,
        delivery_date=?, status=?, priority=?, payment_terms=?, freight_cost=?, discount_value=?, total_value=?, file_url=?, notes=?
      WHERE id=?`,
      [
        clean(data.order_number), data.supplier_id || null, clean(data.requester_name), clean(data.department), data.project_id || null,
        data.request_date || null, data.expected_date || null, data.delivery_date || null,
        clean(data.status) || 'solicitado', clean(data.priority) || 'normal', clean(data.payment_terms),
        num(data.freight_cost), num(data.discount_value), total, clean(data.file_url), clean(data.notes), req.params.id
      ]
    );
    await conn.query('DELETE FROM purchase_order_items WHERE purchase_order_id=?', [req.params.id]);
    for (const item of items) {
      const qty = num(item.quantity);
      const price = num(item.unit_price);
      await conn.query(
        `INSERT INTO purchase_order_items
        (purchase_order_id, stock_item_id, description, quantity, unit, unit_price, total_price, delivered_quantity, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.id, item.stock_item_id || null, clean(item.description), qty, clean(item.unit) || 'un',
          price, qty * price, num(item.delivered_quantity), clean(item.notes)
        ]
      );
    }
    await conn.commit();
    await audit(req.user.id, 'update', 'purchase_order', req.params.id, `Pedido de compra ${req.params.id} atualizado`);
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: 'Erro ao atualizar pedido de compra' });
  } finally {
    conn.release();
  }
});

router.post('/orders/:id/receive', authenticate, authorize(...writeRoles), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query('SELECT * FROM purchase_order_items WHERE purchase_order_id=?', [req.params.id]);
    for (const item of items) {
      if (item.stock_item_id) {
        await conn.query('UPDATE stock_items SET current_stock = current_stock + ? WHERE id=?', [num(item.quantity), item.stock_item_id]);
      }
      await conn.query('UPDATE purchase_order_items SET delivered_quantity=? WHERE id=?', [num(item.quantity), item.id]);
    }
    await conn.query('UPDATE purchase_orders SET status=?, delivery_date=? WHERE id=?', ['recebido', new Date().toISOString().slice(0, 10), req.params.id]);
    await conn.commit();
    await audit(req.user.id, 'receive', 'purchase_order', req.params.id, `Pedido de compra ${req.params.id} recebido`);
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: 'Erro ao receber pedido de compra' });
  } finally {
    conn.release();
  }
});

router.delete('/orders/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM purchase_orders WHERE id=?', [req.params.id]);
    await audit(req.user.id, 'delete', 'purchase_order', req.params.id, `Pedido de compra ${req.params.id} excluido`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir pedido de compra' });
  }
});

module.exports = router;
