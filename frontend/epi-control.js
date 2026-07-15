(function () {
  'use strict';

  var epiTab = 'fichas';
  var catalogCache = [];
  var signaturePads = {};

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function token() {
    return localStorage.getItem('imec_token') || '';
  }

  async function api(path, options) {
    var res = await fetch('/api' + path, Object.assign({
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token()
      }
    }, options || {}));
    if (!res.ok) throw new Error((await res.text()) || 'Erro na requisicao');
    return res.json();
  }

  function fmtDate(value) {
    if (!value) return '-';
    var d = new Date(value);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function db() {
    return typeof getDB === 'function' ? getDB() : {};
  }

  function canWrite() {
    return typeof canEdit !== 'function' || canEdit();
  }

  function recordsFor(employeeId) {
    return (db().epi_records || []).filter(function (item) { return String(item.employee_id) === String(employeeId); });
  }

  function openRecords(records) {
    return records.filter(function (item) { return !item.return_date && !['devolvido', 'substituido', 'extraviado', 'danificado'].includes(String(item.status || '').toLowerCase()); });
  }

  async function loadCatalog() {
    try {
      catalogCache = await api('/epi/catalog');
    } catch (err) {
      catalogCache = [];
    }
    return catalogCache;
  }

  function kpis() {
    var data = db();
    var records = data.epi_records || [];
    var employees = data.employees || [];
    var open = openRecords(records).length;
    var low = catalogCache.filter(function (item) { return Number(item.current_stock || 0) <= Number(item.minimum_stock || 0); }).length;
    var noFicha = employees.filter(function (emp) { return recordsFor(emp.id).length === 0; }).length;
    return '<div class="epi-kpis">'
      + '<div class="epi-kpi"><span>Funcionarios com ficha</span><b>' + (employees.length - noFicha) + '</b></div>'
      + '<div class="epi-kpi"><span>Entregas registradas</span><b>' + records.length + '</b></div>'
      + '<div class="epi-kpi"><span>EPIs sem devolucao</span><b>' + open + '</b></div>'
      + '<div class="epi-kpi"><span>Estoque baixo</span><b>' + low + '</b></div>'
      + '</div>';
  }

  function shell(content) {
    return '<div class="epi-suite">'
      + '<section class="epi-hero"><div><p class="text-xs font-black uppercase tracking-widest text-blue-500">Controle Individual de Entrega de EPI</p><h3 class="font-display text-2xl font-black text-imec-dark">Ficha Individual de EPI</h3><p class="text-sm text-slate-500">Funcionario, ficha individual, entregas, devolucao, assinatura e impressao A4.</p></div>'
      + '<div class="epi-actions">' + (canWrite() ? '<button class="btn btn-primary btn-sm" onclick="openEpiDelivery()">Nova entrega</button><button class="btn btn-outline btn-sm" onclick="openEpiCatalog()">Cadastrar EPI</button>' : '') + '</div></section>'
      + kpis()
      + '<div class="epi-tabs"><button class="epi-tab ' + (epiTab === 'fichas' ? 'active' : '') + '" onclick="setEpiTab(\'fichas\')">Fichas por funcionario</button><button class="epi-tab ' + (epiTab === 'entregas' ? 'active' : '') + '" onclick="setEpiTab(\'entregas\')">Entregas e devolucoes</button><button class="epi-tab ' + (epiTab === 'catalogo' ? 'active' : '') + '" onclick="setEpiTab(\'catalogo\')">Cadastro de EPIs</button><button class="epi-tab ' + (epiTab === 'alertas' ? 'active' : '') + '" onclick="setEpiTab(\'alertas\')">Alertas</button></div>'
      + content
      + '</div>';
  }

  function renderFichas() {
    var employees = db().employees || [];
    var rows = employees.map(function (emp) {
      var records = recordsFor(emp.id);
      var open = openRecords(records);
      var last = records.slice().sort(function (a, b) { return new Date(b.delivery_date) - new Date(a.delivery_date); })[0];
      return '<tr><td><div class="font-bold text-slate-900">' + esc(emp.full_name) + '</div><div class="text-xs text-slate-500">' + esc(emp.cpf || '') + '</div></td>'
        + '<td>' + esc(emp.role_position || '-') + '</td><td>' + esc(emp.department || '-') + '</td><td>' + (records.length ? '<span class="badge badge-green">Com ficha</span>' : '<span class="badge badge-orange">Sem ficha</span>') + '</td>'
        + '<td>' + records.length + '</td><td>' + open.length + '</td><td>' + fmtDate(last && last.delivery_date) + '</td>'
        + '<td><div class="flex flex-wrap gap-1"><button class="btn btn-outline btn-sm" onclick="openEpiFicha(\'' + esc(emp.id) + '\')">Ver ficha</button>' + (canWrite() ? '<button class="btn btn-primary btn-sm" onclick="openEpiDelivery(\'' + esc(emp.id) + '\')">Entregar EPI</button>' : '') + '</div></td></tr>';
    }).join('');
    return '<div class="table-container"><table><thead><tr><th>Funcionario</th><th>Funcao</th><th>Setor/Obra</th><th>Status da ficha</th><th>Entregas</th><th>Pendentes</th><th>Ultima entrega</th><th>Acoes</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8">Nenhum funcionario cadastrado.</td></tr>') + '</tbody></table></div>';
  }

  function renderEntregas() {
    var rows = (db().epi_records || []).map(function (item) {
      return '<tr><td>' + esc(item.employee_name || '-') + '</td><td>' + esc(item.epi_name || item.catalog_name || '-') + '</td><td>' + esc(item.ca_number || '-') + '</td><td>' + esc(item.quantity || 1) + '</td><td>' + fmtDate(item.delivery_date) + '</td><td>' + fmtDate(item.return_date) + '</td><td>' + esc(item.status || 'entregue') + '</td><td><div class="flex flex-wrap gap-1">' + (canWrite() ? '<button class="btn btn-outline btn-sm" onclick="openEpiReturn(\'' + esc(item.id) + '\')">Devolucao/Substituicao</button>' : '') + '</div></td></tr>';
    }).join('');
    return '<div class="table-container"><table><thead><tr><th>Funcionario</th><th>EPI</th><th>C.A.</th><th>Qtd</th><th>Entrega</th><th>Devolucao</th><th>Status</th><th>Acoes</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8">Nenhuma entrega registrada.</td></tr>') + '</tbody></table></div>';
  }

  function renderCatalogo() {
    var rows = catalogCache.map(function (item) {
      var low = Number(item.current_stock || 0) <= Number(item.minimum_stock || 0);
      return '<tr><td><b>' + esc(item.name) + '</b><div class="text-xs text-slate-500">' + esc(item.type || '-') + '</div></td><td>' + esc(item.ca_number || '-') + '</td><td>' + esc(item.manufacturer || '-') + '</td><td>' + fmtDate(item.ca_validity) + '</td><td>' + fmtDate(item.equipment_validity) + '</td><td>' + (low ? '<span class="badge badge-orange">' + esc(item.current_stock || 0) + '</span>' : esc(item.current_stock || 0)) + '</td><td>' + esc(item.minimum_stock || 0) + '</td><td>' + esc(item.status || 'ativo') + '</td><td>' + (canWrite() ? '<button class="btn btn-outline btn-sm" onclick="openEpiCatalog(\'' + esc(item.id) + '\')">Editar</button>' : '') + '</td></tr>';
    }).join('');
    return '<div class="table-container"><table><thead><tr><th>EPI</th><th>C.A.</th><th>Fabricante</th><th>Val. C.A.</th><th>Val. Equip.</th><th>Estoque</th><th>Minimo</th><th>Status</th><th>Acoes</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9">Nenhum EPI cadastrado.</td></tr>') + '</tbody></table></div>';
  }

  function renderAlertas() {
    var now = new Date();
    var soon = new Date(now.getTime() + 30 * 86400000);
    var alerts = [];
    catalogCache.forEach(function (item) {
      if (Number(item.current_stock || 0) <= Number(item.minimum_stock || 0)) alerts.push(['Estoque baixo', item.name, 'Estoque atual: ' + (item.current_stock || 0)]);
      if (item.ca_validity && new Date(item.ca_validity) <= soon) alerts.push(['C.A. vencido ou vencendo', item.name, fmtDate(item.ca_validity)]);
      if (item.equipment_validity && new Date(item.equipment_validity) <= soon) alerts.push(['Equipamento vencido ou vencendo', item.name, fmtDate(item.equipment_validity)]);
    });
    (db().employees || []).forEach(function (emp) {
      if (!recordsFor(emp.id).length) alerts.push(['Funcionario sem ficha de EPI', emp.full_name, emp.department || '-']);
    });
    openRecords(db().epi_records || []).forEach(function (item) {
      alerts.push(['EPI entregue sem devolucao', item.employee_name || '-', item.epi_name || '-']);
    });
    var rows = alerts.map(function (row) { return '<tr><td><span class="badge badge-orange">' + esc(row[0]) + '</span></td><td>' + esc(row[1]) + '</td><td>' + esc(row[2]) + '</td></tr>'; }).join('');
    return '<div class="table-container"><table><thead><tr><th>Alerta</th><th>Registro</th><th>Detalhe</th></tr></thead><tbody>' + (rows || '<tr><td colspan="3">Nenhum alerta pendente.</td></tr>') + '</tbody></table></div>';
  }

  async function renderEpiSuite() {
    await loadCatalog();
    if (epiTab === 'catalogo') return shell(renderCatalogo());
    if (epiTab === 'entregas') return shell(renderEntregas());
    if (epiTab === 'alertas') return shell(renderAlertas());
    return shell(renderFichas());
  }

  window.setEpiTab = async function (tab) {
    epiTab = tab;
    if (typeof renderPage === 'function') await renderPage();
  };

  window.openEpiCatalog = function (id) {
    var item = id ? catalogCache.find(function (x) { return String(x.id) === String(id); }) : {};
    openModal('<div class="p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-5">' + (id ? 'Editar' : 'Cadastrar') + ' EPI</h2><form onsubmit="saveEpiCatalog(event,\'' + (id || '') + '\')"><div class="grid md:grid-cols-2 gap-4">'
      + field('Nome do EPI *', 'catName', item.name || '', 'text', true)
      + field('Tipo/categoria', 'catType', item.type || '', 'text')
      + field('C.A.', 'catCA', item.ca_number || '', 'text')
      + field('Fabricante', 'catManufacturer', item.manufacturer || '', 'text')
      + field('Validade do C.A.', 'catCAValidity', inputDate(item.ca_validity), 'date')
      + field('Validade do equipamento', 'catEquipValidity', inputDate(item.equipment_validity), 'date')
      + field('Estoque atual', 'catStock', item.current_stock || 0, 'number')
      + field('Estoque minimo', 'catMinStock', item.minimum_stock || 0, 'number')
      + '<div class="md:col-span-2"><label class="label">Observacoes</label><textarea class="input" id="catNotes" rows="3">' + esc(item.notes || '') + '</textarea></div>'
      + '</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Salvar</button></div></form></div>');
  };

  window.saveEpiCatalog = async function (event, id) {
    event.preventDefault();
    var data = {
      name: val('catName'), type: val('catType'), ca_number: val('catCA'), manufacturer: val('catManufacturer'),
      ca_validity: val('catCAValidity') || null, equipment_validity: val('catEquipValidity') || null,
      current_stock: Number(val('catStock') || 0), minimum_stock: Number(val('catMinStock') || 0), notes: val('catNotes'), status: 'ativo'
    };
    try {
      if (id) await api('/epi/catalog/' + id, { method: 'PUT', body: JSON.stringify(data) });
      else await api('/epi/catalog', { method: 'POST', body: JSON.stringify(data) });
      closeModal(); await loadCatalog(); if (typeof renderPage === 'function') await renderPage(); showToast('EPI salvo no catalogo', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };

  window.openEpiDelivery = async function (employeeId) {
    if (!catalogCache.length) await loadCatalog();
    var employees = db().employees || [];
    var eOptions = employees.map(function (e) { return '<option value="' + esc(e.id) + '"' + (String(e.id) === String(employeeId || '') ? ' selected' : '') + '>' + esc(e.full_name) + '</option>'; }).join('');
    var cOptions = catalogCache.map(function (item) { return '<option value="' + esc(item.id) + '" data-ca="' + esc(item.ca_number || '') + '">' + esc(item.name) + (item.ca_number ? ' - CA ' + esc(item.ca_number) : '') + '</option>'; }).join('');
    openModal('<div class="p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-5">Registrar entrega de EPI</h2><form onsubmit="saveEpiDelivery(event)"><div class="grid md:grid-cols-2 gap-4">'
      + '<div><label class="label">Funcionario *</label><select class="input" id="epiEmp" required>' + eOptions + '</select></div>'
      + '<div><label class="label">EPI *</label><select class="input" id="epiCatalog" required onchange="fillEpiCA()">' + cOptions + '</select></div>'
      + field('Quantidade', 'epiQty', '1', 'number', true)
      + field('C.A.', 'epiCA', '', 'text')
      + field('Data de entrega', 'epiDelivery', today(), 'date', true)
      + field('Responsavel pela entrega', 'epiResponsible', '', 'text')
      + '<div class="md:col-span-2"><label class="label">Assinatura digital do funcionario</label><canvas id="epiDeliverySign" class="epi-signature-pad"></canvas><div class="mt-2 flex gap-2"><button type="button" class="btn btn-outline btn-sm" onclick="clearSignature(\'epiDeliverySign\')">Limpar assinatura</button></div></div>'
      + '<div class="md:col-span-2"><label class="label">Observacoes</label><textarea class="input" id="epiNotes" rows="2"></textarea></div>'
      + '</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Salvar entrega</button></div></form></div>');
    fillEpiCA();
    setTimeout(function () { setupSignature('epiDeliverySign'); }, 80);
  };

  window.saveEpiDelivery = async function (event) {
    event.preventDefault();
    var opt = document.getElementById('epiCatalog').selectedOptions[0];
    var data = {
      employee_id: val('epiEmp'),
      epi_catalog_id: val('epiCatalog'),
      epi_name: opt ? opt.textContent.replace(/\s-\sCA\s.*$/, '') : '',
      ca_number: val('epiCA'),
      quantity: Number(val('epiQty') || 1),
      delivery_date: val('epiDelivery'),
      responsible_name: val('epiResponsible'),
      delivery_signature: getSignature('epiDeliverySign'),
      delivery_signature_method: getSignature('epiDeliverySign') ? 'digital' : 'manual',
      notes: val('epiNotes')
    };
    try {
      await api('/epi', { method: 'POST', body: JSON.stringify(data) });
      await refreshData(); closeModal(); if (typeof renderPage === 'function') await renderPage(); showToast('Entrega de EPI registrada', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };

  window.openEpiReturn = function (id) {
    var item = (db().epi_records || []).find(function (x) { return String(x.id) === String(id); });
    if (!item) return;
    openModal('<div class="p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Registrar devolucao/substituicao</h2><p class="text-sm text-slate-500 mb-5">' + esc(item.epi_name) + ' - ' + esc(item.employee_name || '') + '</p><form onsubmit="saveEpiReturn(event,\'' + esc(id) + '\')"><div class="grid md:grid-cols-2 gap-4">'
      + field('Data', 'epiReturnDate', today(), 'date', true)
      + '<div><label class="label">Condicao</label><select class="input" id="epiReturnCondition"><option>Bom</option><option>Danificado</option><option>Extraviado</option><option>Substituido</option></select></div>'
      + '<div class="md:col-span-2"><label class="label">Assinatura/rubrica</label><canvas id="epiReturnSign" class="epi-signature-pad"></canvas><div class="mt-2"><button type="button" class="btn btn-outline btn-sm" onclick="clearSignature(\'epiReturnSign\')">Limpar assinatura</button></div></div>'
      + '<div class="md:col-span-2"><label class="label">Observacoes</label><textarea class="input" id="epiReturnNotes" rows="2"></textarea></div>'
      + '</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Salvar</button></div></form></div>');
    setTimeout(function () { setupSignature('epiReturnSign'); }, 80);
  };

  window.saveEpiReturn = async function (event, id) {
    event.preventDefault();
    var data = {
      return_date: val('epiReturnDate'),
      return_condition: val('epiReturnCondition'),
      return_signature: getSignature('epiReturnSign'),
      return_signature_method: getSignature('epiReturnSign') ? 'digital' : 'manual',
      return_notes: val('epiReturnNotes')
    };
    try {
      await api('/epi/' + id + '/return', { method: 'PUT', body: JSON.stringify(data) });
      await refreshData(); closeModal(); if (typeof renderPage === 'function') await renderPage(); showToast('Devolucao registrada', 'success');
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
  };

  window.openEpiFicha = function (employeeId) {
    var emp = (db().employees || []).find(function (e) { return String(e.id) === String(employeeId); });
    if (!emp) return;
    var records = recordsFor(employeeId).sort(function (a, b) { return new Date(a.delivery_date) - new Date(b.delivery_date); });
    var sheet = buildFicha(emp, records);
    openModal('<div class="p-4"><div class="epi-no-print flex flex-wrap justify-end gap-2 mb-4"><button class="btn btn-outline btn-sm" onclick="openEpiDelivery(\'' + esc(employeeId) + '\')">Nova entrega</button><button class="btn btn-primary btn-sm" onclick="printEpiFicha()">Imprimir / PDF</button><button class="btn btn-outline btn-sm" onclick="closeModal()">Fechar</button></div>' + sheet + '</div>');
  };

  window.printEpiFicha = function () {
    window.print();
  };

  function buildFicha(emp, records) {
    var settings = db().settings || {};
    var company = settings.company_name || 'IMEC Servicos de Manutencao Industrial Ltda.';
    var cnpj = settings.cnpj || '34.928.868/0001-78';
    var logoSrc = window.IMEC_LOGO_SRC || '/assets/imec-metalurgica-logo-transparent.png';
    var logo = '<img src="' + esc(logoSrc) + '" alt="IMEC">';
    var rows = records.map(function (r) {
      return '<tr><td>' + esc(r.quantity || 1) + '</td><td>' + esc(r.epi_name || r.catalog_name || '-') + '</td><td>' + esc(r.ca_number || '-') + '</td><td>' + fmtDate(r.delivery_date) + '</td><td>' + signatureCell(r.delivery_signature) + '</td><td>' + fmtDate(r.return_date) + '</td><td>' + signatureCell(r.return_signature) + '</td></tr>';
    }).join('');
    while ((rows.match(/<tr>/g) || []).length < 12) rows += '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    return '<article class="epi-print-sheet">'
      + '<div class="epi-print-header"><div class="epi-print-logo">' + logo + '</div><div class="epi-print-company"><h2>' + esc(company) + '</h2><p><b>CNPJ:</b> ' + esc(cnpj) + '</p></div><div class="epi-print-term"><b>NR 6 - EPI</b><br>Controle individual de entrega, uso, guarda e devolucao de equipamentos de protecao individual.</div></div>'
      + '<div class="epi-print-title">Ficha Individual de Controle de Entrega de EPI</div>'
      + '<div class="epi-print-worker"><div><b>Nome:</b> ' + esc(emp.full_name) + '</div><div><b>CPF:</b> ' + esc(emp.cpf || '-') + '</div><div><b>RG:</b> ' + esc(emp.rg || '-') + '</div><div><b>Funcao:</b> ' + esc(emp.role_position || '-') + '</div><div><b>Obra/Setor:</b> ' + esc(emp.department || '-') + '</div><div><b>Data de inicio da ficha:</b> ' + fmtDate(records[0] && records[0].delivery_date || emp.admission_date || today()) + '</div></div>'
      + '<table class="epi-print-table"><thead><tr><th>Quant.</th><th>Descricao do EPI</th><th>C.A.</th><th>Data de Entrega</th><th>Assinatura/Rubrica do Funcionario</th><th>Data de Devolucao</th><th>Assinatura/Rubrica</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<section class="epi-term"><h3>Termo de Responsabilidade</h3><p>Declaro que recebi orientacao sobre o uso correto, guarda, conservacao e higienizacao dos Equipamentos de Protecao Individual fornecidos pela empresa, comprometendo-me a utiliza-los somente para a finalidade a que se destinam, zelar por sua conservacao e comunicar imediatamente qualquer dano, extravio ou condicao que torne o equipamento improprio para uso.</p><p>Declaro ainda estar ciente de que o uso dos EPIs e obrigatorio durante a execucao das atividades, conforme orientacoes de seguranca da empresa e legislacao aplicavel.</p><p>Local e data: _______________________________________________</p><div class="epi-term-lines"><div>Assinatura do funcionario</div><div>Assinatura do responsavel pela entrega</div></div><p class="text-xs text-slate-500 mt-6">Documento emitido em ' + new Date().toLocaleString('pt-BR') + '.</p></section>'
      + '</article>';
  }

  function signatureCell(data) {
    return data ? '<img class="epi-print-sign-img" src="' + esc(data) + '" alt="Assinatura">' : '&nbsp;';
  }

  function field(label, id, value, type, required) {
    return '<div><label class="label">' + label + '</label><input class="input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '"' + (required ? ' required' : '') + '></div>';
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function inputDate(value) {
    if (!value) return '';
    var d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  window.fillEpiCA = function () {
    var select = document.getElementById('epiCatalog');
    var ca = document.getElementById('epiCA');
    if (select && ca && select.selectedOptions[0]) ca.value = select.selectedOptions[0].dataset.ca || '';
  };

  function setupSignature(id) {
    var canvas = document.getElementById(id);
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
    var ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    signaturePads[id] = { canvas: canvas, dirty: false, drawing: false };

    function point(evt) {
      var r = canvas.getBoundingClientRect();
      var p = evt.touches ? evt.touches[0] : evt;
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    }
    function start(evt) { evt.preventDefault(); var p = point(evt); signaturePads[id].drawing = true; ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(evt) { if (!signaturePads[id].drawing) return; evt.preventDefault(); var p = point(evt); ctx.lineTo(p.x, p.y); ctx.stroke(); signaturePads[id].dirty = true; }
    function end() { signaturePads[id].drawing = false; }
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
  }

  window.clearSignature = function (id) {
    var pad = signaturePads[id];
    if (!pad) return;
    var ctx = pad.canvas.getContext('2d');
    ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
    pad.dirty = false;
  };

  function getSignature(id) {
    var pad = signaturePads[id];
    return pad && pad.dirty ? pad.canvas.toDataURL('image/png') : '';
  }

  function install(attempt) {
    if (typeof renderers !== 'undefined') {
      renderers.epi = renderEpiSuite;
      return;
    }
    if ((attempt || 0) < 40) setTimeout(function () { install((attempt || 0) + 1); }, 100);
  }

  install(0);
})();
