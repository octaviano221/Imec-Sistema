(function () {
  'use strict';

  function icon(name) {
    var icons = {
      car: '<path d="M19 17h2l-1.6-5.2A3 3 0 0 0 16.5 10h-9A3 3 0 0 0 4.6 11.8L3 17h2"/><path d="M5 17h14"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M6 10l1.2-3.2A2 2 0 0 1 9.1 5h5.8a2 2 0 0 1 1.9 1.8L18 10"/>',
      doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
      warning: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      paperclip: '<path d="m21.4 11.6-8.7 8.7a6 6 0 0 1-8.5-8.5l9.3-9.3a4 4 0 0 1 5.7 5.7l-9.3 9.3a2 2 0 0 1-2.8-2.8l8.7-8.7"/>'
    };
    return '<svg style="width:1.25rem;height:1.25rem;flex:0 0 1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.doc) + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char];
    });
  }

  function db() {
    return typeof getDB === 'function' ? getDB() : {};
  }

  function same(a, b) {
    return String(a) === String(b);
  }

  function fmt(value) {
    return typeof formatDate === 'function' ? formatDate(value) : (value || '--');
  }

  function days(value) {
    if (typeof daysUntil === 'function') return daysUntil(value);
    if (!value) return null;
    var todayDate = new Date();
    var date = new Date(value);
    todayDate.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date - todayDate) / 86400000);
  }

  function statusOf(value, alertDays) {
    if (typeof calcStatus === 'function') return calcStatus(value, alertDays || 30);
    var d = days(value);
    if (d == null) return 'valido';
    if (d < 0) return 'vencido';
    if (d <= (alertDays || 30)) return 'vencendo';
    return 'valido';
  }

  function chip(status, label) {
    var map = {
      vencido: ['#dc2626', '#fee2e2', 'Vencido'],
      vencendo: ['#d97706', '#fef3c7', 'Vencendo'],
      valido: ['#168844', '#dcfce7', 'V&aacute;lido']
    };
    var item = map[status] || ['#1269ff', '#eaf2ff', label || status || 'OK'];
    return '<span class="vehicle-chip" style="--tone:' + item[0] + ';--soft:' + item[1] + '">' + (label || item[2]) + '</span>';
  }

  function isVehicle(eq) {
    var text = ((eq.type || '') + ' ' + (eq.name || '')).toLowerCase();
    return !!eq.plate || /veiculo|veiculo|carro|caminh|munck|van|pickup|utilitario|utilit/.test(text);
  }

  function vehicles() {
    return (db().equipment || []).filter(isVehicle);
  }

  function vehicleDocs() {
    var vehicleIds = vehicles().map(function (item) { return String(item.id); });
    return (db().equipment_documents || []).filter(function (doc) {
      return vehicleIds.indexOf(String(doc.equipment_id)) >= 0 || /ipva|licenciamento|crlv|seguro|antt|tacografo/i.test(doc.document_type || doc.title || '');
    });
  }

  function vehicleName(id) {
    var eq = (db().equipment || []).find(function (item) { return same(item.id, id); });
    return eq ? (eq.name + (eq.plate ? ' - ' + eq.plate : '')) : 'Ve&iacute;culo';
  }

  function queueItems() {
    var alertDays = ((db().settings || {}).expiration_alert_days || 30);
    return vehicleDocs().filter(function (doc) {
      var d = days(doc.expiration_date);
      return d !== null && d !== undefined && d <= alertDays + 30;
    }).sort(function (a, b) { return days(a.expiration_date) - days(b.expiration_date); });
  }

  function documentPreviewItems() {
    var queue = queueItems();
    if (queue.length) {
      return { title: 'Fila de vencimentos', hint: 'Prioridade autom&aacute;tica por prazo.', items: queue, isQueue: true };
    }
    var docs = vehicleDocs().slice().sort(function (a, b) {
      var ad = days(a.expiration_date);
      var bd = days(b.expiration_date);
      if (ad == null && bd == null) return 0;
      if (ad == null) return 1;
      if (bd == null) return -1;
      return ad - bd;
    }).slice(0, 5);
    return { title: 'Documentos cadastrados', hint: 'Sem vencimento pr&oacute;ximo; exibindo os documentos ativos.', items: docs, isQueue: false };
  }

  function metricCard(label, value, iconName, tone) {
    return '<section class="vehicle-kpi" style="--tone:' + tone + '"><div class="vehicle-kpi-icon">' + icon(iconName) + '</div><div><span>' + label + '</span><strong>' + value + '</strong></div></section>';
  }

  function queueRow(doc, isQueue) {
    var d = days(doc.expiration_date);
    var status = statusOf(doc.expiration_date, ((db().settings || {}).expiration_alert_days || 30));
    var tone = status === 'vencido' ? '#dc2626' : status === 'vencendo' ? '#d97706' : '#168844';
    var label = d == null ? 'Sem prazo' : (d < 0 ? Math.abs(d) + ' dias vencido' : d + ' dias');
    if (!isQueue && status === 'valido') label = doc.file_url ? 'PDF anexado' : 'Cadastrado';
    return '<div class="vehicle-queue-item"><div class="vehicle-queue-icon" style="--tone:' + tone + '">' + icon(status === 'vencido' ? 'warning' : status === 'valido' ? 'shield' : 'calendar') + '</div><div><div class="vehicle-title">' + esc(doc.title || doc.document_type) + '</div><div class="vehicle-sub">' + vehicleName(doc.equipment_id) + ' &bull; validade ' + fmt(doc.expiration_date) + '</div></div>' + chip(status, label) + '</div>';
  }

  function tableRow(doc) {
    var status = statusOf(doc.expiration_date, ((db().settings || {}).expiration_alert_days || 30));
    var file = doc.file_url ? '<a class="vehicle-download" href="' + esc(doc.file_url) + '" target="_blank" download>' + icon('download') + 'Baixar PDF</a>' : '<span class="vehicle-no-file">Sem anexo</span>';
    return '<tr data-doc-type="' + esc(doc.document_type || '') + '" data-doc-status="' + status + '"><td><b>' + esc(doc.document_type || '-') + '</b><div class="vehicle-sub">' + esc(doc.title || '-') + '</div></td><td>' + vehicleName(doc.equipment_id) + '</td><td class="font-mono text-xs">' + esc(doc.document_number || '-') + '</td><td>' + fmt(doc.issue_date) + '</td><td>' + fmt(doc.expiration_date) + '</td><td>' + chip(status) + '</td><td>' + file + '</td><td><div class="flex gap-1"><button class="btn btn-outline btn-sm" onclick="openVehicleDoc(\'' + esc(doc.id) + '\')">Editar</button>' + (typeof canAdmin === 'function' && canAdmin() ? '<button class="btn btn-sm text-imec-red" onclick="deleteVehicleDoc(\'' + esc(doc.id) + '\')">Excluir</button>' : '') + '</div></td></tr>';
  }

  function vehicleOptions(selected) {
    var list = vehicles();
    if (!list.length) list = db().equipment || [];
    return list.map(function (eq) {
      return '<option value="' + esc(eq.id) + '"' + (selected && same(selected, eq.id) ? ' selected' : '') + '>' + esc(eq.name + (eq.plate ? ' - ' + eq.plate : '')) + '</option>';
    }).join('');
  }

  function renderVehicleDocuments() {
    var docs = vehicleDocs();
    var preview = documentPreviewItems();
    var activeVehicles = vehicles().filter(function (eq) { return (eq.status || 'ativo') === 'ativo'; });
    var expired = docs.filter(function (doc) { return statusOf(doc.expiration_date, ((db().settings || {}).expiration_alert_days || 30)) === 'vencido'; }).length;
    var expiring = docs.filter(function (doc) { return statusOf(doc.expiration_date, ((db().settings || {}).expiration_alert_days || 30)) === 'vencendo'; }).length;
    return '<div class="vehicle-docs fade-in"><section class="vehicle-hero"><div><p class="vehicle-kicker">Controle de frota</p><h2>Documentos de Ve&iacute;culos</h2><p>Fila premium para IPVA, licenciamento, CRLV, seguro, ANTT e documentos com vencimento.</p></div><div class="vehicle-actions"><button class="btn btn-outline" onclick="navigate(\'equipment\')">Ver equipamentos</button><button class="btn btn-primary" onclick="openVehicleDoc()">' + icon('plus') + 'Novo documento</button></div></section>'
      + '<div class="vehicle-kpis">' + metricCard('Ve&iacute;culos ativos', activeVehicles.length, 'car', '#1269ff') + metricCard('Documentos', docs.length, 'doc', '#1269ff') + metricCard('Vencendo', expiring, 'calendar', '#d97706') + metricCard('Vencidos', expired, 'warning', '#dc2626') + '</div>'
      + '<div class="vehicle-grid"><section class="vehicle-section"><div class="vehicle-section-head"><div><h2>' + preview.title + '</h2><p>' + preview.hint + '</p></div></div><div class="vehicle-queue">' + (preview.items.length ? preview.items.map(function (doc) { return queueRow(doc, preview.isQueue); }).join('') : '<div class="vehicle-empty">Nenhum documento de ve&iacute;culo cadastrado ainda.</div>') + '</div></section>'
      + '<section class="vehicle-section"><div class="vehicle-section-head"><div><h2>Controle documental</h2><p>Consulte, filtre e atualize os documentos da frota.</p></div><button class="btn btn-outline btn-sm" onclick="exportVehicleDocsCSV()">Exportar CSV</button></div><div class="vehicle-filterbar"><div class="search-box flex-1 min-w-[240px]">' + icon('search') + '<input class="input" id="vehicleDocSearch" placeholder="Buscar ve&iacute;culo, placa ou documento..." onkeyup="filterVehicleDocs()"></div><select class="input w-auto" id="vehicleDocStatus" onchange="filterVehicleDocs()"><option value="">Todos os status</option><option value="vencido">Vencidos</option><option value="vencendo">Vencendo</option><option value="valido">V&aacute;lidos</option></select></div><div class="vehicle-table-wrap"><table class="vehicle-table" id="vehicleDocsTable"><thead><tr><th>Documento</th><th>Ve&iacute;culo</th><th>N&uacute;mero</th><th>Emiss&atilde;o</th><th>Vencimento</th><th>Status</th><th>Anexo</th><th>A&ccedil;&otilde;es</th></tr></thead><tbody>' + (docs.length ? docs.map(tableRow).join('') : '<tr><td colspan="8"><div class="vehicle-empty">Cadastre o primeiro IPVA ou licenciamento.</div></td></tr>') + '</tbody></table></div></section></div></div>';
  }

  window.openVehicleDoc = function (id) {
    var doc = id ? vehicleDocs().find(function (item) { return same(item.id, id); }) : null;
    var type = doc ? doc.document_type : 'Licenciamento';
    var selectedType = function (value) { return type === value ? ' selected' : ''; };
    var currentFile = doc && doc.file_url ? '<div class="vehicle-file-current">' + icon('paperclip') + '<div><strong>PDF anexado</strong><span>O arquivo atual ser&aacute; mantido se voc&ecirc; n&atilde;o enviar outro.</span></div><a href="' + esc(doc.file_url) + '" target="_blank" download>Baixar</a></div>' : '<div class="vehicle-file-current vehicle-file-empty">' + icon('paperclip') + '<div><strong>Nenhum PDF anexado</strong><span>Anexe o IPVA, licenciamento, CRLV ou outro documento em PDF.</span></div></div>';
    var html = '<div class="p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">' + (doc ? 'Editar' : 'Novo') + ' documento de ve&iacute;culo</h2><p class="text-sm text-slate-500 mb-5">Controle IPVA, licenciamento e demais documentos da frota.</p><form onsubmit="saveVehicleDoc(event,\'' + (id || '') + '\')"><div class="grid md:grid-cols-2 gap-4">'
      + '<div><label class="label">Ve&iacute;culo *</label><select class="input" id="vehEquipment" required>' + vehicleOptions(doc && doc.equipment_id) + '</select></div>'
      + '<div><label class="label">Tipo *</label><select class="input" id="vehType" required><option' + selectedType('IPVA') + '>IPVA</option><option' + selectedType('Licenciamento') + '>Licenciamento</option><option' + selectedType('CRLV') + '>CRLV</option><option' + selectedType('Seguro') + '>Seguro</option><option' + selectedType('ANTT') + '>ANTT</option><option' + selectedType('Tac&oacute;grafo') + '>Tac&oacute;grafo</option><option' + selectedType('Outro') + '>Outro</option></select></div>'
      + '<div><label class="label">N&uacute;mero / Refer&ecirc;ncia</label><input class="input" id="vehNumber" value="' + esc(doc && doc.document_number) + '"></div>'
      + '<div><label class="label">Respons&aacute;vel</label><input class="input" id="vehResponsible" value="' + esc(doc && doc.responsible_name) + '"></div>'
      + '<div><label class="label">Data de emiss&atilde;o</label><input type="date" class="input" id="vehIssue" value="' + (typeof inputDate === 'function' ? inputDate(doc && doc.issue_date) : '') + '"></div>'
      + '<div><label class="label">Data de vencimento *</label><input type="date" class="input" id="vehExp" value="' + (typeof inputDate === 'function' ? inputDate(doc && doc.expiration_date) : '') + '" required></div>'
      + '<div class="md:col-span-2"><label class="label">PDF do documento</label>' + currentFile + '<input type="file" class="input vehicle-file-input" id="vehFile" accept="application/pdf,.pdf"><p class="vehicle-file-hint">Aceita PDF at&eacute; 10 MB. Depois de salvar, o arquivo aparecer&aacute; para baixar na tabela.</p></div>'
      + '<div class="md:col-span-2"><label class="label">Observa&ccedil;&otilde;es</label><textarea class="input" rows="3" id="vehNotes">' + esc(doc && doc.notes) + '</textarea></div>'
      + '</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" type="submit">Salvar documento</button></div></form></div>';
    if (typeof openModal === 'function') openModal(html);
  };

  window.saveVehicleDoc = async function (event, id) {
    event.preventDefault();
    var equipmentId = document.getElementById('vehEquipment').value;
    var type = document.getElementById('vehType').value;
    var exp = document.getElementById('vehExp').value;
    var existingDoc = id ? vehicleDocs().find(function (item) { return same(item.id, id); }) : null;
    var fileInput = document.getElementById('vehFile');
    var fileUrl = existingDoc && existingDoc.file_url ? existingDoc.file_url : '';
    var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (file && !(/\.pdf$/i.test(file.name) || file.type === 'application/pdf')) {
      showToast('Envie o documento em PDF.', 'error');
      return;
    }
    var data = {
      equipment_id: equipmentId,
      document_type: type,
      title: type + ' - ' + vehicleName(equipmentId),
      document_number: document.getElementById('vehNumber').value,
      issue_date: document.getElementById('vehIssue').value || null,
      expiration_date: exp,
      responsible_name: document.getElementById('vehResponsible').value,
      status: statusOf(exp, ((db().settings || {}).expiration_alert_days || 30)),
      notes: document.getElementById('vehNotes').value
    };
    try {
      if (file) {
        var fd = new FormData();
        fd.append('file', file);
        var uploaded = await API.upload(fd);
        fileUrl = uploaded.url;
      }
      data.file_url = fileUrl;
      if (id) await API.equipmentDocs.update(id, data);
      else await API.equipmentDocs.create(data);
      await refreshData();
      closeModal();
      await renderPage();
      showToast(id ? 'Documento atualizado!' : 'Documento cadastrado!', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };

  window.deleteVehicleDoc = async function (id) {
    if (!confirm('Excluir este documento de veiculo?')) return;
    try {
      await API.equipmentDocs.delete(id);
      await refreshData();
      await renderPage();
      showToast('Documento excluido!', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };

  window.filterVehicleDocs = function () {
    var q = (document.getElementById('vehicleDocSearch') || {}).value || '';
    var status = (document.getElementById('vehicleDocStatus') || {}).value || '';
    q = q.toLowerCase();
    document.querySelectorAll('#vehicleDocsTable tbody tr').forEach(function (row) {
      var okText = !q || row.textContent.toLowerCase().indexOf(q) >= 0;
      var okStatus = !status || row.getAttribute('data-doc-status') === status;
      row.style.display = okText && okStatus ? '' : 'none';
    });
  };

  window.exportVehicleDocsCSV = function () {
    var table = document.getElementById('vehicleDocsTable');
    if (!table) return;
    var csv = '';
    table.querySelectorAll('tr').forEach(function (row) {
      var cols = [];
      row.querySelectorAll('th,td').forEach(function (cell) { cols.push('"' + cell.textContent.trim().replace(/"/g, '""') + '"'); });
      csv += cols.join(';') + '\n';
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'documentos_veiculos_imec.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  function installSidebar() {
    if (document.querySelector('[data-page="vehicleDocuments"]')) return;
    var cranes = document.querySelector('[data-page="cranes"]');
    if (!cranes) return;
    var link = document.createElement('a');
    link.className = 'sidebar-link';
    link.setAttribute('data-page', 'vehicleDocuments');
    link.setAttribute('onclick', "navigate('vehicleDocuments')");
    link.innerHTML = icon('car') + 'Docs. Ve&iacute;culos';
    cranes.insertAdjacentElement('afterend', link);
  }

  function install(attempts) {
    if (typeof renderers === 'undefined') {
      if ((attempts || 0) < 80) setTimeout(function () { install((attempts || 0) + 1); }, 80);
      return;
    }
    installSidebar();
    renderers.vehicleDocuments = async function () {
      var title = document.getElementById('pageTitle');
      var subtitle = document.getElementById('pageSubtitle');
      if (title) title.textContent = 'Documentos de Ve\u00edculos';
      if (subtitle) subtitle.textContent = 'IPVA, licenciamento e fila de vencimentos';
      return renderVehicleDocuments();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { install(0); });
  } else {
    install(0);
  }
})();
