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
      trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
      download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
      robot: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="M8 18h8"/></svg>',
      chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>'
    };
    return icons[name] || icons.fiscal;
  }
  function statusChip(status) {
    var label = { conferida: 'Conferida', conferencia: 'Confer&ecirc;ncia', pendente: 'Pendente', cancelada: 'Cancelada' }[status] || (status || 'Confer&ecirc;ncia');
    var cls = status === 'conferida' ? 'ok' : (status === 'cancelada' ? 'warn' : 'info');
    return '<span class="fiscal-chip ' + cls + '">' + label + '</span>';
  }
  function invoices() {
    return (fiscal().invoices || []).slice();
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
  function renderInvoiceRows(list) {
    if (!list.length) return '<tr><td colspan="8"><div class="fiscal-empty">Importe o primeiro XML de NF-e ou cadastre uma nota manual.</div></td></tr>';
    return list.map(function (invoice) {
      var supplier = invoice.linked_supplier_name || invoice.supplier_name || '-';
      var xml = invoice.xml_url ? '<a class="fiscal-icon-btn" href="' + esc(invoice.xml_url) + '" target="_blank" download title="Baixar XML">' + icon('download') + '</a>' : '';
      return '<tr data-fiscal-row data-search="' + esc([supplier, invoice.supplier_cnpj, invoice.number, invoice.access_key, invoice.cfop].join(' ').toLowerCase()) + '">'
        + '<td class="fiscal-main-cell"><strong>NF-e ' + esc(invoice.number || '-') + '</strong><small>S&eacute;rie ' + esc(invoice.series || '-') + ' &bull; Modelo ' + esc(invoice.model || '55') + '</small></td>'
        + '<td class="fiscal-main-cell"><strong>' + esc(supplier) + '</strong><small>' + esc(invoice.supplier_cnpj || '') + '</small></td>'
        + '<td>' + dt(invoice.issue_date) + '</td>'
        + '<td>' + esc(invoice.cfop || '-') + '</td>'
        + '<td><strong>' + money(invoice.total_invoice) + '</strong></td>'
        + '<td>' + money(invoice.icms_value) + '</td>'
        + '<td>' + statusChip(invoice.status) + '</td>'
        + '<td><div class="flex gap-2">' + xml + '<button class="fiscal-icon-btn" onclick="editFiscalInvoice(' + invoice.id + ')" title="Editar">' + icon('edit') + '</button><button class="fiscal-icon-btn" onclick="deleteFiscalInvoice(' + invoice.id + ')" title="Excluir">' + icon('trash') + '</button></div></td>'
        + '</tr>';
    }).join('');
  }
  function renderFiscal() {
    var data = fiscal();
    var metrics = data.metrics || {};
    var list = invoices();
    var cfops = topCfops(list);
    return '<div class="fiscal-page fade-in">'
      + '<section class="fiscal-hero"><div><div class="fiscal-eyebrow">Controle fiscal</div><h2 class="text-2xl">Notas fiscais, XML, ICMS e SPED</h2><p class="text-slate-600 mt-1">Importe XML de NF-e, cadastre fornecedores sem duplicar e acompanhe impostos em uma fila de confer&ecirc;ncia.</p></div><div class="fiscal-actions"><button class="btn btn-outline" onclick="openFiscalInvoiceModal()">' + icon('plus') + ' Nota manual</button><button class="btn btn-primary" onclick="openFiscalXmlModal()">' + icon('upload') + ' Importar XML</button></div></section>'
      + '<section class="fiscal-kpis">'
      + fiscalKpi('fiscal', 'Notas', metrics.invoices || 0, 'XML e manuais')
      + fiscalKpi('chart', 'Total do m&ecirc;s', money(metrics.month_total || 0), 'valor faturado')
      + fiscalKpi('fiscal', 'ICMS destacado', money(metrics.icms_value || 0), 'base para confer&ecirc;ncia')
      + fiscalKpi('robot', 'Pendentes', metrics.pending || 0, 'aguardando revis&atilde;o')
      + fiscalKpi('upload', 'Fornecedores', metrics.suppliers || 0, 'sem repeti&ccedil;&atilde;o')
      + '</section>'
      + '<section class="fiscal-grid"><div class="fiscal-panel"><div class="fiscal-panel-head"><div><h3 class="text-xl">Controle de notas fiscais</h3><p class="text-sm text-slate-500">Consulte por fornecedor, CNPJ, CFOP, n&uacute;mero ou chave da nota.</p></div><button class="btn btn-outline btn-sm" onclick="exportFiscalCsv()">Exportar CSV</button></div><div class="fiscal-panel-body fiscal-filters"><input class="input" id="fiscalSearch" oninput="filterFiscalInvoices()" placeholder="Buscar nota, fornecedor, CNPJ ou CFOP..."><select class="input" id="fiscalStatus" onchange="filterFiscalInvoices()"><option value="">Todos os status</option><option value="conferencia">Confer&ecirc;ncia</option><option value="conferida">Conferida</option><option value="pendente">Pendente</option><option value="cancelada">Cancelada</option></select></div><div class="fiscal-table-wrap"><table class="fiscal-table"><thead><tr><th>Nota</th><th>Fornecedor</th><th>Emiss&atilde;o</th><th>CFOP</th><th>Total</th><th>ICMS</th><th>Status</th><th>A&ccedil;&otilde;es</th></tr></thead><tbody>' + renderInvoiceRows(list) + '</tbody></table></div></div>'
      + '<aside class="fiscal-panel"><div class="fiscal-panel-head"><div><h3>SPED e CFOP</h3><p class="text-sm text-slate-500">Leitura executiva para confer&ecirc;ncia fiscal.</p></div></div><div class="fiscal-panel-body"><div class="fiscal-upload-box mb-4">' + icon('robot') + '<h4 class="font-bold mt-3 text-imec-dark">Rob&ocirc; fiscal preparado</h4><p class="text-sm text-slate-500 mt-1">A base j&aacute; recebe XML. Depois podemos ligar certificado digital/contador para buscar notas na SEFAZ.</p></div><div class="fiscal-cfop-list">' + (cfops.length ? cfops.map(function (row) { return '<div class="fiscal-cfop-row"><div><b>CFOP ' + esc(row.cfop) + '</b><p class="text-xs text-slate-500">' + row.count + ' nota(s)</p></div><strong>' + money(row.total) + '</strong></div>'; }).join('') : '<div class="fiscal-empty">Nenhum CFOP importado ainda.</div>') + '</div></div></aside></section>'
      + '</div>';
  }
  function fiscalKpi(iconName, label, value, note) {
    return '<div class="fiscal-kpi"><div class="fiscal-kpi-icon">' + icon(iconName) + '</div><div><span>' + label + '</span><strong>' + value + '</strong><p class="text-xs text-slate-500 mt-2">' + note + '</p></div></div>';
  }
  window.openFiscalXmlModal = function () {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Importar XML da NF-e</h2><p class="text-sm text-slate-500 mb-5">Envie o XML oficial. O sistema cadastra a nota e o fornecedor automaticamente.</p><form onsubmit="importFiscalXml(event)"><div class="fiscal-upload-box"><div class="fiscal-kpi-icon mx-auto mb-3">' + icon('upload') + '</div><h3 class="font-bold text-imec-dark mb-2">Selecionar XML da nota fiscal</h3><p class="text-sm text-slate-500 mb-4">Arquivo .xml at&eacute; 10 MB.</p><input class="input max-w-md mx-auto" type="file" id="fiscalXmlFile" accept=".xml,application/xml,text/xml" required></div><div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 text-sm text-blue-900"><b>Como funciona:</b> o leitor pega chave, n&uacute;mero, fornecedor, CNPJ, emiss&atilde;o, CFOP, produtos, valor total e ICMS. Depois voc&ecirc; confere e ajusta se precisar.</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">' + icon('robot') + ' Ler XML</button></div></form></div>');
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
      showToast('XML importado e nota cadastrada para conferencia', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
  window.openFiscalInvoiceModal = function (id) {
    var invoice = id ? invoices().find(function (x) { return String(x.id) === String(id); }) : {};
    invoice = invoice || {};
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">' + (id ? 'Editar nota fiscal' : 'Nova nota fiscal manual') + '</h2><p class="text-sm text-slate-500 mb-5">Use quando a nota n&atilde;o tiver XML dispon&iacute;vel.</p><form onsubmit="saveFiscalInvoice(event,' + (id || 'null') + ')"><div class="fiscal-form-grid">'
      + '<div><label class="label">Fornecedor</label><input class="input" id="fiSupplier" value="' + esc(invoice.supplier_name) + '"></div><div><label class="label">CNPJ</label><input class="input" id="fiCnpj" value="' + esc(invoice.supplier_cnpj) + '"></div>'
      + '<div><label class="label">N&uacute;mero</label><input class="input" id="fiNumber" value="' + esc(invoice.number) + '"></div><div><label class="label">S&eacute;rie</label><input class="input" id="fiSeries" value="' + esc(invoice.series) + '"></div>'
      + '<div><label class="label">Emiss&atilde;o</label><input type="date" class="input" id="fiIssue" value="' + esc(inputDate(invoice.issue_date)) + '"></div><div><label class="label">CFOP</label><input class="input" id="fiCfop" value="' + esc(invoice.cfop) + '"></div>'
      + '<div><label class="label">Total da nota</label><input type="number" step="0.01" class="input" id="fiTotal" value="' + esc(invoice.total_invoice || 0) + '"></div><div><label class="label">ICMS</label><input type="number" step="0.01" class="input" id="fiIcms" value="' + esc(invoice.icms_value || 0) + '"></div>'
      + '<div><label class="label">Status</label><select class="input" id="fiStatus"><option value="conferencia">Conferencia</option><option value="conferida"' + (invoice.status === 'conferida' ? ' selected' : '') + '>Conferida</option><option value="pendente"' + (invoice.status === 'pendente' ? ' selected' : '') + '>Pendente</option><option value="cancelada"' + (invoice.status === 'cancelada' ? ' selected' : '') + '>Cancelada</option></select></div><div><label class="label">Chave de acesso</label><input class="input" id="fiKey" value="' + esc(invoice.access_key) + '"></div>'
      + '<div class="fiscal-form-full"><label class="label">Observa&ccedil;&otilde;es</label><textarea class="input" id="fiNotes" rows="3">' + esc(invoice.notes) + '</textarea></div></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Salvar nota</button></div></form></div>');
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
      cfop: document.getElementById('fiCfop').value,
      total_invoice: document.getElementById('fiTotal').value,
      icms_value: document.getElementById('fiIcms').value,
      status: document.getElementById('fiStatus').value,
      access_key: document.getElementById('fiKey').value,
      notes: document.getElementById('fiNotes').value
    };
    try {
      if (id) await API.fiscal.update(id, data);
      else await API.fiscal.create(data);
      await refreshData(); closeModal(); await renderPage(); showToast('Nota fiscal salva', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };
  window.deleteFiscalInvoice = async function (id) {
    if (!confirm('Excluir esta nota fiscal?')) return;
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
      var statusFound = !status || row.innerHTML.toLowerCase().indexOf(status) >= 0;
      row.style.display = found && statusFound ? '' : 'none';
    });
  };
  window.exportFiscalCsv = function () {
    var lines = ['numero;serie;fornecedor;cnpj;emissao;cfop;total;icms;status'];
    invoices().forEach(function (i) {
      lines.push([i.number, i.series, i.supplier_name, i.supplier_cnpj, dt(i.issue_date), i.cfop, i.total_invoice, i.icms_value, i.status].map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';'));
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
