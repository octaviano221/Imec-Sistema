(function () {
  'use strict';

  var editingOrderLines = 0;

  function icon(name) {
    var icons = {
      box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
      cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.7 12.4a2 2 0 0 0 2 1.55h8.8a2 2 0 0 0 2-1.55L21 7H5.12"/>',
      truck: '<path d="M10 17h4V5H2v12h3"/><path d="M14 8h4l4 4v5h-3"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
      alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
      check: '<path d="m20 6-11 11-5-5"/>',
      file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.box) + '</svg>';
  }

  function decodeEntities(value) {
    if (typeof document === 'undefined') return String(value == null ? '' : value);
    var textarea = document.createElement('textarea');
    textarea.innerHTML = String(value == null ? '' : value);
    return textarea.value;
  }

  function esc(value) {
    return decodeEntities(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char];
    });
  }

  function db() {
    return typeof getDB === 'function' ? getDB() : {};
  }

  function warehouse() {
    return db().warehouse || { suppliers: [], items: [], orders: [], metrics: {} };
  }

  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function fmtDate(value) {
    if (typeof formatDate === 'function') return formatDate(value);
    if (!value) return '--';
    var parts = String(value).slice(0, 10).split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(value);
  }

  function inputDate(value) {
    return value ? String(value).slice(0, 10) : '';
  }

  function todayValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function statusInfo(status) {
    var map = {
      rascunho: ['Rascunho', '#64748b', '#f1f5f9'],
      solicitado: ['Solicitado', '#1269ff', '#eaf2ff'],
      aprovado: ['Aprovado', '#1468a8', '#e5f3ff'],
      comprado: ['Comprado', '#7c3aed', '#f0e7ff'],
      recebido: ['Recebido', '#168844', '#dcfce7'],
      cancelado: ['Cancelado', '#e51d2a', '#ffe1e4'],
      atrasado: ['Atrasado', '#e51d2a', '#ffe1e4'],
      ativo: ['Ativo', '#168844', '#dcfce7'],
      inativo: ['Inativo', '#64748b', '#f1f5f9']
    };
    return map[status] || [status || 'Conferir', '#f59e0b', '#fff3d8'];
  }

  function chip(status) {
    var info = statusInfo(status);
    return '<span class="warehouse-status" style="--tone:' + info[1] + ';--soft:' + info[2] + '">' + esc(info[0]) + '</span>';
  }

  function canWriteWarehouse() {
    return typeof canEdit === 'function' ? canEdit() : true;
  }

  function kpi(label, value, hint, iconName, tone, soft) {
    return '<section class="warehouse-card"><div class="warehouse-icon" style="--tone:' + tone + ';--soft:' + soft + '">' + icon(iconName) + '</div><div><span>' + label + '</span><strong>' + esc(value) + '</strong><small>' + hint + '</small></div></section>';
  }

  function orderRows(orders) {
    if (!orders.length) return '<tr><td colspan="7"><div class="warehouse-empty">Nenhum pedido de compra cadastrado ainda.</div></td></tr>';
    return orders.map(function (order) {
      return '<tr data-search="' + esc([order.order_number, order.supplier_name, order.requester_name, order.department, order.status, order.computed_status].join(' ')).toLowerCase() + '">'
        + '<td><b>' + esc(order.order_number) + '</b><small>' + esc(order.requester_name || 'Sem solicitante') + '</small></td>'
        + '<td>' + esc(order.supplier_name || 'Fornecedor nao informado') + '</td>'
        + '<td>' + esc(order.department || order.project_name || '--') + '</td>'
        + '<td>' + fmtDate(order.request_date) + '<small>Prazo: ' + fmtDate(order.expected_date) + '</small></td>'
        + '<td>' + chip(order.computed_status || order.status) + '</td>'
        + '<td><b>' + money(order.total_value) + '</b><small>' + (order.items || []).length + ' item(ns)</small></td>'
        + '<td class="wh-actions">'
        + (order.file_url ? '<a class="btn btn-outline btn-sm" href="' + esc(order.file_url) + '" target="_blank" download title="Baixar anexo">' + icon('download') + '</a>' : '')
        + '<button class="btn btn-outline btn-sm" onclick="editPurchaseOrder(' + order.id + ')" title="Editar">' + icon('edit') + '</button>'
        + (order.status !== 'recebido' ? '<button class="btn btn-outline btn-sm" onclick="receivePurchaseOrder(' + order.id + ')" title="Receber pedido">' + icon('check') + '</button>' : '')
        + (typeof canAdmin === 'function' && canAdmin() ? '<button class="btn btn-outline btn-sm text-red-600" onclick="deletePurchaseOrder(' + order.id + ')" title="Excluir">' + icon('trash') + '</button>' : '')
        + '</td></tr>';
    }).join('');
  }

  function itemCards(items) {
    var low = items.filter(function (item) { return Number(item.current_stock || 0) <= Number(item.minimum_stock || 0); });
    var list = (low.length ? low : items.slice(0, 5));
    if (!list.length) return '<div class="warehouse-empty">Cadastre os principais materiais, EPIs e consumíveis da empresa.</div>';
    return list.map(function (item) {
      var lowStock = Number(item.current_stock || 0) <= Number(item.minimum_stock || 0);
      return '<div class="warehouse-side-item"><div class="warehouse-icon" style="--tone:' + (lowStock ? '#e51d2a' : '#168844') + ';--soft:' + (lowStock ? '#ffe1e4' : '#dcfce7') + '">' + icon(lowStock ? 'alert' : 'box') + '</div>'
        + '<div><h3>' + esc(item.name) + '</h3><p>' + esc(item.category || 'Sem categoria') + ' - ' + esc(item.location || 'Sem local') + '</p></div>'
        + '<div class="text-right"><b>' + esc(item.current_stock || 0) + ' ' + esc(item.unit || 'un') + '</b><small>min. ' + esc(item.minimum_stock || 0) + '</small></div></div>';
    }).join('');
  }

  function supplierRows(suppliers) {
    if (!suppliers.length) return '<tr><td colspan="5"><div class="warehouse-empty">Nenhum fornecedor cadastrado.</div></td></tr>';
    return suppliers.slice(0, 8).map(function (supplier) {
      return '<tr><td><b>' + esc(supplier.name) + '</b><small>' + esc(supplier.cnpj || '') + '</small></td><td>' + esc(supplier.contact_name || '--') + '</td><td>' + esc(supplier.phone || '--') + '</td><td>' + chip(supplier.status || 'ativo') + '</td><td><button class="btn btn-outline btn-sm" onclick="editSupplier(' + supplier.id + ')">' + icon('edit') + '</button></td></tr>';
    }).join('');
  }

  function renderWarehouse() {
    var data = warehouse();
    var suppliers = data.suppliers || [];
    var items = data.items || [];
    var orders = data.orders || [];
    var metrics = data.metrics || {};
    var lowStock = metrics.low_stock || items.filter(function (item) { return Number(item.current_stock || 0) <= Number(item.minimum_stock || 0); }).length;
    var openOrders = metrics.open_orders || orders.filter(function (order) { return !['recebido', 'cancelado'].includes(order.status); }).length;
    return '<div class="warehouse-page fade-in">'
      + '<section class="warehouse-hero"><div><p class="warehouse-kicker">controle interno</p><h2>Almoxarifado e compras</h2><p>Fornecedores, materiais, pedidos de compra, anexos e recebimento em uma fila única para a equipe registrar tudo.</p></div><div class="warehouse-actions">'
      + '<button class="btn btn-outline" onclick="editSupplier()">Novo fornecedor</button>'
      + '<button class="btn btn-outline" onclick="editStockItem()">Novo item</button>'
      + '<button class="btn btn-primary" onclick="editPurchaseOrder()">' + icon('plus') + ' Pedido de compra</button></div></section>'
      + '<div class="warehouse-kpis">'
      + kpi('Fornecedores', suppliers.length, 'base de compras', 'users', '#1269ff', '#eaf2ff')
      + kpi('Itens cadastrados', items.length, 'catálogo interno', 'box', '#168844', '#dcfce7')
      + kpi('Pedidos abertos', openOrders, 'em acompanhamento', 'cart', '#1269ff', '#eaf2ff')
      + kpi('Estoque baixo', lowStock, 'repor com prioridade', 'alert', lowStock ? '#e51d2a' : '#168844', lowStock ? '#ffe1e4' : '#dcfce7')
      + kpi('Total em aberto', money(metrics.total_open || 0), 'pedidos pendentes', 'file', '#7c3aed', '#f0e7ff')
      + '</div>'
      + '<div class="warehouse-grid"><section class="warehouse-panel"><div class="warehouse-panel-head"><div><h2>Pedidos de compra</h2><p>Fila executiva de compras do almoxarifado.</p></div><button class="btn btn-primary btn-sm" onclick="editPurchaseOrder()">' + icon('plus') + 'Novo pedido</button></div>'
      + '<div class="warehouse-filterbar"><input class="input warehouse-search" id="warehouseSearch" placeholder="Buscar pedido, fornecedor, solicitante ou status..." onkeyup="filterWarehouseOrders()"><select class="input w-auto" id="warehouseStatus" onchange="filterWarehouseOrders()"><option value="">Todos</option><option value="solicitado">Solicitados</option><option value="aprovado">Aprovados</option><option value="comprado">Comprados</option><option value="recebido">Recebidos</option><option value="atrasado">Atrasados</option></select></div>'
      + '<div class="warehouse-table-wrap"><table class="warehouse-table" id="warehouseOrdersTable"><thead><tr><th>Pedido</th><th>Fornecedor</th><th>Centro de custo</th><th>Datas</th><th>Status</th><th>Total</th><th>Ações</th></tr></thead><tbody>' + orderRows(orders) + '</tbody></table></div></section>'
      + '<aside class="warehouse-panel"><div class="warehouse-panel-head"><div><h2>Estoque crítico</h2><p>Itens abaixo do mínimo ou principais materiais.</p></div><button class="btn btn-outline btn-sm" onclick="editStockItem()">Adicionar item</button></div><div class="warehouse-side-list">' + itemCards(items) + '</div></aside></div>'
      + '<section class="warehouse-panel"><div class="warehouse-panel-head"><div><h2>Fornecedores cadastrados</h2><p>Empresas usadas em pedidos de compra, serviços e materiais.</p></div><button class="btn btn-outline btn-sm" onclick="editSupplier()">Novo fornecedor</button></div><div class="warehouse-table-wrap"><table class="warehouse-table"><thead><tr><th>Empresa</th><th>Contato</th><th>Telefone</th><th>Status</th><th>Ações</th></tr></thead><tbody>' + supplierRows(suppliers) + '</tbody></table></div></section>'
      + '</div>';
  }

  window.filterWarehouseOrders = function () {
    var q = (document.getElementById('warehouseSearch') || {}).value || '';
    var s = (document.getElementById('warehouseStatus') || {}).value || '';
    q = q.toLowerCase();
    document.querySelectorAll('#warehouseOrdersTable tbody tr').forEach(function (row) {
      var text = row.getAttribute('data-search') || row.textContent.toLowerCase();
      var showSearch = !q || text.indexOf(q) >= 0;
      var showStatus = !s || text.indexOf(s) >= 0;
      row.style.display = showSearch && showStatus ? '' : 'none';
    });
  };

  function supplierOptions(selected) {
    return '<option value="">Selecionar fornecedor</option>' + (warehouse().suppliers || []).map(function (supplier) {
      return '<option value="' + supplier.id + '"' + (String(selected || '') === String(supplier.id) ? ' selected' : '') + '>' + esc(supplier.name) + '</option>';
    }).join('');
  }

  function projectOptions(selected) {
    return '<option value="">Sem obra vinculada</option>' + ((db().projects || []).map(function (project) {
      return '<option value="' + project.id + '"' + (String(selected || '') === String(project.id) ? ' selected' : '') + '>' + esc(project.name) + '</option>';
    }).join(''));
  }

  function itemOptions(selected) {
    return '<option value="">Item avulso</option>' + (warehouse().items || []).map(function (item) {
      return '<option value="' + item.id + '"' + (String(selected || '') === String(item.id) ? ' selected' : '') + '>' + esc(item.name) + '</option>';
    }).join('');
  }

  window.editSupplier = function (id) {
    if (!canWriteWarehouse()) return showToast('Acesso negado', 'error');
    var supplier = (warehouse().suppliers || []).find(function (x) { return String(x.id) === String(id); }) || {};
    var html = '<div class="p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">' + (id ? 'Editar fornecedor' : 'Novo fornecedor') + '</h2><p class="text-sm text-slate-500 mb-5">Cadastre empresas para pedidos de compra e histórico do almoxarifado.</p><form onsubmit="saveSupplier(event,' + (id || 'null') + ')"><div class="warehouse-form-grid">'
      + '<div class="warehouse-form-full"><label class="label">Empresa *</label><input class="input" id="whSupplierName" required value="' + esc(supplier.name) + '"></div>'
      + '<div><label class="label">CNPJ</label><input class="input" id="whSupplierCnpj" value="' + esc(supplier.cnpj) + '"></div><div><label class="label">Contato</label><input class="input" id="whSupplierContact" value="' + esc(supplier.contact_name) + '"></div>'
      + '<div><label class="label">Telefone</label><input class="input" id="whSupplierPhone" value="' + esc(supplier.phone) + '"></div><div><label class="label">E-mail</label><input class="input" id="whSupplierEmail" value="' + esc(supplier.email) + '"></div>'
      + '<div><label class="label">Cidade</label><input class="input" id="whSupplierCity" value="' + esc(supplier.city) + '"></div><div><label class="label">Estado</label><input class="input" id="whSupplierState" value="' + esc(supplier.state) + '"></div>'
      + '<div><label class="label">Status</label><select class="input" id="whSupplierStatus"><option value="ativo"' + ((supplier.status || 'ativo') === 'ativo' ? ' selected' : '') + '>Ativo</option><option value="inativo"' + (supplier.status === 'inativo' ? ' selected' : '') + '>Inativo</option></select></div>'
      + '<div><label class="label">Condicao de pagamento</label><input class="input" id="whSupplierPayment" value="' + esc(supplier.payment_terms) + '"></div>'
      + '<div class="warehouse-form-full"><label class="label">Endereço</label><input class="input" id="whSupplierAddress" value="' + esc(supplier.address) + '"></div>'
      + '<div class="warehouse-form-full"><label class="label">Observações</label><textarea class="input" id="whSupplierNotes" rows="3">' + esc(supplier.notes) + '</textarea></div></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Salvar fornecedor</button></div></form></div>';
    openModal(html);
  };

  window.saveSupplier = async function (event, id) {
    event.preventDefault();
    var data = {
      name: document.getElementById('whSupplierName').value,
      cnpj: document.getElementById('whSupplierCnpj').value,
      contact_name: document.getElementById('whSupplierContact').value,
      phone: document.getElementById('whSupplierPhone').value,
      email: document.getElementById('whSupplierEmail').value,
      city: document.getElementById('whSupplierCity').value,
      state: document.getElementById('whSupplierState').value,
      status: document.getElementById('whSupplierStatus').value,
      payment_terms: document.getElementById('whSupplierPayment').value,
      address: document.getElementById('whSupplierAddress').value,
      notes: document.getElementById('whSupplierNotes').value
    };
    try {
      if (id) await API.warehouse.suppliers.update(id, data);
      else await API.warehouse.suppliers.create(data);
      await refreshData(); closeModal(); await renderPage(); showToast('Fornecedor salvo com sucesso', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };

  window.editStockItem = function (id) {
    if (!canWriteWarehouse()) return showToast('Acesso negado', 'error');
    var item = (warehouse().items || []).find(function (x) { return String(x.id) === String(id); }) || {};
    var html = '<div class="p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">' + (id ? 'Editar item' : 'Novo item') + '</h2><p class="text-sm text-slate-500 mb-5">Controle materiais, EPIs, ferramentas e consumíveis.</p><form onsubmit="saveStockItem(event,' + (id || 'null') + ')"><div class="warehouse-form-grid">'
      + '<div class="warehouse-form-full"><label class="label">Nome do item *</label><input class="input" id="whItemName" required value="' + esc(item.name) + '"></div>'
      + '<div><label class="label">Categoria</label><input class="input" id="whItemCategory" value="' + esc(item.category) + '" placeholder="EPI, ferramenta, consumivel"></div><div><label class="label">Unidade</label><input class="input" id="whItemUnit" value="' + esc(item.unit || 'un') + '"></div>'
      + '<div><label class="label">Codigo / SKU</label><input class="input" id="whItemSku" value="' + esc(item.sku) + '"></div><div><label class="label">C.A.</label><input class="input" id="whItemCa" value="' + esc(item.ca_number) + '"></div>'
      + '<div><label class="label">Estoque atual</label><input type="number" step="0.01" class="input" id="whItemStock" value="' + esc(item.current_stock || 0) + '"></div><div><label class="label">Estoque mínimo</label><input type="number" step="0.01" class="input" id="whItemMin" value="' + esc(item.minimum_stock || 0) + '"></div>'
      + '<div><label class="label">Custo medio</label><input type="number" step="0.01" class="input" id="whItemCost" value="' + esc(item.average_cost || 0) + '"></div><div><label class="label">Localizacao</label><input class="input" id="whItemLocation" value="' + esc(item.location) + '"></div>'
      + '<div><label class="label">Fornecedor principal</label><select class="input" id="whItemSupplier">' + supplierOptions(item.supplier_id) + '</select></div><div><label class="label">Status</label><select class="input" id="whItemStatus"><option value="ativo"' + ((item.status || 'ativo') === 'ativo' ? ' selected' : '') + '>Ativo</option><option value="inativo"' + (item.status === 'inativo' ? ' selected' : '') + '>Inativo</option></select></div>'
      + '<div class="warehouse-form-full"><label class="label">Observações</label><textarea class="input" id="whItemNotes" rows="3">' + esc(item.notes) + '</textarea></div></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Salvar item</button></div></form></div>';
    openModal(html);
  };

  window.saveStockItem = async function (event, id) {
    event.preventDefault();
    var data = {
      name: document.getElementById('whItemName').value,
      category: document.getElementById('whItemCategory').value,
      unit: document.getElementById('whItemUnit').value,
      sku: document.getElementById('whItemSku').value,
      ca_number: document.getElementById('whItemCa').value,
      current_stock: document.getElementById('whItemStock').value,
      minimum_stock: document.getElementById('whItemMin').value,
      average_cost: document.getElementById('whItemCost').value,
      location: document.getElementById('whItemLocation').value,
      supplier_id: document.getElementById('whItemSupplier').value || null,
      status: document.getElementById('whItemStatus').value,
      notes: document.getElementById('whItemNotes').value
    };
    try {
      if (id) await API.warehouse.items.update(id, data);
      else await API.warehouse.items.create(data);
      await refreshData(); closeModal(); await renderPage(); showToast('Item salvo com sucesso', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };

  window.addPurchaseOrderLine = function (data) {
    data = data || {};
    var target = document.getElementById('whOrderLines');
    if (!target) return;
    editingOrderLines += 1;
    var div = document.createElement('div');
    div.className = 'warehouse-line';
    div.innerHTML = '<select class="input whLineItem"><option value="">Item avulso</option>' + itemOptions(data.stock_item_id).replace('<option value="">Item avulso</option>', '') + '</select>'
      + '<input class="input whLineDesc" placeholder="Descricao do item" value="' + esc(data.description || data.stock_item_name || '') + '">'
      + '<input class="input whLineQty" type="number" min="0" step="0.01" placeholder="Qtd." value="' + esc(data.quantity || 1) + '">'
      + '<input class="input whLineUnit" placeholder="Un." value="' + esc(data.unit || 'un') + '">'
      + '<input class="input whLinePrice" type="number" min="0" step="0.01" placeholder="Valor unit." value="' + esc(data.unit_price || 0) + '">'
      + '<button type="button" class="btn btn-outline btn-sm" onclick="this.closest(\'.warehouse-line\').remove()" title="Remover">' + icon('trash') + '</button>';
    target.appendChild(div);
  };

  window.editPurchaseOrder = function (id) {
    if (!canWriteWarehouse()) return showToast('Acesso negado', 'error');
    var order = (warehouse().orders || []).find(function (x) { return String(x.id) === String(id); }) || {};
    editingOrderLines = 0;
    var html = '<div class="p-6 warehouse-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">' + (id ? 'Editar pedido de compra' : 'Novo pedido de compra') + '</h2><p class="text-sm text-slate-500 mb-5">Registre a solicitação, fornecedor, itens, valores e anexo do pedido.</p><form onsubmit="savePurchaseOrder(event,' + (id || 'null') + ')"><div class="warehouse-form-grid">'
      + '<div><label class="label">Numero</label><input class="input" id="whOrderNumber" value="' + esc(order.order_number) + '" placeholder="Automatico se vazio"></div><div><label class="label">Fornecedor</label><select class="input" id="whOrderSupplier">' + supplierOptions(order.supplier_id) + '</select></div>'
      + '<div><label class="label">Solicitante</label><input class="input" id="whOrderRequester" value="' + esc(order.requester_name) + '"></div><div><label class="label">Setor / Centro de custo</label><input class="input" id="whOrderDepartment" value="' + esc(order.department || '') + '" placeholder="Almoxarifado, obra, manutenção"></div>'
      + '<div><label class="label">Obra vinculada</label><select class="input" id="whOrderProject">' + projectOptions(order.project_id) + '</select></div><div><label class="label">Prioridade</label><select class="input" id="whOrderPriority"><option value="normal">Normal</option><option value="alta"' + (order.priority === 'alta' ? ' selected' : '') + '>Alta</option><option value="urgente"' + (order.priority === 'urgente' ? ' selected' : '') + '>Urgente</option></select></div>'
      + '<div><label class="label">Data do pedido</label><input type="date" class="input" id="whOrderRequestDate" value="' + esc(inputDate(order.request_date) || todayValue()) + '"></div><div><label class="label">Previsao de entrega</label><input type="date" class="input" id="whOrderExpectedDate" value="' + esc(inputDate(order.expected_date)) + '"></div>'
      + '<div><label class="label">Status</label><select class="input" id="whOrderStatus"><option value="solicitado">Solicitado</option><option value="aprovado"' + (order.status === 'aprovado' ? ' selected' : '') + '>Aprovado</option><option value="comprado"' + (order.status === 'comprado' ? ' selected' : '') + '>Comprado</option><option value="recebido"' + (order.status === 'recebido' ? ' selected' : '') + '>Recebido</option><option value="cancelado"' + (order.status === 'cancelado' ? ' selected' : '') + '>Cancelado</option></select></div><div><label class="label">Condicao de pagamento</label><input class="input" id="whOrderPayment" value="' + esc(order.payment_terms) + '"></div>'
      + '<div><label class="label">Frete</label><input type="number" step="0.01" class="input" id="whOrderFreight" value="' + esc(order.freight_cost || 0) + '"></div><div><label class="label">Desconto</label><input type="number" step="0.01" class="input" id="whOrderDiscount" value="' + esc(order.discount_value || 0) + '"></div>'
      + '<div class="warehouse-form-full"><label class="label">Pedido / orçamento em PDF</label><input type="file" class="input" id="whOrderFile" accept="application/pdf,.pdf"><input type="hidden" id="whOrderFileUrl" value="' + esc(order.file_url) + '">' + (order.file_url ? '<div class="warehouse-file-note"><span>PDF atual anexado ao pedido.</span><a href="' + esc(order.file_url) + '" target="_blank" download>Baixar</a></div>' : '<div class="warehouse-file-note"><span>Nenhum PDF anexado. Opcional.</span></div>') + '</div>'
      + '<div class="warehouse-lines"><div class="flex justify-between items-center gap-3"><div><b>Itens do pedido</b><p class="text-xs text-slate-500">Use item cadastrado ou descreva avulso.</p></div><button type="button" class="btn btn-outline btn-sm" onclick="addPurchaseOrderLine()">' + icon('plus') + 'Adicionar item</button></div><div id="whOrderLines"></div></div>'
      + '<div class="warehouse-form-full"><label class="label">Observações</label><textarea class="input" id="whOrderNotes" rows="3">' + esc(order.notes) + '</textarea></div></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Salvar pedido</button></div></form></div>';
    openModal(html);
    var lines = order.items && order.items.length ? order.items : [{}];
    lines.forEach(function (line) { addPurchaseOrderLine(line); });
  };

  window.savePurchaseOrder = async function (event, id) {
    event.preventDefault();
    var fileUrl = document.getElementById('whOrderFileUrl').value;
    var file = document.getElementById('whOrderFile').files[0];
    try {
      if (file) {
        var fd = new FormData();
        fd.append('file', file);
        var up = await API.upload(fd);
        fileUrl = up.url;
      }
      var items = Array.from(document.querySelectorAll('.warehouse-line')).map(function (line) {
        var select = line.querySelector('.whLineItem');
        var itemId = select.value || null;
        var selectedText = select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent : '';
        return {
          stock_item_id: itemId,
          description: line.querySelector('.whLineDesc').value || selectedText || 'Item',
          quantity: line.querySelector('.whLineQty').value,
          unit: line.querySelector('.whLineUnit').value,
          unit_price: line.querySelector('.whLinePrice').value
        };
      }).filter(function (line) { return line.description || line.stock_item_id; });
      var data = {
        order_number: document.getElementById('whOrderNumber').value,
        supplier_id: document.getElementById('whOrderSupplier').value || null,
        requester_name: document.getElementById('whOrderRequester').value,
        department: document.getElementById('whOrderDepartment').value,
        project_id: document.getElementById('whOrderProject').value || null,
        priority: document.getElementById('whOrderPriority').value,
        request_date: document.getElementById('whOrderRequestDate').value,
        expected_date: document.getElementById('whOrderExpectedDate').value,
        status: document.getElementById('whOrderStatus').value,
        payment_terms: document.getElementById('whOrderPayment').value,
        freight_cost: document.getElementById('whOrderFreight').value,
        discount_value: document.getElementById('whOrderDiscount').value,
        file_url: fileUrl,
        notes: document.getElementById('whOrderNotes').value,
        items: items
      };
      if (id) await API.warehouse.orders.update(id, data);
      else await API.warehouse.orders.create(data);
      await refreshData(); closeModal(); await renderPage(); showToast('Pedido de compra salvo', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };

  window.receivePurchaseOrder = async function (id) {
    if (!confirm('Marcar este pedido como recebido e atualizar o estoque?')) return;
    try {
      await API.warehouse.orders.receive(id);
      await refreshData(); await renderPage(); showToast('Pedido recebido e estoque atualizado', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };

  window.deletePurchaseOrder = async function (id) {
    if (!confirm('Excluir este pedido de compra?')) return;
    try {
      await API.warehouse.orders.delete(id);
      await refreshData(); await renderPage(); showToast('Pedido excluido', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };

  function addSidebar() {
    if (document.querySelector('[data-page="warehouse"]')) return;
    var after = document.querySelector('[data-page="vehicleDocuments"]') || document.querySelector('[data-page="epi"]') || document.querySelector('[data-page="equipment"]');
    var link = document.createElement('a');
    link.href = '#';
    link.className = 'sidebar-link';
    link.setAttribute('data-page', 'warehouse');
    link.setAttribute('onclick', "navigate('warehouse'); return false;");
    link.innerHTML = icon('box') + '<span>Almoxarifado</span>';
    if (after && after.parentNode) after.parentNode.insertBefore(link, after.nextSibling);
  }

  function install(attempts) {
    if (typeof renderers === 'undefined' || typeof API === 'undefined') {
      if ((attempts || 0) < 80) setTimeout(function () { install((attempts || 0) + 1); }, 80);
      return;
    }
    addSidebar();
    renderers.warehouse = async function () { return renderWarehouse(); };
  }

  install(0);
})();
