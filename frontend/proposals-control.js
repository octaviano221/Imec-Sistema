(function () {
  'use strict';

  function icon(name) {
    var icons = {
      proposal: '<path d="M8 3h8l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M16 3v5h5"/><path d="M10 13h7"/><path d="M10 17h5"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><rect x="2" y="2" width="13" height="13" rx="2"/>',
      trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
      chart: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-7"/>',
      brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 17v4"/><path d="M21 19h-4"/>',
      money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.proposal) + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char];
    });
  }

  function db() {
    return typeof getDB === 'function' ? getDB() : {};
  }

  function fmt(value) {
    return typeof formatDate === 'function' ? formatDate(value) : (value || '--');
  }

  function inputDateValue(value) {
    return typeof inputDate === 'function' ? inputDate(value) : (value ? String(value).split('T')[0].slice(0, 10) : '');
  }

  function todayValue() {
    return typeof today === 'function' ? today() : new Date().toISOString().split('T')[0];
  }

  function addMonthsValue(date, months) {
    return typeof addMonths === 'function' ? addMonths(date, months) : date;
  }

  function same(a, b) {
    return String(a) === String(b);
  }

  function proposals() {
    return (db().technical_proposals || []).slice();
  }

  function money(value) {
    if (value === '' || value == null) return '--';
    var n = Number(value || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function statusInfo(status) {
    var map = {
      rascunho: ['#64748b', '#f1f5f9', 'Rascunho'],
      enviada: ['#1269ff', '#eaf2ff', 'Enviada'],
      negociacao: ['#d97706', '#fef3c7', 'Negocia&ccedil;&atilde;o'],
      aprovada: ['#16a34a', '#dcfce7', 'Aprovada'],
      perdida: ['#dc2626', '#fee2e2', 'Perdida']
    };
    return map[status] || map.rascunho;
  }

  function chip(status) {
    var item = statusInfo(status);
    return '<span class="proposal-chip" style="--tone:' + item[0] + ';--soft:' + item[1] + '">' + item[2] + '</span>';
  }

  function typeLabel(type) {
    var map = {
      locacao_equipamento: 'Loca&ccedil;&atilde;o de equipamento',
      manutencao_industrial: 'Manuten&ccedil;&atilde;o industrial',
      caldeiraria: 'Caldeiraria / reforma',
      laudo_inspecao: 'Laudo / inspe&ccedil;&atilde;o'
    };
    return map[type] || esc(type || 'Proposta');
  }

  function clientOptions(selected) {
    var items = db().clients || [];
    var html = '<option value="">Selecionar cliente</option>';
    items.forEach(function (client) {
      html += '<option value="' + esc(client.id) + '"' + (same(client.id, selected) ? ' selected' : '') + '>' + esc(client.name) + '</option>';
    });
    return html;
  }

  function projectOptions(selected) {
    var items = db().projects || [];
    var html = '<option value="">Sem obra vinculada</option>';
    items.forEach(function (project) {
      html += '<option value="' + esc(project.id) + '"' + (same(project.id, selected) ? ' selected' : '') + '>' + esc(project.name) + '</option>';
    });
    return html;
  }

  var proposalGuides = {
    locacao_equipamento: {
      label: 'Loca&ccedil;&atilde;o Munck / Guindaste',
      hint: 'Para propostas de apoio operacional, movimenta&ccedil;&atilde;o de cargas e loca&ccedil;&atilde;o com operador.',
      checklist: [
        'Equipamento, capacidade e modelo',
        'Per&iacute;odo, jornada, di&aacute;ria ou horas m&iacute;nimas',
        'Operador incluso e habilita&ccedil;&otilde;es',
        'Mobiliza&ccedil;&atilde;o, deslocamento, refei&ccedil;&atilde;o e hospedagem',
        'Responsabilidades do cliente: acesso, terreno, apoio e libera&ccedil;&otilde;es',
        'Valor, prazo de pagamento e validade da proposta'
      ]
    },
    manutencao_industrial: {
      label: 'Manuten&ccedil;&atilde;o Industrial NR-13',
      hint: 'Para servi&ccedil;os com escopo t&eacute;cnico, desmontagem, montagem, reforma e adequa&ccedil;&otilde;es.',
      checklist: [
        'Objetivo e equipamento atendido',
        'Escopo t&eacute;cnico detalhado por etapa',
        'Normas envolvidas: NR-13, NR-33, NR-35 ou outras',
        'Materiais inclusos e materiais por conta do cliente',
        'Prazo, garantia e condi&ccedil;&otilde;es de parada',
        'Responsabilidades da contratada e contratante'
      ]
    },
    caldeiraria: {
      label: 'Caldeiraria / Reforma',
      hint: 'Para fabrica&ccedil;&atilde;o, reforma, solda, montagem e adequa&ccedil;&atilde;o de componentes.',
      checklist: [
        'Medidas, desenhos, croquis ou fotos recebidas',
        'Tipo de material, espessuras e quantidade',
        'Servi&ccedil;os de corte, dobra, solda, montagem e acabamento',
        'Inspe&ccedil;&otilde;es, ensaios ou registros exigidos',
        'Transporte, instala&ccedil;&atilde;o e libera&ccedil;&otilde;es de campo',
        'Condi&ccedil;&otilde;es comerciais e prazo de execu&ccedil;&atilde;o'
      ]
    },
    laudo_inspecao: {
      label: 'Laudo / Inspe&ccedil;&atilde;o',
      hint: 'Para laudo de capacidade, inspe&ccedil;&atilde;o de munck, guindaste, caminh&atilde;o e equipamento.',
      checklist: [
        'Identifica&ccedil;&atilde;o do equipamento: marca, modelo, placa, s&eacute;rie e patrim&ocirc;nio',
        'Capacidade nominal e condi&ccedil;&atilde;o operacional',
        'Documentos recebidos: CRLV, ART, manual, certificados e manuten&ccedil;&otilde;es',
        'Fotos e evid&ecirc;ncias t&eacute;cnicas',
        'Respons&aacute;vel t&eacute;cnico, prazo e validade do laudo',
        'Restri&ccedil;&otilde;es, recomenda&ccedil;&otilde;es e conclus&atilde;o'
      ]
    }
  };

  function guide(type) {
    return proposalGuides[type] || proposalGuides.locacao_equipamento;
  }

  function checklistHtml(type) {
    var item = guide(type);
    return '<div class="proposal-checklist-preview"><h3>' + item.label + '</h3><p>' + item.hint + '</p><ul>' + item.checklist.map(function (text) {
      return '<li>' + text + '</li>';
    }).join('') + '</ul></div>';
  }

  function metrics() {
    var rows = proposals();
    var open = rows.filter(function (p) { return ['enviada', 'negociacao'].indexOf(p.status) >= 0; });
    var approved = rows.filter(function (p) { return p.status === 'aprovada'; });
    var approvedValue = approved.reduce(function (sum, item) { return sum + Number(item.total_value || 0); }, 0);
    return {
      total: rows.length,
      open: open.length,
      approved: approved.length,
      approvedValue: approvedValue
    };
  }

  function renderKpi(label, value, iconName, tone, hint) {
    return '<section class="proposal-kpi" style="--tone:' + tone + '"><div class="proposal-kpi-icon">' + icon(iconName) + '</div><div><span>' + label + '</span><strong>' + value + '</strong><p>' + (hint || '') + '</p></div></section>';
  }

  function renderPipeline() {
    var statuses = ['rascunho', 'enviada', 'negociacao', 'aprovada', 'perdida'];
    var rows = proposals();
    return '<div class="proposal-pipeline">' + statuses.map(function (status) {
      var info = statusInfo(status);
      var list = rows.filter(function (p) { return p.status === status; });
      var value = list.reduce(function (sum, item) { return sum + Number(item.total_value || 0); }, 0);
      return '<div class="proposal-stage"><strong>' + info[2] + '<span class="proposal-chip" style="--tone:' + info[0] + ';--soft:' + info[1] + '">' + list.length + '</span></strong><b>' + list.length + '</b><small>' + money(value) + '</small></div>';
    }).join('') + '</div>';
  }

  function renderTopCards() {
    var rows = proposals().slice(0, 4);
    if (!rows.length) {
      return '<div class="proposal-card"><div class="proposal-card-icon">' + icon('upload') + '</div><div><h3>Comece pela biblioteca comercial</h3><p>Cadastre o PDF ou Word oficial, informe cliente, valor, status e acompanhe tudo pelo sistema.</p></div><button class="btn btn-primary btn-sm" onclick="openProposalModal()">' + icon('plus') + ' Nova</button></div>';
    }
    return '<div class="proposal-card-list">' + rows.map(function (p) {
      return '<div class="proposal-card"><div class="proposal-card-icon">' + icon('proposal') + '</div><div><h3>' + esc(p.title || p.proposal_number) + '</h3><p>' + esc(p.client_name || 'Sem cliente') + ' &bull; ' + typeLabel(p.proposal_type) + ' &bull; ' + fmt(p.proposal_date) + '</p></div><div>' + chip(p.status) + '</div></div>';
    }).join('') + '</div>';
  }

  function renderRows() {
    var rows = proposals();
    if (!rows.length) {
      return '<tr><td colspan="9" style="text-align:center;color:#8a98b4;padding:34px">Nenhuma proposta cadastrada ainda.</td></tr>';
    }
    return rows.map(function (p) {
      var file = p.file_url ? '<a class="btn btn-outline btn-sm" href="' + esc(p.file_url) + '" target="_blank" rel="noopener">' + icon('download') + ' Abrir</a>' : '<span style="color:#98a5bd">Sem anexo</span>';
      return '<tr data-status="' + esc(p.status) + '" data-type="' + esc(p.proposal_type) + '"><td><strong>' + esc(p.proposal_number || '-') + '</strong><br><small>' + esc(p.revision || 'R00') + '</small></td><td><strong>' + esc(p.title || '-') + '</strong><br><small>' + typeLabel(p.proposal_type) + '</small></td><td>' + esc(p.client_name || '-') + '</td><td>' + fmt(p.proposal_date) + '</td><td>' + money(p.total_value) + '</td><td>' + chip(p.status) + '</td><td>' + file + '</td><td><div class="flex gap-1"><button class="btn btn-outline btn-sm" title="Editar" onclick="openProposalModal(\'' + p.id + '\')">' + icon('edit') + '</button><button class="btn btn-outline btn-sm" title="Duplicar" onclick="duplicateProposal(\'' + p.id + '\')">' + icon('copy') + '</button>' + (typeof canAdmin === 'function' && canAdmin() ? '<button class="btn btn-sm text-imec-red" title="Excluir" onclick="deleteProposal(\'' + p.id + '\')">' + icon('trash') + '</button>' : '') + '</div></td></tr>';
    }).join('');
  }

  function renderTemplates() {
    return '<div class="proposal-template-grid">' + Object.keys(proposalGuides).map(function (key) {
      var item = proposalGuides[key];
      return '<div class="proposal-template"><h3>' + item.label + '</h3><p>' + item.hint + '</p><button class="btn btn-outline btn-sm" onclick="openProposalAssistant(\'' + key + '\')">' + icon('spark') + ' Ver checklist</button></div>';
    }).join('') + '</div>';
  }

  function renderProposals() {
    var m = metrics();
    return '<div class="proposal-suite">'
      + '<section class="proposal-hero"><div><p class="proposal-kicker">Centro comercial executivo</p><h2>Propostas T&eacute;cnicas e Comerciais</h2><p>Centralize PDFs, Word, revis&otilde;es, valores e status sem alterar o modelo oficial que voc&ecirc;s j&aacute; usam.</p></div><div class="proposal-actions"><button class="btn btn-outline" onclick="openProposalAssistant()">' + icon('spark') + ' Checklist</button><button class="btn btn-primary" onclick="openProposalModal()">' + icon('plus') + ' Nova proposta</button></div></section>'
      + '<div class="proposal-kpis">' + renderKpi('Propostas cadastradas', m.total, 'proposal', '#1269ff', 'hist&oacute;rico comercial') + renderKpi('Em aberto', m.open, 'brief', '#d97706', 'enviadas/negocia&ccedil;&atilde;o') + renderKpi('Aprovadas', m.approved, 'chart', '#16a34a', 'ganhas') + renderKpi('Valor aprovado', money(m.approvedValue), 'money', '#0f766e', 'resultado acumulado') + '</div>'
      + '<section class="proposal-section"><div class="proposal-section-head"><div><h2>Pipeline comercial</h2><p>Vis&atilde;o r&aacute;pida por etapa da proposta.</p></div></div><div class="proposal-section-body">' + renderPipeline() + '</div></section>'
      + '<div class="proposal-grid"><section class="proposal-section"><div class="proposal-section-head"><div><h2>Propostas recentes</h2><p>&Uacute;ltimos documentos oficiais cadastrados.</p></div></div><div class="proposal-section-body">' + renderTopCards() + '</div></section><section class="proposal-section"><div class="proposal-section-head"><div><h2>Checklists por tipo</h2><p>Guia pr&aacute;tico para n&atilde;o esquecer informa&ccedil;&otilde;es importantes antes de anexar a proposta final.</p></div></div><div class="proposal-section-body">' + renderTemplates() + '</div></section></div>'
      + '<section class="proposal-section"><div class="proposal-section-head"><div><h2>Biblioteca de propostas</h2><p>Busque por cliente, n&uacute;mero, servi&ccedil;o, status ou anexo.</p></div><div class="proposal-actions"><div class="search-box" style="min-width:280px">' + icon('search') + '<input id="proposalSearch" oninput="filterProposals()" placeholder="Buscar proposta..."></div><select id="proposalStatusFilter" class="input" onchange="filterProposals()" style="width:190px"><option value="">Todos os status</option><option value="rascunho">Rascunho</option><option value="enviada">Enviada</option><option value="negociacao">Negocia&ccedil;&atilde;o</option><option value="aprovada">Aprovada</option><option value="perdida">Perdida</option></select></div></div><div class="proposal-table-wrap"><table class="proposal-table" id="proposalTable"><thead><tr><th>N&uacute;mero</th><th>Proposta</th><th>Cliente</th><th>Data</th><th>Valor</th><th>Status</th><th>Anexo</th><th>A&ccedil;&otilde;es</th></tr></thead><tbody>' + renderRows() + '</tbody></table></div></section>'
      + '</div>';
  }

  function proposalById(id) {
    return proposals().find(function (item) { return same(item.id, id); });
  }

  function formValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  window.openProposalModal = function (id, modelType, duplicate) {
    var p = id ? proposalById(id) : null;
    var model = modelType || (p && p.proposal_type) || 'locacao_equipamento';
    var currentGuide = guide(model);
    var title = p ? (duplicate ? 'Duplicar proposta' : 'Editar proposta') : 'Nova proposta';
    var proposalNumber = duplicate ? '' : (p ? p.proposal_number : '');
    var html = '<div class="proposal-modal p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">' + title + '</h2><p class="text-sm text-gray-500 mb-6">Controle do documento oficial: cadastre o resumo, anexe o arquivo final e acompanhe o status comercial.</p><form onsubmit="saveProposal(event, \'' + (duplicate ? '' : (id || '')) + '\')"><div class="proposal-form-grid">'
      + '<div><label class="label">Tipo de proposta</label><select class="input" id="proposalModel" onchange="updateProposalChecklist(this.value)"><option value="locacao_equipamento"' + (model === 'locacao_equipamento' ? ' selected' : '') + '>Loca&ccedil;&atilde;o Munck / Guindaste</option><option value="manutencao_industrial"' + (model === 'manutencao_industrial' ? ' selected' : '') + '>Manuten&ccedil;&atilde;o industrial</option><option value="caldeiraria"' + (model === 'caldeiraria' ? ' selected' : '') + '>Caldeiraria / reforma</option><option value="laudo_inspecao"' + (model === 'laudo_inspecao' ? ' selected' : '') + '>Laudo / inspe&ccedil;&atilde;o</option></select></div>'
      + '<div><label class="label">Status</label><select class="input" id="proposalStatus"><option value="rascunho"' + (p && p.status === 'rascunho' ? ' selected' : '') + '>Rascunho</option><option value="enviada"' + (p && p.status === 'enviada' ? ' selected' : '') + '>Enviada</option><option value="negociacao"' + (p && p.status === 'negociacao' ? ' selected' : '') + '>Em negocia&ccedil;&atilde;o</option><option value="aprovada"' + (p && p.status === 'aprovada' ? ' selected' : '') + '>Aprovada</option><option value="perdida"' + (p && p.status === 'perdida' ? ' selected' : '') + '>Perdida</option></select></div>'
      + '<div class="span-2" id="proposalChecklistHint">' + checklistHtml(model) + '</div>'
      + '<div><label class="label">N&uacute;mero</label><input class="input" id="proposalNumber" value="' + esc(proposalNumber) + '" placeholder="2851"></div><div><label class="label">Revis&atilde;o</label><input class="input" id="proposalRevision" value="' + esc(p && !duplicate ? p.revision : 'R00') + '"></div>'
      + '<div class="span-2"><label class="label">T&iacute;tulo *</label><input class="input" id="proposalTitle" value="' + esc(p && !duplicate ? p.title : '') + '" placeholder="' + currentGuide.label + ' - Cliente / servi&ccedil;o" required></div>'
      + '<div><label class="label">Cliente</label><select class="input" id="proposalClient">' + clientOptions(p && !duplicate ? p.client_id : '') + '</select></div><div><label class="label">Obra vinculada</label><select class="input" id="proposalProject">' + projectOptions(p && !duplicate ? p.project_id : '') + '</select></div>'
      + '<div><label class="label">Contato</label><input class="input" id="proposalContact" value="' + esc(p && !duplicate ? p.contact_name : '') + '"></div><div><label class="label">&Aacute;rea / setor</label><input class="input" id="proposalArea" value="' + esc(p && !duplicate ? p.contact_area : '') + '"></div>'
      + '<div><label class="label">Data da proposta</label><input type="date" class="input" id="proposalDate" value="' + esc(p && !duplicate ? inputDateValue(p.proposal_date) : todayValue()) + '"></div><div><label class="label">Validade</label><input type="date" class="input" id="proposalValidity" value="' + esc(p && !duplicate ? inputDateValue(p.validity_date) : addMonthsValue(todayValue(), 1)) + '"></div>'
      + '<div><label class="label">Valor total</label><input type="number" step="0.01" class="input" id="proposalValue" value="' + esc(p && !duplicate ? (p.total_value || '') : '') + '"></div><div><label class="label">Local</label><input class="input" id="proposalLocation" value="' + esc(p && !duplicate ? p.location : '') + '"></div>'
      + '<div class="span-2"><label class="label">Resumo r&aacute;pido para busca</label><textarea class="input" rows="2" id="proposalSummary" placeholder="Ex.: Loca&ccedil;&atilde;o de munck 10 ton para apoio em manuten&ccedil;&atilde;o...">' + esc(p && !duplicate ? p.scope_summary : '') + '</textarea></div>'
      + '<div class="span-2"><label class="label">Equipamento / servi&ccedil;o principal</label><textarea class="input" rows="2" id="proposalEquipment" placeholder="Ex.: Munck 10 ton, guindaste 30 ton, coluna A-2600, laudo de capacidade...">' + esc(p && !duplicate ? p.equipment_description : '') + '</textarea></div>'
      + '<div><label class="label">Condi&ccedil;&otilde;es comerciais principais</label><textarea class="input" rows="3" id="proposalCommercial" placeholder="Valor, forma de medi&ccedil;&atilde;o, observa&ccedil;&otilde;es comerciais importantes...">' + esc(p && !duplicate ? p.commercial_terms : '') + '</textarea></div><div><label class="label">Pagamento / prazo</label><textarea class="input" rows="3" id="proposalPayment" placeholder="Ex.: 20 dias ap&oacute;s execu&ccedil;&atilde;o, entrada + medi&ccedil;&otilde;es, prazo de entrega...">' + esc(p && !duplicate ? p.payment_terms : '') + '</textarea></div>'
      + '<input type="hidden" id="proposalTechnical" value="' + esc(p && !duplicate ? p.technical_scope : '') + '"><input type="hidden" id="proposalContracted" value="' + esc(p && !duplicate ? p.contracted_obligations : '') + '"><input type="hidden" id="proposalClientObligations" value="' + esc(p && !duplicate ? p.client_obligations : '') + '"><input type="hidden" id="proposalDelivery" value="' + esc(p && !duplicate ? p.delivery_time : '') + '"><input type="hidden" id="proposalWarranty" value="' + esc(p && !duplicate ? p.warranty_terms : '') + '">'
      + '<div class="span-2 proposal-upload-box"><label class="label">Documento oficial da proposta (PDF, Word ou Excel)</label><input type="file" class="input" id="proposalFile" accept=".pdf,.doc,.docx,.xls,.xlsx"><input type="hidden" id="proposalFileUrl" value="' + esc(p && !duplicate ? p.file_url : '') + '">' + (p && p.file_url && !duplicate ? '<p class="mt-2 text-xs"><a class="text-imec-blue font-bold" href="' + esc(p.file_url) + '" target="_blank" rel="noopener">Arquivo oficial cadastrado</a></p>' : '<p class="mt-2 text-xs text-gray-500">Anexe aqui a proposta final exatamente como foi enviada ao cliente.</p>') + '</div>'
      + '<div class="span-2"><label class="label">Notas internas</label><textarea class="input" rows="2" id="proposalNotes">' + esc(p && !duplicate ? p.notes : '') + '</textarea></div>'
      + '</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar proposta</button></div></form></div>';
    openModal(html);
  };

  window.updateProposalChecklist = function (type) {
    var box = document.getElementById('proposalChecklistHint');
    if (box) box.innerHTML = checklistHtml(type);
    var preview = document.getElementById('proposalAssistantPreview');
    if (preview) preview.innerHTML = checklistHtml(type);
  };

  window.applyProposalTemplate = window.updateProposalChecklist;

  window.saveProposal = async function (event, id) {
    event.preventDefault();
    var fileInput = document.getElementById('proposalFile');
    var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    var fileUrl = formValue('proposalFileUrl');
    try {
      if (file) {
        var fd = new FormData();
        fd.append('file', file);
        var uploaded = await API.upload(fd);
        fileUrl = uploaded.url;
      }
      var data = {
        proposal_number: formValue('proposalNumber'),
        revision: formValue('proposalRevision') || 'R00',
        title: formValue('proposalTitle'),
        proposal_type: formValue('proposalModel'),
        client_id: formValue('proposalClient') || null,
        project_id: formValue('proposalProject') || null,
        contact_name: formValue('proposalContact'),
        contact_area: formValue('proposalArea'),
        location: formValue('proposalLocation'),
        proposal_date: formValue('proposalDate') || null,
        validity_date: formValue('proposalValidity') || null,
        status: formValue('proposalStatus'),
        scope_summary: formValue('proposalSummary'),
        technical_scope: formValue('proposalTechnical'),
        equipment_description: formValue('proposalEquipment'),
        contracted_obligations: formValue('proposalContracted'),
        client_obligations: formValue('proposalClientObligations'),
        commercial_terms: formValue('proposalCommercial'),
        payment_terms: formValue('proposalPayment'),
        delivery_time: formValue('proposalDelivery'),
        warranty_terms: formValue('proposalWarranty'),
        total_value: formValue('proposalValue') || null,
        currency: 'BRL',
        file_url: fileUrl,
        source_model: formValue('proposalModel'),
        notes: formValue('proposalNotes')
      };
      if (id) await API.technicalProposals.update(id, data);
      else await API.technicalProposals.create(data);
      await refreshData();
      closeModal();
      await renderPage();
      showToast(id ? 'Proposta atualizada!' : 'Proposta cadastrada!', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };

  window.duplicateProposal = function (id) {
    openProposalModal(id, null, true);
  };

  window.deleteProposal = async function (id) {
    var p = proposalById(id);
    if (!confirm('Excluir a proposta ' + ((p && (p.proposal_number || p.title)) || id) + '?')) return;
    try {
      await API.technicalProposals.delete(id);
      await refreshData();
      await renderPage();
      showToast('Proposta excluida!', 'success');
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };

  window.filterProposals = function () {
    var q = (document.getElementById('proposalSearch') || {}).value || '';
    var status = (document.getElementById('proposalStatusFilter') || {}).value || '';
    q = q.toLowerCase();
    document.querySelectorAll('#proposalTable tbody tr').forEach(function (row) {
      var okText = !q || row.textContent.toLowerCase().indexOf(q) >= 0;
      var okStatus = !status || row.getAttribute('data-status') === status;
      row.style.display = okText && okStatus ? '' : 'none';
    });
  };

  window.openProposalAssistant = function (selectedType) {
    var selected = selectedType || 'locacao_equipamento';
    var html = '<div class="proposal-modal p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Checklist de proposta</h2><p class="text-sm text-gray-500 mb-5">Use como confer&ecirc;ncia antes de anexar o documento oficial. O sistema n&atilde;o altera o texto da proposta.</p><div class="proposal-form-grid"><div><label class="label">Tipo de proposta</label><select class="input" onchange="updateProposalChecklist(this.value)"><option value="locacao_equipamento"' + (selected === 'locacao_equipamento' ? ' selected' : '') + '>Loca&ccedil;&atilde;o Munck / Guindaste</option><option value="manutencao_industrial"' + (selected === 'manutencao_industrial' ? ' selected' : '') + '>Manuten&ccedil;&atilde;o industrial</option><option value="caldeiraria"' + (selected === 'caldeiraria' ? ' selected' : '') + '>Caldeiraria / Reforma</option><option value="laudo_inspecao"' + (selected === 'laudo_inspecao' ? ' selected' : '') + '>Laudo / inspe&ccedil;&atilde;o</option></select></div><div style="display:flex;align-items:end"><button class="btn btn-primary" onclick="openProposalModal(null, document.querySelector(\'.proposal-modal select\').value)">' + icon('plus') + ' Cadastrar proposta</button></div><div class="span-2"><div id="proposalAssistantPreview">' + checklistHtml(selected) + '</div></div></div><div class="flex justify-end mt-6"><button class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>';
    openModal(html);
  };

  function installSidebar() {
    if (document.querySelector('[data-page="proposals"]')) return;
    var projects = document.querySelector('[data-page="projects"]');
    if (!projects) return;
    var link = document.createElement('a');
    link.className = 'sidebar-link';
    link.setAttribute('data-page', 'proposals');
    link.setAttribute('onclick', "navigate('proposals')");
    link.innerHTML = icon('brief') + 'Propostas';
    projects.insertAdjacentElement('afterend', link);
  }

  function install(attempts) {
    if (typeof renderers === 'undefined') {
      if ((attempts || 0) < 80) setTimeout(function () { install((attempts || 0) + 1); }, 80);
      return;
    }
    installSidebar();
    renderers.proposals = async function () {
      var title = document.getElementById('pageTitle');
      var subtitle = document.getElementById('pageSubtitle');
      if (title) title.textContent = 'Propostas';
      if (subtitle) subtitle.textContent = 'T\u00e9cnicas e comerciais';
      return renderProposals();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { install(0); });
  } else {
    install(0);
  }
})();
