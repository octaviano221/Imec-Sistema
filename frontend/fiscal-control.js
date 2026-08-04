(function () {
  function db() { return typeof getDB === 'function' ? getDB() : {}; }
  function fiscal() { return db().fiscal || { invoices: [], metrics: {} }; }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function dt(value) {
    if (!value) return '-';
    var clean = String(value).split('T')[0].slice(0, 10);
    var p = clean.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : clean;
  }
  function inputDate(value) {
    return value ? String(value).split('T')[0].slice(0, 10) : '';
  }
  function icon(name) {
    var icons = {
      fiscal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>',
      upload: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>',
      plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
      eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
      trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
      download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
      robot: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="M8 18h8"/></svg>',
      chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>',
      wallet: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H5a2 2 0 0 0 0 4h15v8H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h13z"/><path d="M16 14h.01"/></svg>',
      box: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
      checklist: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l2 2 4-4"/><path d="M9 17h6"/><rect x="5" y="3" width="14" height="18" rx="2"/></svg>',
      history: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/><path d="M12 7v5l3 2"/></svg>'
    };
    return icons[name] || icons.fiscal;
  }
  function statusChip(status) {
    var label = { conferida: 'Conferida', conferencia: 'Conferência', pendente: 'Pendente', divergente: 'Divergente', cancelada: 'Cancelada' }[status] || (status || 'Conferência');
    var cls = status === 'conferida' ? 'ok' : ((status === 'cancelada' || status === 'divergente') ? 'danger' : (status === 'pendente' ? 'warn' : 'info'));
    return '<span class="fiscal-chip ' + cls + '">' + label + '</span>';
  }
  function invoices() {
    return (fiscal().invoices || []).slice();
  }
  function needsFiscalEntry(invoice) {
    if (!invoice) return false;
    var financial = invoice.financial_status || 'nao_lancado';
    var stock = invoice.stock_status || 'nao_lancado';
    var fiscalStatus = invoice.fiscal_status || 'conferencia';
    return financial !== 'lancado' || stock === 'nao_lancado' || fiscalStatus !== 'escriturado';
  }
  function topCfops(list) {
    var grouped = {};
    list.forEach(function (invoice) {
      String(invoice.cfop || '-').split(',').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (cfop) {
        if (!grouped[cfop]) grouped[cfop] = { cfop: cfop, count: 0, total: 0 };
        grouped[cfop].count += 1;
        grouped[cfop].total += Number(invoice.total_invoice || 0);
      });
    });
    return Object.keys(grouped).map(function (key) { return grouped[key]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 6);
  }
  function warehouseOrders() {
    return (((db().warehouse || {}).orders) || []).slice();
  }
  function purchaseOrderOptions(selected) {
    return '<option value="">Sem pedido vinculado</option>' + warehouseOrders().map(function (order) {
      var label = (order.order_number || ('Pedido #' + order.id)) + ' - ' + (order.supplier_name || 'Fornecedor') + ' - ' + money(order.total_amount || 0);
      return '<option value="' + esc(order.id) + '"' + (String(selected || '') === String(order.id) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }
  function stockItems() {
    return (((db().warehouse || {}).items) || []).slice();
  }
  function stockItemOptions(selected) {
    return '<option value="">Criar item automaticamente</option>' + stockItems().map(function (item) {
      var label = (item.name || ('Item #' + item.id)) + (item.current_stock != null ? ' - estoque ' + item.current_stock : '');
      return '<option value="' + esc(item.id) + '"' + (String(selected || '') === String(item.id) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }
  function flowChip(status) {
    var key = status || 'pendente';
    var labels = {
      lancado: 'Financeiro lançado',
      movimentado: 'Estoque lançado',
      escriturado: 'Fiscal escriturado',
      gerado: 'SPED gerado',
      pendente: 'Pendente',
      nao_lancado: 'Não lançado',
      sem_movimento: 'Sem estoque',
      conferencia: 'Conferência',
      analisar: 'Analisar',
      creditado: 'Creditado',
      isento: 'Isento',
      nao_creditado: 'Não creditado',
      dispensado: 'Dispensado'
    };
    var cls = ['lancado', 'movimentado', 'escriturado', 'gerado', 'creditado'].indexOf(key) >= 0 ? 'ok'
      : (['pendente', 'analisar'].indexOf(key) >= 0 ? 'warn'
        : (['conferencia', 'isento'].indexOf(key) >= 0 ? 'info' : 'neutral'));
    return '<span class="fiscal-chip ' + cls + '">' + esc(labels[key] || key) + '</span>';
  }
  function creditOptions(selected) {
    var value = selected || 'analisar';
    return [
      ['analisar', 'Analisar'],
      ['creditado', 'Creditar ICMS'],
      ['isento', 'Isento'],
      ['nao_creditado', 'Não creditar']
    ].map(function (row) {
      return '<option value="' + row[0] + '"' + (value === row[0] ? ' selected' : '') + '>' + row[1] + '</option>';
    }).join('');
  }
  function downloadTextFile(filename, content) {
    var blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || 'sped-fiscal-imec.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }
  function fiscalInsights(list, metrics) {
    var financeCount = metrics.finance_open || 0;
    var financeTotal = metrics.finance_open_total || 0;
    var stock = metrics.stock_movements || 0;
    var sped = metrics.sped_pending || list.filter(function (i) { return (i.sped_status || 'pendente') === 'pendente'; }).length;
    var entryPending = list.filter(needsFiscalEntry).length;
    return '<section class="fiscal-insights">'
      + '<button type="button" class="fiscal-mini-card fiscal-mini-action" onclick="openFiscalFinanceModal()"><span>Financeiro aberto</span><strong>' + financeCount + '</strong><small>' + money(financeTotal) + ' a pagar</small></button>'
      + '<button type="button" class="fiscal-mini-card fiscal-mini-action" onclick="openFiscalStockLedgerModal()"><span>Estoque NF-e</span><strong>' + stock + '</strong><small>movimentos de entrada</small></button>'
      + '<button type="button" class="fiscal-mini-card fiscal-mini-action" onclick="openFiscalSpedHistoryModal()"><span>SPED pendente</span><strong>' + sped + '</strong><small>notas para o TXT mensal</small></button>'
      + '<button type="button" class="fiscal-mini-card fiscal-mini-action accent" onclick="openFiscalEntryQueueModal()"><span>Fila de entrada</span><strong>' + entryPending + '</strong><small>selecionar NF-e e lançar itens</small></button>'
      + '</section>';
  }
  function fiscalNextAction(invoice) {
    var status = invoice.status || 'conferencia';
    var financial = invoice.financial_status || 'nao_lancado';
    var stock = invoice.stock_status || 'nao_lancado';
    var fiscalStatus = invoice.fiscal_status || 'conferencia';
    var sped = invoice.sped_status || 'pendente';
    if (status === 'divergente' || status === 'pendente' || fiscalStatus === 'conferencia' || fiscalStatus === 'analisar') {
      return { label: 'Conferir NF-e', detail: 'Revisar CFOP, ICMS e itens', className: 'warn' };
    }
    if (financial !== 'lancado') {
      return { label: 'Lançar financeiro', detail: 'Gerar contas a pagar', className: 'info' };
    }
    if (stock !== 'movimentado' && stock !== 'sem_movimento') {
      return { label: 'Enviar ao estoque', detail: 'Selecionar itens e quantidades', className: 'info' };
    }
    if (sped !== 'gerado') {
      return { label: 'Gerar SPED', detail: 'Blocos C, K e H pendentes', className: 'neutral' };
    }
    return { label: 'Integrada', detail: 'Fiscal, estoque e financeiro ok', className: 'ok' };
  }
  function fiscalWorkflowBoard(list, metrics) {
    var entryPending = list.filter(needsFiscalEntry).length;
    var financeOpen = metrics.finance_open || list.filter(function (invoice) { return (invoice.financial_status || 'nao_lancado') !== 'lancado'; }).length;
    var stockPending = list.filter(function (invoice) {
      var status = invoice.stock_status || 'nao_lancado';
      return status !== 'movimentado' && status !== 'sem_movimento';
    }).length;
    var spedPending = metrics.sped_pending || list.filter(function (invoice) { return (invoice.sped_status || 'pendente') === 'pendente'; }).length;
    function card(cls, iconName, title, value, note, action, cta) {
      return '<button type="button" class="fiscal-workflow-card ' + cls + '" onclick="' + action + '">'
        + '<div class="fiscal-workflow-icon">' + icon(iconName) + '</div>'
        + '<span>' + title + '</span>'
        + '<strong>' + value + '</strong>'
        + '<small>' + note + '</small>'
        + '<b>' + cta + '</b>'
        + '</button>';
    }
    return '<section class="fiscal-workflow-board">'
      + '<div class="fiscal-workflow-head"><div><p class="fiscal-eyebrow">Fluxo operacional</p><h3>Da NF-e ao fechamento</h3><span>Escolha uma etapa para revisar as notas, alimentar financeiro, movimentar estoque e preparar o SPED.</span></div><button class="btn btn-primary btn-sm" onclick="openFiscalXmlModal()">' + icon('upload') + ' Importar XML</button></div>'
      + '<div class="fiscal-workflow-grid">'
      + card(entryPending ? 'warn' : 'ok', 'checklist', 'Conferência', entryPending, entryPending ? 'notas aguardando revisão' : 'sem pendência fiscal', 'openFiscalEntryQueueModal()', 'Abrir fila')
      + card(financeOpen ? 'info' : 'ok', 'wallet', 'Financeiro', financeOpen, money(metrics.finance_open_total || 0) + ' em aberto', 'openFiscalFinanceModal()', 'Ver títulos')
      + card(stockPending ? 'info' : 'ok', 'box', 'Estoque', stockPending, 'itens para entrada ou dispensa', 'openFiscalStockLedgerModal()', 'Ver movimentos')
      + card(spedPending ? 'neutral' : 'ok', 'download', 'SPED', spedPending, 'notas para o TXT mensal', 'openFiscalSpedModal()', 'Gerar arquivo')
      + '</div>'
      + '</section>';
  }
  function renderInvoiceRows(list) {
    if (!list.length) return '<tr><td colspan="9"><div class="fiscal-empty">Importe o primeiro XML de NF-e ou cadastre uma nota manual.</div></td></tr>';
    return list.map(function (invoice) {
      var supplier = invoice.linked_supplier_name || invoice.supplier_name || '-';
      var next = fiscalNextAction(invoice);
      var order = invoice.purchase_order_number
        ? '<span class="fiscal-order-pill active"><b>Pedido</b>' + esc(invoice.purchase_order_number) + '</span>'
        : '<span class="fiscal-order-pill muted"><b>Pedido</b>Sem vínculo</span>';
      var cfop = String(invoice.entry_cfop || invoice.cfop || '-').split(',').map(function (value) { return value.trim(); }).filter(Boolean).join(', ');
      var danfe = '<button class="fiscal-icon-btn" onclick="downloadFiscalDanfe(' + invoice.id + ')" title="Baixar DANFE em PDF">' + icon('download') + '</button>';
      var xml = invoice.xml_url ? '<button class="fiscal-icon-btn fiscal-icon-btn-soft" onclick="downloadFiscalXml(' + invoice.id + ')" title="Baixar XML da NF-e">' + icon('download') + '</button>' : '';
      var integrate = '<button class="fiscal-icon-btn" onclick="openFiscalIntegrationModal(' + invoice.id + ')" title="Escriturar entrada">' + icon('chart') + '</button>';
      return '<tr data-fiscal-row data-status="' + esc(invoice.status || 'conferencia') + '" data-search="' + esc([supplier, invoice.supplier_cnpj, invoice.number, invoice.access_key, invoice.cfop, invoice.entry_cfop, invoice.purchase_order_number, invoice.financial_status, invoice.stock_status, invoice.fiscal_status, invoice.sped_status].join(' ').toLowerCase()) + '">'
        + '<td data-label="NF-e" class="fiscal-cell-note"><strong>NF-e ' + esc(invoice.number || '-') + '</strong><small>Série ' + esc(invoice.series || '-') + ' | Modelo ' + esc(invoice.model || '55') + '</small></td>'
        + '<td data-label="Fornecedor" class="fiscal-cell-supplier"><strong title="' + esc(supplier) + '">' + esc(supplier) + '</strong><small>CNPJ ' + esc(invoice.supplier_cnpj || '-') + '</small></td>'
        + '<td data-label="Pedido" class="fiscal-cell-order">' + order + '</td>'
        + '<td data-label="Emissão" class="fiscal-cell-date"><span>' + dt(invoice.issue_date) + '</span></td>'
        + '<td data-label="CFOP" class="fiscal-cell-cfop"><span class="fiscal-cfop-badge">' + esc(cfop || '-') + '</span><small>Entrada/XML</small></td>'
        + '<td data-label="Total" class="fiscal-cell-money"><strong>' + money(invoice.total_invoice) + '</strong><small>Total NF-e</small></td>'
        + '<td data-label="ICMS" class="fiscal-cell-money fiscal-cell-money-muted"><strong>' + money(invoice.icms_value) + '</strong><small>ICMS</small></td>'
        + '<td data-label="Próxima ação" class="fiscal-cell-action"><div class="fiscal-next-action ' + next.className + '"><b>' + esc(next.label) + '</b><small>' + esc(next.detail) + '</small></div><div class="fiscal-flow-mini">' + statusChip(invoice.status) + flowChip(invoice.stock_status || 'nao_lancado') + '</div></td>'
        + '<td data-label="Ações" class="fiscal-cell-tools"><div class="fiscal-row-actions"><button class="fiscal-icon-btn" onclick="openFiscalInvoiceDetails(' + invoice.id + ')" title="Ver detalhes">' + icon('eye') + '</button>' + integrate + danfe + xml + '<button class="fiscal-icon-btn" onclick="editFiscalInvoice(' + invoice.id + ')" title="Editar">' + icon('edit') + '</button><button class="fiscal-icon-btn fiscal-icon-btn-danger" onclick="deleteFiscalInvoice(' + invoice.id + ')" title="Excluir">' + icon('trash') + '</button></div></td>'
        + '</tr>';
    }).join('');
  }
  function renderFiscal() {
    var data = fiscal();
    var metrics = data.metrics || {};
    var list = invoices();
    var cfops = topCfops(list);
    return '<div class="fiscal-page fade-in">'
      + '<section class="fiscal-hero"><div class="fiscal-hero-main"><div class="fiscal-eyebrow">Controle fiscal integrado</div><h2 class="text-2xl">Central fiscal NF-e</h2><p class="text-slate-600 mt-1">Importe XML ou consulte a SEFAZ, revise CFOP/ICMS por item, lance financeiro, movimente estoque e gere base SPED em uma fila única.</p></div><div class="fiscal-hero-actions"><div class="fiscal-hero-primary"><button class="btn btn-primary" onclick="openFiscalXmlModal()">' + icon('upload') + ' Importar XML</button><button class="btn btn-outline" onclick="openSefazModal()">' + icon('robot') + ' SEFAZ / A1</button></div><div class="fiscal-toolbox"><button class="btn btn-outline btn-sm" onclick="openFiscalEntryQueueModal()">Fluxo guiado</button><button class="btn btn-outline btn-sm" onclick="openFiscalConferenceModal()">Conferência</button><button class="btn btn-outline btn-sm" onclick="openFiscalInvoiceModal()">Nota manual</button></div></div></section>'
      + '<section class="fiscal-kpis">'
      + fiscalKpi('fiscal', 'Notas', metrics.invoices || 0, 'XML e manuais')
      + fiscalKpi('chart', 'Total do mês', money(metrics.month_total || 0), 'valor das entradas')
      + fiscalKpi('fiscal', 'Financeiro aberto', money(metrics.finance_open_total || 0), (metrics.finance_open || 0) + ' título(s)')
      + fiscalKpi('upload', 'Estoque NF-e', metrics.stock_movements || 0, 'movimentos de entrada')
      + fiscalKpi('robot', 'SPED pendente', metrics.sped_pending || 0, 'notas a gerar')
      + '</section>'
      + fiscalWorkflowBoard(list, metrics)
      + '<section class="fiscal-grid"><div class="fiscal-panel"><div class="fiscal-panel-head"><div><h3 class="text-xl">Livro de entradas</h3><p class="text-sm text-slate-500">Consulte por fornecedor, CNPJ, CFOP, pedido, chave, estoque ou próxima ação.</p></div><button class="btn btn-outline btn-sm" onclick="exportFiscalCsv()">CSV contador</button></div><div class="fiscal-panel-body fiscal-filters"><input class="input" id="fiscalSearch" oninput="filterFiscalInvoices()" placeholder="Buscar nota, fornecedor, CNPJ, pedido, CFOP ou status..."><select class="input" id="fiscalStatus" onchange="filterFiscalInvoices()"><option value="">Todos os status</option><option value="conferencia">Conferência</option><option value="conferida">Conferida</option><option value="pendente">Pendente</option><option value="divergente">Divergente</option><option value="cancelada">Cancelada</option></select></div><div class="fiscal-table-wrap"><table class="fiscal-table fiscal-invoice-table"><thead><tr><th>NF-e</th><th>Fornecedor</th><th>Pedido</th><th>Emissão</th><th>CFOP</th><th>Total</th><th>ICMS</th><th>Próxima ação</th><th>Ações</th></tr></thead><tbody>' + renderInvoiceRows(list) + '</tbody></table></div></div>'
      + '<aside class="fiscal-panel fiscal-summary-panel"><div class="fiscal-panel-head"><div><h3>Fechamento fiscal</h3><p class="text-sm text-slate-500">Escrituração mensal com blocos C, K e H.</p></div><button class="btn btn-primary btn-sm" onclick="openFiscalSpedModal()">' + icon('download') + ' SPED TXT</button></div><div class="fiscal-panel-body"><div class="fiscal-upload-box mb-4">' + icon('chart') + '<h4 class="font-bold mt-3 text-imec-dark">Fluxo completo da nota</h4><p class="text-sm text-slate-500 mt-1">Conferência da NF-e, lançamento financeiro, entrada de estoque, CFOP por item e arquivo SPED base para validação.</p><button class="btn btn-outline btn-sm mt-4" onclick="openFiscalEntryQueueModal()">Abrir fluxo guiado</button></div><div class="fiscal-cfop-list">' + (cfops.length ? cfops.map(function (row) { return '<div class="fiscal-cfop-row"><div><b>CFOP ' + esc(row.cfop) + '</b><p class="text-xs text-slate-500">' + row.count + ' nota(s)</p></div><strong>' + money(row.total) + '</strong></div>'; }).join('') : '<div class="fiscal-empty">Nenhum CFOP importado ainda.</div>') + '</div></div></aside></section>'
      + '</div>';
  }
  function fiscalKpi(iconName, label, value, note) {
    return '<div class="fiscal-kpi"><div class="fiscal-kpi-icon">' + icon(iconName) + '</div><div><span>' + label + '</span><strong>' + value + '</strong><p class="text-xs text-slate-500 mt-2">' + note + '</p></div></div>';
  }
  window.openFiscalEntryQueueModal = function () {
    var list = invoices().slice().sort(function (a, b) {
      return (needsFiscalEntry(b) ? 1 : 0) - (needsFiscalEntry(a) ? 1 : 0)
        || String(b.issue_date || '').localeCompare(String(a.issue_date || ''));
    });
    var rows = list.length ? list.map(function (invoice) {
      var supplier = invoice.linked_supplier_name || invoice.supplier_name || '-';
      var pending = needsFiscalEntry(invoice);
      return '<article class="fiscal-entry-row" data-entry-row data-search="' + esc([invoice.number, supplier, invoice.supplier_cnpj, invoice.access_key, invoice.cfop, invoice.entry_cfop, invoice.financial_status, invoice.stock_status, invoice.fiscal_status].join(' ').toLowerCase()) + '" data-pending="' + (pending ? '1' : '0') + '">'
        + '<div class="fiscal-entry-main"><div class="fiscal-entry-icon">' + icon('fiscal') + '</div><div><strong>NF-e ' + esc(invoice.number || invoice.id) + '</strong><small>' + esc(supplier) + ' - emissão ' + dt(invoice.issue_date) + ' - ' + money(invoice.total_invoice) + '</small></div></div>'
        + '<div class="fiscal-entry-status">' + flowChip(invoice.financial_status || 'nao_lancado') + flowChip(invoice.stock_status || 'nao_lancado') + flowChip(invoice.fiscal_status || 'conferencia') + '</div>'
        + '<div class="fiscal-entry-actions"><button type="button" class="btn btn-outline btn-sm" onclick="openFiscalInvoiceDetails(' + invoice.id + ')">' + icon('eye') + ' Ver</button><button type="button" class="btn btn-primary btn-sm" onclick="openFiscalIntegrationModal(' + invoice.id + ')">' + icon('chart') + ' Lançar entrada</button></div>'
        + '</article>';
    }).join('') : '<div class="fiscal-empty fiscal-empty-small">Nenhuma NF-e cadastrada ainda. Importe XML ou consulte a SEFAZ.</div>';
    openModal('<div class="p-6 fiscal-modal-wide fiscal-entry-modal"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">Fila de entrada de NF-e</h2><p class="text-sm text-slate-500 mt-1">Selecione a nota fiscal, revise os itens e confirme o que entra no estoque antes de lançar financeiro e fiscal.</p></div><button type="button" class="btn btn-outline btn-sm" onclick="openFiscalXmlModal()">' + icon('upload') + ' Importar XML</button></div>'
      + '<section class="fiscal-flow-steps"><div><b>1</b><span>Selecionar NF-e</span></div><div><b>2</b><span>Editar itens do estoque</span></div><div><b>3</b><span>CFOP, ICMS e financeiro</span></div><div><b>4</b><span>SPED Blocos C, K e H</span></div></section>'
      + '<div class="fiscal-entry-toolbar"><input class="input" id="fiscalEntrySearch" oninput="filterFiscalEntryQueue()" placeholder="Buscar NF-e, fornecedor, CNPJ, CFOP ou status..."><select class="input" id="fiscalEntryStatus" onchange="filterFiscalEntryQueue()"><option value="">Todas as notas</option><option value="1">Pendentes de entrada</option><option value="0">Já lançadas</option></select></div>'
      + '<div class="fiscal-entry-list">' + rows + '</div>'
      + '<div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>');
  };
  window.filterFiscalEntryQueue = function () {
    var term = ((document.getElementById('fiscalEntrySearch') || {}).value || '').toLowerCase();
    var status = (document.getElementById('fiscalEntryStatus') || {}).value || '';
    document.querySelectorAll('[data-entry-row]').forEach(function (row) {
      var found = !term || row.getAttribute('data-search').indexOf(term) >= 0;
      var statusFound = !status || row.getAttribute('data-pending') === status;
      row.style.display = found && statusFound ? '' : 'none';
    });
  };
  window.openFiscalXmlModal = function () {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Importar XML da NF-e</h2><p class="text-sm text-slate-500 mb-5">Envie o XML oficial. O sistema cadastra a nota e o fornecedor automaticamente.</p><form onsubmit="importFiscalXml(event)"><div class="fiscal-upload-box"><div class="fiscal-kpi-icon mx-auto mb-3">' + icon('upload') + '</div><h3 class="font-bold text-imec-dark mb-2">Selecionar XML da nota fiscal</h3><p class="text-sm text-slate-500 mb-4">Arquivo .xml até 10 MB.</p><input class="input max-w-md mx-auto" type="file" id="fiscalXmlFile" accept=".xml,application/xml,text/xml" required></div><div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 text-sm text-blue-900"><b>Como funciona:</b> o leitor pega chave, número, fornecedor, CNPJ, emissão, CFOP, produtos, valor total e ICMS. Depois você confere e ajusta se precisar.</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">' + icon('robot') + ' Ler XML</button></div></form></div>');
  };
  window.openSefazModal = async function () {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Robô SEFAZ por CNPJ</h2><p class="text-sm text-slate-500 mb-5">Consultando configuração segura do certificado A1...</p><div class="fiscal-upload-box">' + icon('robot') + '<h3 class="font-bold text-imec-dark mt-3">Verificando ambiente</h3></div></div>');
    try {
      var status = await API.fiscal.sefazStatus();
      var missing = status.missing || [];
      var checklist = [
        ['SEFAZ_ENABLED=true', status.enabled],
        ['SEFAZ_CNPJ configurado', !!status.cnpj],
        ['SEFAZ_UF configurado', !!status.uf],
        ['SEFAZ_CERT_PATH configurado', !!status.cert_path_set],
        ['Arquivo .pfx encontrado', !!status.cert_exists],
        ['SEFAZ_CERT_PASSWORD configurada', !!status.cert_password_set]
      ].map(function (item) {
        return '<li class="' + (item[1] ? 'ok' : 'warn') + '"><span>' + (item[1] ? '&#10003;' : '!') + '</span>' + item[0] + '</li>';
      }).join('');
      var readyBox = status.ready
        ? '<div class="fiscal-sefaz-ready">Certificado A1 localizado. Pronto para consultar a distribuição de NF-e na SEFAZ.</div>'
        : '<div class="fiscal-sefaz-warn">Ainda falta: ' + esc(missing.join(', ') || 'configuração') + '.</div>';
      openModal('<div class="p-6 fiscal-modal-wide"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">Robô SEFAZ por CNPJ</h2><p class="text-sm text-slate-500 mt-1">Busca NF-e emitida contra o CNPJ usando certificado A1.</p></div><span class="fiscal-chip ' + (status.ready ? 'ok' : 'warn') + '">' + (status.ready ? 'A1 pronto' : 'Configurar A1') + '</span></div><div class="fiscal-sefaz-grid"><section><h3>Variáveis na Hostinger</h3><ul class="fiscal-sefaz-list">' + checklist + '</ul></section><section><h3>Dados detectados</h3><div class="fiscal-cfop-list"><div class="fiscal-cfop-row"><span>CNPJ</span><b>' + esc(status.cnpj || '-') + '</b></div><div class="fiscal-cfop-row"><span>UF</span><b>' + esc(status.uf || '-') + '</b></div><div class="fiscal-cfop-row"><span>Ambiente</span><b>' + esc(status.environment || '-') + '</b></div><div class="fiscal-cfop-row"><span>Último NSU</span><b>' + esc(status.ultNSU || '000000000000000') + '</b></div></div></section></div>' + readyBox + '<div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 text-sm text-blue-900"><b>Caminho configurado:</b> <code>' + esc(status.cert_path || '-') + '</code><br><b>Caminho encontrado:</b> <code>' + esc(status.cert_resolved_path || 'não encontrado') + '</code><br><span class="text-xs">Se a pasta foi criada no Gerenciador de Arquivos do site, o caminho pode ser <code>/home/u974096246/domains/darkslateblue-seahorse-560479.hostingersite.com/certificados/IMECBASE.pfx</code>. O sistema agora procura esse local também.</span></div><div id="sefazSyncResult" class="mt-4"></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Fechar</button><button type="button" class="btn btn-primary" onclick="startSefazSync()">' + icon('robot') + ' Consultar SEFAZ</button></div></div>');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.startSefazSync = async function () {
    try {
      var box = document.getElementById('sefazSyncResult');
      if (box) box.innerHTML = '<div class="fiscal-sefaz-ready">Consultando SEFAZ, aguarde...</div>';
      var result = await API.fiscal.sefazSync({ cycles: 1 });
      await refreshData();
      await renderPage();
      var msg = (result.xMotivo || 'Consulta concluída') + ' | novas: ' + (result.imported || 0) + ' | atualizadas: ' + (result.updated || 0) + ' | ignoradas: ' + (result.ignored || 0);
      if (box) box.innerHTML = '<div class="fiscal-sefaz-ready"><b>Consulta concluída.</b><br>' + esc(msg) + '<br><span class="text-xs">NSU atual: ' + esc(result.ultNSU || '-') + '</span></div>';
      showToast('SEFAZ: ' + msg, 'success');
    } catch (err) {
      showToast('SEFAZ: ' + err.message, 'error');
    }
  };
  window.importFiscalXml = async function (event) {
    event.preventDefault();
    var file = document.getElementById('fiscalXmlFile').files[0];
    if (!file) return;
    try {
      var fd = new FormData();
      fd.append('file', file);
      await API.fiscal.importXml(fd);
      await refreshData();
      closeModal();
      await renderPage();
      showToast('XML importado e nota cadastrada para conferência', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.downloadFiscalDanfe = async function (id) {
    try {
      var token = typeof getToken === 'function' ? getToken() : sessionStorage.getItem('imec_token');
      var res = await fetch(API_BASE + '/api/fiscal/invoices/' + id + '/danfe.pdf', {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || err.message || ('HTTP ' + res.status));
      }
      var blob = await res.blob();
      var disposition = res.headers.get('Content-Disposition') || '';
      var match = disposition.match(/filename="?([^"]+)"?/i);
      var filename = match ? match[1] : ('danfe-nfe-' + id + '.pdf');
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('PDF da nota baixado', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.downloadFiscalXml = async function (id) {
    try {
      var token = typeof getToken === 'function' ? getToken() : sessionStorage.getItem('imec_token');
      var res = await fetch(API_BASE + '/api/fiscal/invoices/' + id + '/xml', {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || err.message || ('HTTP ' + res.status));
      }
      var blob = await res.blob();
      var disposition = res.headers.get('Content-Disposition') || '';
      var match = disposition.match(/filename="?([^"]+)"?/i);
      var filename = match ? match[1] : ('nfe-' + id + '.xml');
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('XML da NF-e baixado', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.openFiscalInvoiceDetails = async function (id) {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Abrindo nota fiscal...</h2><div class="fiscal-upload-box">' + icon('fiscal') + '<p class="text-sm text-slate-500 mt-3">Carregando itens, impostos e vínculos.</p></div></div>');
    try {
      var result = await API.fiscal.detail(id);
      var invoice = result.invoice || {};
      var items = result.items || [];
      var supplier = invoice.linked_supplier_name || invoice.supplier_name || '-';
      var itemRows = items.length ? items.map(function (item) {
        return '<tr><td>' + esc(item.item_number || '-') + '</td><td class="fiscal-main-cell"><strong>' + esc(item.description || '-') + '</strong><small>' + esc(item.product_code || '') + '</small></td><td>' + esc(item.ncm || '-') + '</td><td class="fiscal-main-cell"><strong>' + esc(item.entry_cfop || item.cfop || '-') + '</strong><small>XML ' + esc(item.cfop || '-') + '</small></td><td>' + flowChip(item.credit_indicator || 'analisar') + '</td><td>' + (item.stock_item_id ? 'Item #' + esc(item.stock_item_id) : '<span class="fiscal-muted">Sem estoque</span>') + '</td><td>' + money(item.total_value) + '</td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="fiscal-empty fiscal-empty-small">Esta nota veio como resumo da SEFAZ ou ainda não possui XML completo com itens.</div></td></tr>';
      openModal('<div class="p-6 fiscal-modal-wide fiscal-detail-modal"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">NF-e ' + esc(invoice.number || invoice.id) + '</h2><p class="text-sm text-slate-500 mt-1">' + esc(supplier) + ' - emissão ' + dt(invoice.issue_date) + '</p></div>' + statusChip(invoice.status) + '</div>'
        + '<div class="fiscal-action-strip"><button class="btn btn-primary btn-sm" onclick="openFiscalIntegrationModal(' + invoice.id + ')">' + icon('chart') + ' Escriturar entrada</button><button class="btn btn-outline btn-sm" onclick="downloadFiscalDanfe(' + invoice.id + ')">' + icon('download') + ' DANFE PDF</button>' + (invoice.xml_url ? '<button class="btn btn-outline btn-sm" onclick="downloadFiscalXml(' + invoice.id + ')">' + icon('download') + ' NF-e XML</button>' : '') + '<button class="btn btn-outline btn-sm" onclick="editFiscalInvoice(' + invoice.id + ')">' + icon('edit') + ' Editar</button></div>'
        + '<section class="fiscal-flow-grid"><div class="fiscal-flow-card"><span>Financeiro</span><strong>' + flowChip(invoice.financial_status || 'nao_lancado') + '</strong><small>vencimento ' + dt(invoice.payment_due_date) + '</small></div><div class="fiscal-flow-card"><span>Estoque</span><strong>' + flowChip(invoice.stock_status || 'nao_lancado') + '</strong><small>entrada por item</small></div><div class="fiscal-flow-card"><span>Fiscal</span><strong>' + flowChip(invoice.fiscal_status || 'conferencia') + '</strong><small>CFOP entrada ' + esc(invoice.entry_cfop || '-') + '</small></div><div class="fiscal-flow-card"><span>SPED</span><strong>' + flowChip(invoice.sped_status || 'pendente') + '</strong><small>blocos C, K e H</small></div></section>'
        + '<section class="fiscal-detail-grid"><div class="fiscal-detail-box"><span>Fornecedor</span><strong>' + esc(supplier) + '</strong><small>' + esc(invoice.supplier_cnpj || '-') + '</small></div><div class="fiscal-detail-box"><span>Pedido de compra</span><strong>' + (invoice.purchase_order_number ? esc(invoice.purchase_order_number) : 'Sem vínculo') + '</strong><small>almoxarifado</small></div><div class="fiscal-detail-box"><span>Total NF-e</span><strong>' + money(invoice.total_invoice) + '</strong><small>produtos ' + money(invoice.total_products) + '</small></div><div class="fiscal-detail-box"><span>ICMS</span><strong>' + money(invoice.icms_value) + '</strong><small>base ' + money(invoice.icms_base) + '</small></div></section>'
        + '<section class="fiscal-detail-box mt-4"><span>Chave de acesso</span><strong class="fiscal-key">' + esc(invoice.access_key || '-') + '</strong><small>CFOP: ' + esc(invoice.cfop || '-') + ' - Natureza: ' + esc(invoice.operation_type || '-') + '</small></section>'
        + '<div class="fiscal-table-wrap mt-4"><table class="fiscal-table fiscal-items-table"><thead><tr><th>Item</th><th>Produto</th><th>NCM</th><th>CFOP entrada</th><th>Crédito</th><th>Estoque</th><th>Total</th></tr></thead><tbody>' + itemRows + '</tbody></table></div>'
        + '<section class="fiscal-detail-box mt-4"><span>Observações</span><p>' + (invoice.notes ? esc(invoice.notes) : 'Sem observações.') + '</p></section>'
        + '<div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.openFiscalIntegrationModal = async function (id) {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Preparando escrituração...</h2><div class="fiscal-upload-box">' + icon('chart') + '<p class="text-sm text-slate-500 mt-3">Carregando itens para integrar financeiro, estoque e fiscal.</p></div></div>');
    try {
      var result = await API.fiscal.detail(id);
      var invoice = result.invoice || {};
      var items = result.items || [];
      var defaultCfop = invoice.entry_cfop || invoice.cfop || (items[0] && items[0].cfop) || '';
      var rows = items.length ? items.map(function (item) {
        var quantityText = (item.quantity != null ? String(item.quantity) : '0') + ' ' + (item.unit || 'UN');
        var stockName = item.stock_name || item.description || '';
        var stockCategory = item.stock_category || 'NF-e';
        var stockUnit = item.stock_unit || item.unit || 'UN';
        var stockLocation = item.stock_location || 'Almoxarifado';
        var minimumStock = item.minimum_stock || 0;
        return '<tr data-fiscal-item-row data-item-id="' + esc(item.id) + '">'
          + '<td class="fiscal-main-cell"><strong>' + esc(item.item_number || '-') + '</strong><small>' + esc(item.product_code || '') + '</small></td>'
          + '<td class="fiscal-main-cell"><strong>' + esc(item.description || '-') + '</strong><small>Qtd. ' + esc(quantityText) + ' | Unit. ' + money(item.unit_value) + ' | Total ' + money(item.total_value) + '</small><small>NCM ' + esc(item.ncm || '-') + ' | XML CFOP ' + esc(item.cfop || '-') + '</small></td>'
          + '<td><input class="input fiscal-small-input" data-field="entry_cfop" value="' + esc(item.entry_cfop || defaultCfop || item.cfop || '') + '"></td>'
          + '<td><select class="input fiscal-small-input" data-field="credit_indicator">' + creditOptions(item.credit_indicator) + '</select></td>'
          + '<td><input type="number" step="0.01" class="input fiscal-small-input" data-field="icms_credit_base" value="' + esc(item.icms_credit_base || item.total_value || 0) + '"><input type="number" step="0.01" class="input fiscal-small-input mt-2" data-field="icms_credit_value" value="' + esc(item.icms_credit_value || item.icms_value || 0) + '"></td>'
          + '<td class="fiscal-stock-cell"><select class="input fiscal-stock-select" data-field="stock_item_id">' + stockItemOptions(item.stock_item_id) + '</select>'
          + '<div class="fiscal-stock-editor"><span>Como entra no estoque</span><input class="input fiscal-stock-name" data-field="stock_name" value="' + esc(stockName) + '" placeholder="Nome interno do item">'
          + '<div class="fiscal-stock-grid"><input class="input" data-field="stock_category" value="' + esc(stockCategory) + '" placeholder="Categoria"><input class="input" data-field="stock_unit" value="' + esc(stockUnit) + '" placeholder="UN"><input class="input" data-field="stock_location" value="' + esc(stockLocation) + '" placeholder="Local"><input type="number" step="0.01" class="input" data-field="minimum_stock" value="' + esc(minimumStock) + '" placeholder="Min."></div></div>'
          + '<label class="fiscal-inline-check"><input type="checkbox" data-field="skip_stock"' + (item.tax_status === 'sem_movimento' ? ' checked' : '') + '> Não entra no estoque</label></td>'
          + '<td><input class="input fiscal-small-input" data-field="fiscal_notes" value="' + esc(item.fiscal_notes || '') + '" placeholder="observação"></td>'
          + '</tr>';
      }).join('') : '<tr><td colspan="7"><div class="fiscal-empty fiscal-empty-small">Esta nota ainda não possui itens completos. Importe o XML completo para movimentar estoque por produto.</div></td></tr>';
      openModal('<div class="p-6 fiscal-modal-wide fiscal-detail-modal"><form onsubmit="saveFiscalIntegration(event,' + invoice.id + ')"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">Lançamento de entrada NF-e ' + esc(invoice.number || invoice.id) + '</h2><p class="text-sm text-slate-500 mt-1">Confira a nota, selecione o item de estoque de cada produto e ajuste CFOP/ICMS antes de salvar.</p></div>' + flowChip(invoice.fiscal_status || 'conferencia') + '</div>'
        + '<section class="fiscal-flow-steps mt-2"><div><b>1</b><span>Financeiro a pagar</span></div><div><b>2</b><span>Entrada no estoque</span></div><div><b>3</b><span>CFOP e ICMS por item</span></div><div><b>4</b><span>SPED mensal</span></div></section>'
        + '<section class="fiscal-integration-head"><div><label class="label">CFOP entrada padrão</label><input class="input" id="fiEntryCfop" value="' + esc(defaultCfop) + '" placeholder="ex. 1556, 1407, 1102"></div><div><label class="label">Vencimento financeiro</label><input type="date" class="input" id="fiPaymentDue" value="' + esc(inputDate(invoice.payment_due_date || invoice.due_date || invoice.entry_date || invoice.issue_date)) + '"></div><div><label class="label">Status fiscal</label><select class="input" id="fiFiscalStatus"><option value="conferencia"' + ((invoice.fiscal_status || 'conferencia') === 'conferencia' ? ' selected' : '') + '>Conferência</option><option value="escriturado"' + (invoice.fiscal_status === 'escriturado' ? ' selected' : '') + '>Escriturado</option><option value="pendente"' + (invoice.fiscal_status === 'pendente' ? ' selected' : '') + '>Pendente</option></select></div><div><label class="label">SPED</label><select class="input" id="fiSpedStatus"><option value="pendente"' + ((invoice.sped_status || 'pendente') === 'pendente' ? ' selected' : '') + '>Pendente</option><option value="dispensado"' + (invoice.sped_status === 'dispensado' ? ' selected' : '') + '>Dispensado</option><option value="gerado"' + (invoice.sped_status === 'gerado' ? ' selected' : '') + '>Gerado</option></select></div></section>'
        + '<div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 text-sm text-blue-900"><b>Como salva:</b> o botão final cria/atualiza contas a pagar, gera a entrada do estoque dos itens marcados, grava CFOP/ICMS fiscal por item e deixa a nota pronta para o TXT SPED. Valide o SPED com o contador/PVA antes do envio oficial.</div>'
        + '<div class="fiscal-table-wrap mt-4"><table class="fiscal-table fiscal-items-table fiscal-integration-table"><thead><tr><th>Item</th><th>Produto</th><th>CFOP entrada</th><th>Crédito ICMS</th><th>Base / valor</th><th>Estoque</th><th>Obs.</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '<div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="openFiscalEntryQueueModal()">Voltar para fila</button><button class="btn btn-primary">' + icon('chart') + ' Salvar e lançar entrada</button></div></form></div>');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.saveFiscalIntegration = async function (event, id) {
    event.preventDefault();
    function rowValue(row, field) {
      var el = row.querySelector('[data-field="' + field + '"]');
      return el ? (el.type === 'checkbox' ? el.checked : el.value) : '';
    }
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-fiscal-item-row]'));
    var data = {
      entry_cfop: document.getElementById('fiEntryCfop').value,
      payment_due_date: document.getElementById('fiPaymentDue').value,
      fiscal_status: document.getElementById('fiFiscalStatus').value,
      sped_status: document.getElementById('fiSpedStatus').value,
      items: rows.map(function (row) {
        return {
          id: row.getAttribute('data-item-id'),
          entry_cfop: rowValue(row, 'entry_cfop'),
          credit_indicator: rowValue(row, 'credit_indicator'),
          icms_credit_base: rowValue(row, 'icms_credit_base'),
          icms_credit_value: rowValue(row, 'icms_credit_value'),
          stock_item_id: rowValue(row, 'stock_item_id'),
          stock_name: rowValue(row, 'stock_name'),
          stock_category: rowValue(row, 'stock_category'),
          stock_unit: rowValue(row, 'stock_unit'),
          stock_location: rowValue(row, 'stock_location'),
          minimum_stock: rowValue(row, 'minimum_stock'),
          skip_stock: rowValue(row, 'skip_stock'),
          fiscal_notes: rowValue(row, 'fiscal_notes')
        };
      })
    };
    try {
      await API.fiscal.integrate(id, data);
      await refreshData();
      closeModal();
      await renderPage();
      showToast('Entrada lancada: financeiro, estoque e fiscal atualizados', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  function fiscalReportMetric(label, value, note, kind) {
    return '<div class="fiscal-report-card ' + esc(kind || '') + '"><span>' + esc(label) + '</span><strong>' + value + '</strong><small>' + esc(note || '') + '</small></div>';
  }
  function fiscalIssueList(title, list, mapper) {
    return '<div class="fiscal-report-card fiscal-report-card-wide"><div class="fiscal-section-actions"><div><span>' + esc(title) + '</span><small>' + list.length + ' pendência(s)</small></div></div><div class="fiscal-issue-list">'
      + (list.length ? list.map(mapper).join('') : '<div class="fiscal-empty fiscal-empty-small">Tudo certo neste ponto.</div>')
      + '</div></div>';
  }
  window.openFiscalConferenceModal = async function () {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Conferência fiscal</h2><div class="fiscal-upload-box">' + icon('checklist') + '<p class="text-sm text-slate-500 mt-3">Montando conferência de notas, CFOP, ICMS, financeiro, estoque e SPED.</p></div></div>');
    try {
      var result = await API.fiscal.reportSummary({});
      var m = result.metrics || {};
      var issues = result.issues || {};
      var cfops = result.cfop_summary || [];
      var icms = result.icms_summary || [];
      var cfopRows = cfops.length ? cfops.map(function (row) {
        return '<tr><td>CFOP ' + esc(row.entry_cfop || '-') + '</td><td>' + esc(row.items_count || 0) + '</td><td>' + money(row.total_value) + '</td><td>' + money(row.icms_credit) + '</td></tr>';
      }).join('') : '<tr><td colspan="4"><div class="fiscal-empty fiscal-empty-small">Sem CFOP no período.</div></td></tr>';
      var icmsRows = icms.length ? icms.map(function (row) {
        return '<tr><td>' + flowChip(row.credit_indicator || 'analisar') + '</td><td>' + esc(row.items_count || 0) + '</td><td>' + money(row.credit_base) + '</td><td>' + money(row.credit_value) + '</td></tr>';
      }).join('') : '<tr><td colspan="4"><div class="fiscal-empty fiscal-empty-small">Sem decisões de ICMS no período.</div></td></tr>';
      openModal('<div class="p-6 fiscal-modal-wide fiscal-report-modal"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">Conferência fiscal integrada</h2><p class="text-sm text-slate-500 mt-1">Visão para fechar nota, financeiro, estoque e SPED sem perder pendência.</p></div><button type="button" class="btn btn-primary btn-sm" onclick="openFiscalEntryQueueModal()">' + icon('chart') + ' Fila de entrada</button></div>'
        + '<section class="fiscal-report-grid">'
        + fiscalReportMetric('Notas do período', m.total_invoices || 0, money(m.total_value || 0), 'info')
        + fiscalReportMetric('Financeiro aberto', m.open_payables || 0, money(m.open_payables_total || 0), 'warn')
        + fiscalReportMetric('Entradas estoque', m.stock_entries || 0, (m.stock_items || 0) + ' item(ns) movimentado(s)', 'ok')
        + fiscalReportMetric('SPED gerado', m.sped_exports || 0, (m.pending_sped || 0) + ' nota(s) pendente(s)', 'neutral')
        + '</section>'
        + '<section class="fiscal-two-col mt-4">'
        + fiscalIssueList('Notas sem financeiro', issues.without_finance || [], function (row) { return '<div class="fiscal-issue-row"><b>NF-e ' + esc(row.number || row.id) + '</b><span>' + esc(row.supplier_name || '-') + '</span><strong>' + money(row.total_invoice) + '</strong></div>'; })
        + fiscalIssueList('Notas sem estoque', issues.without_stock || [], function (row) { return '<div class="fiscal-issue-row"><b>NF-e ' + esc(row.number || row.id) + '</b><span>' + esc(row.supplier_name || '-') + '</span><strong>' + flowChip(row.stock_status || 'nao_lancado') + '</strong></div>'; })
        + fiscalIssueList('Itens sem CFOP de entrada', issues.without_cfop || [], function (row) { return '<div class="fiscal-issue-row"><b>NF-e ' + esc((row.invoice || {}).number || row.invoice_id) + '</b><span>' + esc(row.description || '-').slice(0, 90) + '</span><strong>CFOP</strong></div>'; })
        + fiscalIssueList('Itens sem decisão ICMS', issues.without_icms_decision || [], function (row) { return '<div class="fiscal-issue-row"><b>NF-e ' + esc((row.invoice || {}).number || row.invoice_id) + '</b><span>' + esc(row.description || '-').slice(0, 90) + '</span><strong>ICMS</strong></div>'; })
        + '</section>'
        + '<section class="fiscal-two-col mt-4"><div class="fiscal-report-card fiscal-report-card-wide"><span>Resumo por CFOP</span><div class="fiscal-table-wrap mt-3"><table class="fiscal-status-table"><thead><tr><th>CFOP</th><th>Itens</th><th>Total</th><th>Crédito ICMS</th></tr></thead><tbody>' + cfopRows + '</tbody></table></div></div>'
        + '<div class="fiscal-report-card fiscal-report-card-wide"><span>Resumo de ICMS</span><div class="fiscal-table-wrap mt-3"><table class="fiscal-status-table"><thead><tr><th>Decisão</th><th>Itens</th><th>Base</th><th>Valor</th></tr></thead><tbody>' + icmsRows + '</tbody></table></div></div></section>'
        + '<div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Fechar</button><button type="button" class="btn btn-primary" onclick="openFiscalSpedModal()">' + icon('download') + ' SPED TXT</button></div></div>');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.openFiscalFinanceModal = async function () {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Financeiro fiscal</h2><div class="fiscal-upload-box">' + icon('wallet') + '<p class="text-sm text-slate-500 mt-3">Carregando títulos gerados pelas notas fiscais de entrada.</p></div></div>');
    try {
      var rows = await API.fiscal.payables();
      rows = rows || [];
      var openRows = rows.filter(function (r) { return ['aberto', 'parcial', 'vencido'].indexOf(r.status || 'aberto') >= 0; });
      var paidRows = rows.filter(function (r) { return r.status === 'pago'; });
      var openTotal = openRows.reduce(function (sum, r) { return sum + Math.max(0, Number(r.total_amount || 0) - Number(r.paid_amount || 0)); }, 0);
      var paidTotal = paidRows.reduce(function (sum, r) { return sum + Number(r.paid_amount || r.total_amount || 0); }, 0);
      var body = rows.length ? rows.map(function (row) {
        var saldo = Math.max(0, Number(row.total_amount || 0) - Number(row.paid_amount || 0));
        return '<tr><td class="fiscal-main-cell"><strong>NF-e ' + esc(row.invoice_number || row.invoice_id || '-') + '</strong><small>' + esc(row.supplier_name || '-') + '</small></td><td>' + dt(row.due_date) + '</td><td>' + money(row.total_amount) + '</td><td>' + money(row.paid_amount) + '</td><td>' + money(saldo) + '</td><td>' + flowChip(row.status || 'aberto') + '</td><td><div class="flex gap-2"><button class="btn btn-outline btn-sm" onclick="markFiscalPayable(' + row.id + ', &quot;aberto&quot;, 0)">Reabrir</button><button class="btn btn-primary btn-sm" onclick="markFiscalPayable(' + row.id + ', &quot;pago&quot;, ' + Number(row.total_amount || 0) + ')">Baixar</button></div></td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="fiscal-empty fiscal-empty-small">Nenhum título financeiro fiscal gerado ainda.</div></td></tr>';
      openModal('<div class="p-6 fiscal-modal-wide fiscal-report-modal"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">Financeiro das notas de entrada</h2><p class="text-sm text-slate-500 mt-1">Contas a pagar criadas pela escrituração das NF-e.</p></div><button type="button" class="btn btn-outline btn-sm" onclick="openFiscalEntryQueueModal()">' + icon('chart') + ' Fila de entrada</button></div>'
        + '<section class="fiscal-report-grid">' + fiscalReportMetric('Títulos abertos', openRows.length, money(openTotal), 'warn') + fiscalReportMetric('Títulos pagos', paidRows.length, money(paidTotal), 'ok') + fiscalReportMetric('Total títulos', rows.length, 'histórico fiscal', 'info') + fiscalReportMetric('Integração', 'NF-e', 'financeiro alimentado pela entrada', 'neutral') + '</section>'
        + '<div class="fiscal-table-wrap mt-4"><table class="fiscal-status-table"><thead><tr><th>Nota / fornecedor</th><th>Vencimento</th><th>Total</th><th>Pago</th><th>Saldo</th><th>Status</th><th>Ações</th></tr></thead><tbody>' + body + '</tbody></table></div>'
        + '<div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.markFiscalPayable = async function (id, status, total) {
    try {
      await API.fiscal.updatePayable(id, {
        status: status,
        paid_amount: status === 'pago' ? Number(total || 0) : 0,
        notes: status === 'pago' ? 'Baixado pelo painel fiscal' : 'Reaberto pelo painel fiscal'
      });
      await refreshData();
      await openFiscalFinanceModal();
      showToast(status === 'pago' ? 'Título baixado no financeiro.' : 'Título reaberto.', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.openFiscalStockLedgerModal = async function () {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Estoque fiscal</h2><div class="fiscal-upload-box">' + icon('box') + '<p class="text-sm text-slate-500 mt-3">Carregando entradas de estoque geradas pelas notas fiscais.</p></div></div>');
    try {
      var rows = await API.fiscal.stockMovements();
      rows = rows || [];
      var totalQty = rows.reduce(function (sum, r) { return sum + Number(r.quantity || 0); }, 0);
      var totalCost = rows.reduce(function (sum, r) { return sum + Number(r.total_cost || 0); }, 0);
      var body = rows.length ? rows.map(function (row) {
        return '<tr><td class="fiscal-main-cell"><strong>' + esc(row.stock_item_name || row.invoice_item_description || '-') + '</strong><small>NF-e ' + esc(row.invoice_number || row.invoice_id || '-') + '</small></td><td>' + dt(row.movement_date) + '</td><td>' + flowChip(row.type || 'entrada') + '</td><td>' + esc(row.quantity || 0) + ' ' + esc(row.unit || '') + '</td><td>' + money(row.unit_cost) + '</td><td>' + money(row.total_cost) + '</td><td>' + esc(row.notes || '-').slice(0, 80) + '</td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="fiscal-empty fiscal-empty-small">Nenhuma entrada de estoque fiscal ainda.</div></td></tr>';
      openModal('<div class="p-6 fiscal-modal-wide fiscal-report-modal"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">Movimentos de estoque por NF-e</h2><p class="text-sm text-slate-500 mt-1">Histórico das entradas que alimentam almoxarifado e bloco K.</p></div><button type="button" class="btn btn-outline btn-sm" onclick="openFiscalEntryQueueModal()">' + icon('chart') + ' Lançar NF-e</button></div>'
        + '<section class="fiscal-report-grid">' + fiscalReportMetric('Movimentos', rows.length, 'entradas vinculadas a nota', 'info') + fiscalReportMetric('Quantidade total', totalQty.toLocaleString('pt-BR'), 'soma operacional', 'ok') + fiscalReportMetric('Custo total', money(totalCost), 'base de estoque', 'neutral') + fiscalReportMetric('Bloco K', 'Base', 'movimentos prontos para conferência', 'warn') + '</section>'
        + '<div class="fiscal-table-wrap mt-4"><table class="fiscal-status-table"><thead><tr><th>Item / nota</th><th>Data</th><th>Tipo</th><th>Qtd.</th><th>Unitário</th><th>Total</th><th>Obs.</th></tr></thead><tbody>' + body + '</tbody></table></div>'
        + '<div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.openFiscalSpedHistoryModal = async function () {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Histórico SPED</h2><div class="fiscal-upload-box">' + icon('history') + '<p class="text-sm text-slate-500 mt-3">Carregando arquivos TXT gerados pelo sistema.</p></div></div>');
    try {
      var rows = await API.fiscal.spedExports();
      rows = rows || [];
      var body = rows.length ? rows.map(function (row) {
        var summary = row.summary || {};
        return '<tr><td class="fiscal-main-cell"><strong>' + esc(row.file_name || 'sped-fiscal.txt') + '</strong><small>' + dt(row.period_start) + ' até ' + dt(row.period_end) + '</small></td><td>' + flowChip(row.status || 'gerado') + '</td><td>' + esc(summary.invoices || 0) + ' nota(s)</td><td>' + esc(summary.items || 0) + ' item(ns)</td><td>' + esc(summary.stock_movements || 0) + ' movimento(s)</td><td>' + dt(row.created_at) + '</td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="fiscal-empty fiscal-empty-small">Nenhum TXT SPED gerado ainda.</div></td></tr>';
      openModal('<div class="p-6 fiscal-modal-wide fiscal-report-modal"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">Histórico de geração SPED</h2><p class="text-sm text-slate-500 mt-1">Controle mensal dos arquivos gerados para conferência com contador/PVA.</p></div><button type="button" class="btn btn-primary btn-sm" onclick="openFiscalSpedModal()">' + icon('download') + ' Gerar novo TXT</button></div><div class="fiscal-table-wrap"><table class="fiscal-status-table"><thead><tr><th>Arquivo</th><th>Status</th><th>Notas</th><th>Itens</th><th>Estoque</th><th>Gerado em</th></tr></thead><tbody>' + body + '</tbody></table></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.openFiscalSpedModal = function () {
    var now = new Date();
    var month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Gerar SPED Fiscal TXT</h2><p class="text-sm text-slate-500 mb-5">Exporta uma base operacional dos blocos C, K e H para conferência mensal.</p><form onsubmit="generateFiscalSped(event)"><div class="fiscal-form-grid"><div><label class="label">Período</label><input type="month" class="input" id="fiscalSpedMonth" value="' + esc(month) + '" required></div><div><label class="label">Blocos</label><input class="input" value="C, K e H" disabled></div></div><div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 text-sm text-blue-900"><b>Validação oficial:</b> o TXT gerado é uma base para conferência. Antes de transmitir, valide com o contador e no PVA/SPED.</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="openFiscalSpedHistoryModal()">Histórico SPED</button><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">' + icon('download') + ' Baixar TXT</button></div></form></div>');
  };
  window.generateFiscalSped = async function (event) {
    event.preventDefault();
    var month = document.getElementById('fiscalSpedMonth').value;
    try {
      var result = await API.fiscal.spedExport({ month: month });
      downloadTextFile(result.filename || 'sped-fiscal-imec.txt', result.file_content || '');
      await refreshData();
      closeModal();
      await renderPage();
      showToast('TXT SPED gerado. Valide no PVA/contador antes do envio oficial.', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.openFiscalInvoiceModal = function (id) {
    var invoice = id ? invoices().find(function (x) { return String(x.id) === String(id); }) : {};
    invoice = invoice || {};
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">' + (id ? 'Editar nota fiscal' : 'Nova nota fiscal manual') + '</h2><p class="text-sm text-slate-500 mb-5">Use quando a nota não tiver XML disponível.</p><form onsubmit="saveFiscalInvoice(event,' + (id || 'null') + ')"><div class="fiscal-form-grid">'
      + '<div><label class="label">Fornecedor</label><input class="input" id="fiSupplier" value="' + esc(invoice.supplier_name) + '"></div><div><label class="label">CNPJ</label><input class="input" id="fiCnpj" value="' + esc(invoice.supplier_cnpj) + '"></div>'
      + '<div><label class="label">Número</label><input class="input" id="fiNumber" value="' + esc(invoice.number) + '"></div><div><label class="label">Série</label><input class="input" id="fiSeries" value="' + esc(invoice.series) + '"></div>'
      + '<div><label class="label">Emissão</label><input type="date" class="input" id="fiIssue" value="' + esc(inputDate(invoice.issue_date)) + '"></div><div><label class="label">Entrada</label><input type="date" class="input" id="fiEntry" value="' + esc(inputDate(invoice.entry_date)) + '"></div>'
      + '<div><label class="label">Natureza da operação</label><input class="input" id="fiOperation" value="' + esc(invoice.operation_type) + '"></div><div><label class="label">CFOP</label><input class="input" id="fiCfop" value="' + esc(invoice.cfop) + '"></div>'
      + '<div><label class="label">Pedido de compra</label><select class="input" id="fiPurchaseOrder">' + purchaseOrderOptions(invoice.purchase_order_id) + '</select></div><div><label class="label">Status</label><select class="input" id="fiStatus"><option value="conferencia"' + ((invoice.status || 'conferencia') === 'conferencia' ? ' selected' : '') + '>Conferência</option><option value="conferida"' + (invoice.status === 'conferida' ? ' selected' : '') + '>Conferida</option><option value="pendente"' + (invoice.status === 'pendente' ? ' selected' : '') + '>Pendente</option><option value="divergente"' + (invoice.status === 'divergente' ? ' selected' : '') + '>Divergente</option><option value="cancelada"' + (invoice.status === 'cancelada' ? ' selected' : '') + '>Cancelada</option></select></div>'
      + '<div><label class="label">Total produtos</label><input type="number" step="0.01" class="input" id="fiProducts" value="' + esc(invoice.total_products || 0) + '"></div><div><label class="label">Total da nota</label><input type="number" step="0.01" class="input" id="fiTotal" value="' + esc(invoice.total_invoice || 0) + '"></div>'
      + '<div><label class="label">Frete</label><input type="number" step="0.01" class="input" id="fiFreight" value="' + esc(invoice.freight_value || 0) + '"></div><div><label class="label">Desconto</label><input type="number" step="0.01" class="input" id="fiDiscount" value="' + esc(invoice.discount_value || 0) + '"></div>'
      + '<div><label class="label">Base ICMS</label><input type="number" step="0.01" class="input" id="fiIcmsBase" value="' + esc(invoice.icms_base || 0) + '"></div><div><label class="label">ICMS</label><input type="number" step="0.01" class="input" id="fiIcms" value="' + esc(invoice.icms_value || 0) + '"></div>'
      + '<div><label class="label">IPI</label><input type="number" step="0.01" class="input" id="fiIpi" value="' + esc(invoice.ipi_value || 0) + '"></div><div><label class="label">PIS</label><input type="number" step="0.01" class="input" id="fiPis" value="' + esc(invoice.pis_value || 0) + '"></div>'
      + '<div><label class="label">COFINS</label><input type="number" step="0.01" class="input" id="fiCofins" value="' + esc(invoice.cofins_value || 0) + '"></div>'
      + '<div><label class="label">Destinatário</label><input class="input" id="fiClientName" value="' + esc(invoice.client_name) + '"></div><div><label class="label">CNPJ destinatário</label><input class="input" id="fiClientCnpj" value="' + esc(invoice.client_cnpj) + '"></div>'
      + '<div class="fiscal-form-full"><label class="label">Chave de acesso</label><input class="input" id="fiKey" value="' + esc(invoice.access_key) + '"></div>'
      + '<div class="fiscal-form-full"><label class="label">Observações</label><textarea class="input" id="fiNotes" rows="3">' + esc(invoice.notes) + '</textarea></div></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Salvar nota</button></div></form></div>');
  };
  window.editFiscalInvoice = function (id) { openFiscalInvoiceModal(id); };
  window.saveFiscalInvoice = async function (event, id) {
    event.preventDefault();
    var data = {
      supplier_name: document.getElementById('fiSupplier').value,
      supplier_cnpj: document.getElementById('fiCnpj').value,
      number: document.getElementById('fiNumber').value,
      series: document.getElementById('fiSeries').value,
      issue_date: document.getElementById('fiIssue').value,
      entry_date: document.getElementById('fiEntry').value,
      operation_type: document.getElementById('fiOperation').value,
      cfop: document.getElementById('fiCfop').value,
      purchase_order_id: document.getElementById('fiPurchaseOrder').value,
      total_products: document.getElementById('fiProducts').value,
      total_invoice: document.getElementById('fiTotal').value,
      freight_value: document.getElementById('fiFreight').value,
      discount_value: document.getElementById('fiDiscount').value,
      icms_base: document.getElementById('fiIcmsBase').value,
      icms_value: document.getElementById('fiIcms').value,
      ipi_value: document.getElementById('fiIpi').value,
      pis_value: document.getElementById('fiPis').value,
      cofins_value: document.getElementById('fiCofins').value,
      status: document.getElementById('fiStatus').value,
      access_key: document.getElementById('fiKey').value,
      client_name: document.getElementById('fiClientName').value,
      client_cnpj: document.getElementById('fiClientCnpj').value,
      notes: document.getElementById('fiNotes').value
    };
    try {
      if (id) await API.fiscal.update(id, data);
      else await API.fiscal.create(data);
      await refreshData(); closeModal(); await renderPage(); showToast('Nota fiscal salva', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };
  window.deleteFiscalInvoice = async function (id) {
    if (!confirm('Excluir esta nota fiscalê')) return;
    try {
      await API.fiscal.delete(id);
      await refreshData(); await renderPage(); showToast('Nota excluida', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };
  window.filterFiscalInvoices = function () {
    var term = (document.getElementById('fiscalSearch') || {}).value || '';
    var status = (document.getElementById('fiscalStatus') || {}).value || '';
    term = term.toLowerCase();
    document.querySelectorAll('[data-fiscal-row]').forEach(function (row) {
      var found = !term || row.getAttribute('data-search').indexOf(term) >= 0;
      var statusFound = !status || row.getAttribute('data-status') === status;
      row.style.display = found && statusFound ? '' : 'none';
    });
  };
  window.exportFiscalCsv = function () {
    var lines = ['numero;serie;fornecedor;cnpj;pedido_compra;emissao;entrada;cfop;total_produtos;frete;desconto;total;icms;status;chave'];
    invoices().forEach(function (i) {
      lines.push([i.number, i.series, i.supplier_name, i.supplier_cnpj, i.purchase_order_number, dt(i.issue_date), dt(i.entry_date), i.cfop, i.total_products, i.freight_value, i.discount_value, i.total_invoice, i.icms_value, i.status, i.access_key].map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';'));
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'notas-fiscais-imec.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  function addSidebar() {
    if (document.querySelector('[data-page="fiscal"]')) return;
    var after = document.querySelector('[data-page="warehouse"]') || document.querySelector('[data-page="proposals"]') || document.querySelector('[data-page="clients"]');
    var link = document.createElement('a');
    link.href = '#';
    link.className = 'sidebar-link';
    link.setAttribute('data-page', 'fiscal');
    link.setAttribute('onclick', "navigate('fiscal'); return false;");
    link.innerHTML = icon('fiscal') + '<span>Fiscal / NF-e</span>';
    if (after && after.parentNode) after.parentNode.insertBefore(link, after.nextSibling);
  }
  function install(attempts) {
    if (typeof renderers === 'undefined' || typeof API === 'undefined') {
      if ((attempts || 0) < 80) setTimeout(function () { install((attempts || 0) + 1); }, 80);
      return;
    }
    addSidebar();
    renderers.fiscal = async function () { return renderFiscal(); };
  }
  install(0);
})();
