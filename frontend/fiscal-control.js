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
      chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>'
    };
    return icons[name] || icons.fiscal;
  }
  function statusChip(status) {
    var label = { conferida: 'Conferida', conferencia: 'Confer&ecirc;ncia', pendente: 'Pendente', divergente: 'Divergente', cancelada: 'Cancelada' }[status] || (status || 'Confer&ecirc;ncia');
    var cls = status === 'conferida' ? 'ok' : ((status === 'cancelada' || status === 'divergente') ? 'danger' : (status === 'pendente' ? 'warn' : 'info'));
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
  function warehouseOrders() {
    return (((db().warehouse || {}).orders) || []).slice();
  }
  function purchaseOrderOptions(selected) {
    return '<option value="">Sem pedido vinculado</option>' + warehouseOrders().map(function (order) {
      var label = (order.order_number || ('Pedido #' + order.id)) + ' - ' + (order.supplier_name || 'Fornecedor') + ' - ' + money(order.total_amount || 0);
      return '<option value="' + esc(order.id) + '"' + (String(selected || '') === String(order.id) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }
  function fiscalInsights(list, metrics) {
    var xml = metrics.with_xml != null ? metrics.with_xml : list.filter(function (i) { return i.xml_url; }).length;
    var unlinked = metrics.unlinked_orders != null ? metrics.unlinked_orders : list.filter(function (i) { return !i.purchase_order_id; }).length;
    var divergent = metrics.divergent != null ? metrics.divergent : list.filter(function (i) { return i.status === 'divergente'; }).length;
    var conferenceTotal = metrics.conference_total != null ? metrics.conference_total : list.filter(function (i) { return ['conferencia', 'pendente', 'divergente'].indexOf(i.status) >= 0; }).reduce(function (sum, i) { return sum + Number(i.total_invoice || 0); }, 0);
    return '<section class="fiscal-insights">'
      + '<div class="fiscal-mini-card"><span>XML recebidos</span><strong>' + xml + '</strong><small>notas com arquivo fiscal</small></div>'
      + '<div class="fiscal-mini-card"><span>Sem pedido</span><strong>' + unlinked + '</strong><small>vincular ao almoxarifado</small></div>'
      + '<div class="fiscal-mini-card"><span>Diverg&ecirc;ncias</span><strong>' + divergent + '</strong><small>valores ou cadastro para rever</small></div>'
      + '<div class="fiscal-mini-card accent"><span>Em confer&ecirc;ncia</span><strong>' + money(conferenceTotal) + '</strong><small>fila do contador/compras</small></div>'
      + '</section>';
  }
  function renderInvoiceRows(list) {
    if (!list.length) return '<tr><td colspan="9"><div class="fiscal-empty">Importe o primeiro XML de NF-e ou cadastre uma nota manual.</div></td></tr>';
    return list.map(function (invoice) {
      var supplier = invoice.linked_supplier_name || invoice.supplier_name || '-';
      var danfe = '<button class="fiscal-icon-btn" onclick="downloadFiscalDanfe(' + invoice.id + ')" title="Baixar DANFE em PDF">' + icon('download') + '</button>';
      var xml = invoice.xml_url ? '<button class="fiscal-icon-btn" onclick="downloadFiscalXml(' + invoice.id + ')" title="Baixar NF-e XML">' + icon('download') + '</button>' : '';
      return '<tr data-fiscal-row data-status="' + esc(invoice.status || 'conferencia') + '" data-search="' + esc([supplier, invoice.supplier_cnpj, invoice.number, invoice.access_key, invoice.cfop, invoice.purchase_order_number].join(' ').toLowerCase()) + '">'
        + '<td class="fiscal-main-cell"><strong>NF-e ' + esc(invoice.number || '-') + '</strong><small>S&eacute;rie ' + esc(invoice.series || '-') + ' &bull; Modelo ' + esc(invoice.model || '55') + '</small></td>'
        + '<td class="fiscal-main-cell"><strong>' + esc(supplier) + '</strong><small>' + esc(invoice.supplier_cnpj || '') + '</small></td>'
        + '<td>' + (invoice.purchase_order_number ? '<span class="fiscal-order-pill">' + esc(invoice.purchase_order_number) + '</span>' : '<span class="fiscal-muted">Sem v&iacute;nculo</span>') + '</td>'
        + '<td>' + dt(invoice.issue_date) + '</td>'
        + '<td>' + esc(invoice.cfop || '-') + '</td>'
        + '<td><strong>' + money(invoice.total_invoice) + '</strong></td>'
        + '<td>' + money(invoice.icms_value) + '</td>'
        + '<td>' + statusChip(invoice.status) + '</td>'
        + '<td><div class="flex gap-2"><button class="fiscal-icon-btn" onclick="openFiscalInvoiceDetails(' + invoice.id + ')" title="Ver detalhes">' + icon('eye') + '</button>' + danfe + xml + '<button class="fiscal-icon-btn" onclick="editFiscalInvoice(' + invoice.id + ')" title="Editar">' + icon('edit') + '</button><button class="fiscal-icon-btn" onclick="deleteFiscalInvoice(' + invoice.id + ')" title="Excluir">' + icon('trash') + '</button></div></td>'
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
      + fiscalInsights(list, metrics)
      + '<section class="fiscal-grid"><div class="fiscal-panel"><div class="fiscal-panel-head"><div><h3 class="text-xl">Controle de notas fiscais</h3><p class="text-sm text-slate-500">Consulte por fornecedor, CNPJ, CFOP, n&uacute;mero, pedido ou chave da nota.</p></div><button class="btn btn-outline btn-sm" onclick="exportFiscalCsv()">CSV contador</button></div><div class="fiscal-panel-body fiscal-filters"><input class="input" id="fiscalSearch" oninput="filterFiscalInvoices()" placeholder="Buscar nota, fornecedor, CNPJ, pedido ou CFOP..."><select class="input" id="fiscalStatus" onchange="filterFiscalInvoices()"><option value="">Todos os status</option><option value="conferencia">Confer&ecirc;ncia</option><option value="conferida">Conferida</option><option value="pendente">Pendente</option><option value="divergente">Divergente</option><option value="cancelada">Cancelada</option></select></div><div class="fiscal-table-wrap"><table class="fiscal-table"><thead><tr><th>Nota</th><th>Fornecedor</th><th>Pedido</th><th>Emiss&atilde;o</th><th>CFOP</th><th>Total</th><th>ICMS</th><th>Status</th><th>A&ccedil;&otilde;es</th></tr></thead><tbody>' + renderInvoiceRows(list) + '</tbody></table></div></div>'
      + '<aside class="fiscal-panel"><div class="fiscal-panel-head"><div><h3>SEFAZ, SPED e CFOP</h3><p class="text-sm text-slate-500">Leitura executiva para confer&ecirc;ncia fiscal.</p></div><button class="btn btn-primary btn-sm" onclick="openSefazModal()">' + icon('robot') + ' SEFAZ / A1</button></div><div class="fiscal-panel-body"><div class="fiscal-upload-box mb-4">' + icon('robot') + '<h4 class="font-bold mt-3 text-imec-dark">Rob&ocirc; fiscal por CNPJ</h4><p class="text-sm text-slate-500 mt-1">Com o certificado A1 configurado, o sistema fica pronto para buscar notas emitidas contra o CNPJ da empresa.</p></div><div class="fiscal-cfop-list">' + (cfops.length ? cfops.map(function (row) { return '<div class="fiscal-cfop-row"><div><b>CFOP ' + esc(row.cfop) + '</b><p class="text-xs text-slate-500">' + row.count + ' nota(s)</p></div><strong>' + money(row.total) + '</strong></div>'; }).join('') : '<div class="fiscal-empty">Nenhum CFOP importado ainda.</div>') + '</div></div></aside></section>'
      + '</div>';
  }
  function fiscalKpi(iconName, label, value, note) {
    return '<div class="fiscal-kpi"><div class="fiscal-kpi-icon">' + icon(iconName) + '</div><div><span>' + label + '</span><strong>' + value + '</strong><p class="text-xs text-slate-500 mt-2">' + note + '</p></div></div>';
  }
  window.openFiscalXmlModal = function () {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Importar XML da NF-e</h2><p class="text-sm text-slate-500 mb-5">Envie o XML oficial. O sistema cadastra a nota e o fornecedor automaticamente.</p><form onsubmit="importFiscalXml(event)"><div class="fiscal-upload-box"><div class="fiscal-kpi-icon mx-auto mb-3">' + icon('upload') + '</div><h3 class="font-bold text-imec-dark mb-2">Selecionar XML da nota fiscal</h3><p class="text-sm text-slate-500 mb-4">Arquivo .xml at&eacute; 10 MB.</p><input class="input max-w-md mx-auto" type="file" id="fiscalXmlFile" accept=".xml,application/xml,text/xml" required></div><div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 text-sm text-blue-900"><b>Como funciona:</b> o leitor pega chave, n&uacute;mero, fornecedor, CNPJ, emiss&atilde;o, CFOP, produtos, valor total e ICMS. Depois voc&ecirc; confere e ajusta se precisar.</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">' + icon('robot') + ' Ler XML</button></div></form></div>');
  };
  window.openSefazModal = async function () {
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Rob&ocirc; SEFAZ por CNPJ</h2><p class="text-sm text-slate-500 mb-5">Consultando configura&ccedil;&atilde;o segura do certificado A1...</p><div class="fiscal-upload-box">' + icon('robot') + '<h3 class="font-bold text-imec-dark mt-3">Verificando ambiente</h3></div></div>');
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
        ? '<div class="fiscal-sefaz-ready">Certificado A1 localizado. Pronto para consultar a distribui&ccedil;&atilde;o de NF-e na SEFAZ.</div>'
        : '<div class="fiscal-sefaz-warn">Ainda falta: ' + esc(missing.join(', ') || 'configura&ccedil;&atilde;o') + '.</div>';
      openModal('<div class="p-6 fiscal-modal-wide"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">Rob&ocirc; SEFAZ por CNPJ</h2><p class="text-sm text-slate-500 mt-1">Busca NF-e emitida contra o CNPJ usando certificado A1.</p></div><span class="fiscal-chip ' + (status.ready ? 'ok' : 'warn') + '">' + (status.ready ? 'A1 pronto' : 'Configurar A1') + '</span></div><div class="fiscal-sefaz-grid"><section><h3>Vari&aacute;veis na Hostinger</h3><ul class="fiscal-sefaz-list">' + checklist + '</ul></section><section><h3>Dados detectados</h3><div class="fiscal-cfop-list"><div class="fiscal-cfop-row"><span>CNPJ</span><b>' + esc(status.cnpj || '-') + '</b></div><div class="fiscal-cfop-row"><span>UF</span><b>' + esc(status.uf || '-') + '</b></div><div class="fiscal-cfop-row"><span>Ambiente</span><b>' + esc(status.environment || '-') + '</b></div><div class="fiscal-cfop-row"><span>&Uacute;ltimo NSU</span><b>' + esc(status.ultNSU || '000000000000000') + '</b></div></div></section></div>' + readyBox + '<div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 text-sm text-blue-900"><b>Caminho configurado:</b> <code>' + esc(status.cert_path || '-') + '</code><br><b>Caminho encontrado:</b> <code>' + esc(status.cert_resolved_path || 'nao encontrado') + '</code><br><span class="text-xs">Se a pasta foi criada no Gerenciador de Arquivos do site, o caminho pode ser <code>/home/u974096246/domains/darkslateblue-seahorse-560479.hostingersite.com/certificados/IMECBASE.pfx</code>. O sistema agora procura esse local tamb&eacute;m.</span></div><div id="sefazSyncResult" class="mt-4"></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Fechar</button><button type="button" class="btn btn-primary" onclick="startSefazSync()">' + icon('robot') + ' Consultar SEFAZ</button></div></div>');
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
      var msg = (result.xMotivo || 'Consulta concluida') + ' | novas: ' + (result.imported || 0) + ' | atualizadas: ' + (result.updated || 0) + ' | ignoradas: ' + (result.ignored || 0);
      if (box) box.innerHTML = '<div class="fiscal-sefaz-ready"><b>Consulta conclu&iacute;da.</b><br>' + esc(msg) + '<br><span class="text-xs">NSU atual: ' + esc(result.ultNSU || '-') + '</span></div>';
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
      showToast('XML importado e nota cadastrada para conferencia', 'success');
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
    openModal('<div class="p-6 fiscal-modal-wide"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Abrindo nota fiscal...</h2><div class="fiscal-upload-box">' + icon('fiscal') + '<p class="text-sm text-slate-500 mt-3">Carregando itens, impostos e v&iacute;nculos.</p></div></div>');
    try {
      var result = await API.fiscal.detail(id);
      var invoice = result.invoice || {};
      var items = result.items || [];
      var supplier = invoice.linked_supplier_name || invoice.supplier_name || '-';
      var itemRows = items.length ? items.map(function (item) {
        return '<tr><td>' + esc(item.item_number || '-') + '</td><td class="fiscal-main-cell"><strong>' + esc(item.description || '-') + '</strong><small>' + esc(item.product_code || '') + '</small></td><td>' + esc(item.ncm || '-') + '</td><td>' + esc(item.cfop || '-') + '</td><td>' + esc(item.quantity || '-') + ' ' + esc(item.unit || '') + '</td><td>' + money(item.total_value) + '</td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="fiscal-empty fiscal-empty-small">Esta nota veio como resumo da SEFAZ ou ainda n&atilde;o possui XML completo com itens.</div></td></tr>';
      openModal('<div class="p-6 fiscal-modal-wide fiscal-detail-modal"><div class="fiscal-panel-head px-0 pt-0"><div><h2 class="font-display text-xl font-bold text-imec-dark">NF-e ' + esc(invoice.number || invoice.id) + '</h2><p class="text-sm text-slate-500 mt-1">' + esc(supplier) + ' &bull; emiss&atilde;o ' + dt(invoice.issue_date) + '</p></div>' + statusChip(invoice.status) + '</div>'
        + '<div class="fiscal-action-strip"><button class="btn btn-primary btn-sm" onclick="downloadFiscalDanfe(' + invoice.id + ')">' + icon('download') + ' DANFE PDF</button>' + (invoice.xml_url ? '<button class="btn btn-outline btn-sm" onclick="downloadFiscalXml(' + invoice.id + ')">' + icon('download') + ' NF-e XML</button>' : '') + '<button class="btn btn-outline btn-sm" onclick="editFiscalInvoice(' + invoice.id + ')">' + icon('edit') + ' Editar</button></div>'
        + '<section class="fiscal-detail-grid"><div class="fiscal-detail-box"><span>Fornecedor</span><strong>' + esc(supplier) + '</strong><small>' + esc(invoice.supplier_cnpj || '-') + '</small></div><div class="fiscal-detail-box"><span>Pedido de compra</span><strong>' + (invoice.purchase_order_number ? esc(invoice.purchase_order_number) : 'Sem v&iacute;nculo') + '</strong><small>almoxarifado</small></div><div class="fiscal-detail-box"><span>Total NF-e</span><strong>' + money(invoice.total_invoice) + '</strong><small>produtos ' + money(invoice.total_products) + '</small></div><div class="fiscal-detail-box"><span>ICMS</span><strong>' + money(invoice.icms_value) + '</strong><small>base ' + money(invoice.icms_base) + '</small></div></section>'
        + '<section class="fiscal-detail-box mt-4"><span>Chave de acesso</span><strong class="fiscal-key">' + esc(invoice.access_key || '-') + '</strong><small>CFOP: ' + esc(invoice.cfop || '-') + ' &bull; Natureza: ' + esc(invoice.operation_type || '-') + '</small></section>'
        + '<div class="fiscal-table-wrap mt-4"><table class="fiscal-table fiscal-items-table"><thead><tr><th>Item</th><th>Produto</th><th>NCM</th><th>CFOP</th><th>Qtd.</th><th>Total</th></tr></thead><tbody>' + itemRows + '</tbody></table></div>'
        + '<section class="fiscal-detail-box mt-4"><span>Observa&ccedil;&otilde;es</span><p>' + (invoice.notes ? esc(invoice.notes) : 'Sem observa&ccedil;&otilde;es.') + '</p></section>'
        + '<div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>');
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
      + '<div><label class="label">Emiss&atilde;o</label><input type="date" class="input" id="fiIssue" value="' + esc(inputDate(invoice.issue_date)) + '"></div><div><label class="label">Entrada</label><input type="date" class="input" id="fiEntry" value="' + esc(inputDate(invoice.entry_date)) + '"></div>'
      + '<div><label class="label">Natureza da opera&ccedil;&atilde;o</label><input class="input" id="fiOperation" value="' + esc(invoice.operation_type) + '"></div><div><label class="label">CFOP</label><input class="input" id="fiCfop" value="' + esc(invoice.cfop) + '"></div>'
      + '<div><label class="label">Pedido de compra</label><select class="input" id="fiPurchaseOrder">' + purchaseOrderOptions(invoice.purchase_order_id) + '</select></div><div><label class="label">Status</label><select class="input" id="fiStatus"><option value="conferencia"' + ((invoice.status || 'conferencia') === 'conferencia' ? ' selected' : '') + '>Conferencia</option><option value="conferida"' + (invoice.status === 'conferida' ? ' selected' : '') + '>Conferida</option><option value="pendente"' + (invoice.status === 'pendente' ? ' selected' : '') + '>Pendente</option><option value="divergente"' + (invoice.status === 'divergente' ? ' selected' : '') + '>Divergente</option><option value="cancelada"' + (invoice.status === 'cancelada' ? ' selected' : '') + '>Cancelada</option></select></div>'
      + '<div><label class="label">Total produtos</label><input type="number" step="0.01" class="input" id="fiProducts" value="' + esc(invoice.total_products || 0) + '"></div><div><label class="label">Total da nota</label><input type="number" step="0.01" class="input" id="fiTotal" value="' + esc(invoice.total_invoice || 0) + '"></div>'
      + '<div><label class="label">Frete</label><input type="number" step="0.01" class="input" id="fiFreight" value="' + esc(invoice.freight_value || 0) + '"></div><div><label class="label">Desconto</label><input type="number" step="0.01" class="input" id="fiDiscount" value="' + esc(invoice.discount_value || 0) + '"></div>'
      + '<div><label class="label">Base ICMS</label><input type="number" step="0.01" class="input" id="fiIcmsBase" value="' + esc(invoice.icms_base || 0) + '"></div><div><label class="label">ICMS</label><input type="number" step="0.01" class="input" id="fiIcms" value="' + esc(invoice.icms_value || 0) + '"></div>'
      + '<div><label class="label">IPI</label><input type="number" step="0.01" class="input" id="fiIpi" value="' + esc(invoice.ipi_value || 0) + '"></div><div><label class="label">PIS</label><input type="number" step="0.01" class="input" id="fiPis" value="' + esc(invoice.pis_value || 0) + '"></div>'
      + '<div><label class="label">COFINS</label><input type="number" step="0.01" class="input" id="fiCofins" value="' + esc(invoice.cofins_value || 0) + '"></div>'
      + '<div><label class="label">Destinat&aacute;rio</label><input class="input" id="fiClientName" value="' + esc(invoice.client_name) + '"></div><div><label class="label">CNPJ destinat&aacute;rio</label><input class="input" id="fiClientCnpj" value="' + esc(invoice.client_cnpj) + '"></div>'
      + '<div class="fiscal-form-full"><label class="label">Chave de acesso</label><input class="input" id="fiKey" value="' + esc(invoice.access_key) + '"></div>'
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
