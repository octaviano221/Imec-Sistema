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

  var templates = {
    locacao_equipamento: {
      label: 'Loca&ccedil;&atilde;o Munck / Guindaste',
      title: 'Loca&ccedil;&atilde;o de equipamento para apoio operacional',
      scope: 'Fornecimento de loca&ccedil;&atilde;o de equipamento com operador para atendimento de servi&ccedil;os de manuten&ccedil;&atilde;o industrial, movimenta&ccedil;&atilde;o de cargas e apoio operacional em campo.',
      equipment: '01 equipamento tipo munck/guindaste, com capacidade conforme solicita&ccedil;&atilde;o, incluindo operador habilitado, documenta&ccedil;&atilde;o b&aacute;sica do equipamento e condi&ccedil;&otilde;es adequadas de opera&ccedil;&atilde;o.',
      contracted: 'Fornecimento do equipamento em perfeitas condi&ccedil;&otilde;es de uso.\nOperador com cursos, experi&ecirc;ncia e habilita&ccedil;&otilde;es aplic&aacute;veis.\nFornecimento das documenta&ccedil;&otilde;es da empresa e do equipamento.\nFornecimento de EPIs, transporte e refei&ccedil;&atilde;o da equipe.\nSubstitui&ccedil;&atilde;o do equipamento em caso de necessidade de manuten&ccedil;&atilde;o.',
      client: 'Disponibilizar informa&ccedil;&otilde;es t&eacute;cnicas necess&aacute;rias para execu&ccedil;&atilde;o das atividades.\nGarantir condi&ccedil;&otilde;es seguras para execu&ccedil;&atilde;o do trabalho.\nDisponibilizar acesso livre ao local, terreno nivelado e compactado, &aacute;gua pot&aacute;vel e sanit&aacute;rio.',
      commercial: 'Valor conforme escopo e per&iacute;odo contratado, podendo incluir deslocamento, di&aacute;rias e condi&ccedil;&otilde;es especiais negociadas entre as partes.',
      payment: '20 dias ap&oacute;s execu&ccedil;&atilde;o da atividade.',
      delivery: 'Disponibilidade conforme agenda operacional.',
      warranty: 'Servi&ccedil;o executado conforme boas pr&aacute;ticas operacionais e condi&ccedil;&otilde;es informadas na proposta.'
    },
    manutencao_industrial: {
      label: 'Manuten&ccedil;&atilde;o Industrial NR-13',
      title: 'Servi&ccedil;os especializados de manuten&ccedil;&atilde;o industrial',
      scope: 'Execu&ccedil;&atilde;o de servi&ccedil;os especializados de caldeiraria industrial, desmontagem, reforma, fabrica&ccedil;&atilde;o, adequa&ccedil;&atilde;o e montagem de equipamentos industriais conforme escopo t&eacute;cnico definido.',
      equipment: 'Equipamentos industriais sujeitos a interven&ccedil;&atilde;o, incluindo colunas, vasos, trocadores, estruturas, componentes de caldeiraria e itens correlatos, conforme levantamento t&eacute;cnico.',
      contracted: 'Elabora&ccedil;&atilde;o do plano de desmontagem e montagem.\nFornecimento de m&atilde;o de obra especializada.\nFornecimento de m&aacute;quinas, ferramentas e equipamentos operacionais.\nFornecimento de EPIs para equipe pr&oacute;pria.\nExecu&ccedil;&atilde;o conforme boas pr&aacute;ticas de fabrica&ccedil;&atilde;o e montagem industrial.',
      client: 'Liberar equipamento e &aacute;rea de trabalho.\nFornecer informa&ccedil;&otilde;es t&eacute;cnicas necess&aacute;rias.\nDisponibilizar condi&ccedil;&otilde;es seguras de acesso, energia, apoio operacional e supervis&atilde;o quando necess&aacute;rio.\nResponsabilizar-se por transportes e libera&ccedil;&otilde;es n&atilde;o previstas no escopo.',
      commercial: 'Valores parciais conforme itens de fornecimento, reforma, desmontagem, montagem e servi&ccedil;os complementares descritos na proposta.',
      payment: 'Condi&ccedil;&atilde;o sugerida: entrada, medi&ccedil;&otilde;es por avan&ccedil;o e saldo ap&oacute;s entrega/start-up.',
      delivery: 'Prazo estimado conforme libera&ccedil;&atilde;o formal do equipamento e disponibilidade operacional.',
      warranty: 'Garantia de 12 meses para servi&ccedil;os executados, limitada ao escopo contratado e condi&ccedil;&otilde;es pr&eacute;-existentes do equipamento.'
    },
    caldeiraria: {
      label: 'Caldeiraria / Reforma',
      title: 'Reforma e adequa&ccedil;&atilde;o de equipamento industrial',
      scope: 'Servi&ccedil;os de caldeiraria para reforma, substitui&ccedil;&atilde;o parcial, adequa&ccedil;&atilde;o estrutural, fabrica&ccedil;&atilde;o e montagem de componentes conforme necessidade identificada em campo.',
      equipment: 'Componentes met&aacute;licos, costados, bandejas, vertedores, tubula&ccedil;&otilde;es, suportes e conjuntos industriais conforme memorial descritivo.',
      contracted: 'Fornecimento de m&atilde;o de obra de caldeiraria e soldagem.\nExecu&ccedil;&atilde;o de cortes, ajustes, montagem, solda e acabamento.\nDisponibiliza&ccedil;&atilde;o de equipamentos e ferramentas necess&aacute;rias.\nOrganiza&ccedil;&atilde;o de registros e evid&ecirc;ncias quando aplic&aacute;vel.',
      client: 'Disponibilizar desenhos, medidas, acesso, libera&ccedil;&otilde;es, acompanhamento e condi&ccedil;&otilde;es seguras para execu&ccedil;&atilde;o dos servi&ccedil;os.',
      commercial: 'Valores definidos por item de servi&ccedil;o, material, transporte, montagem e condi&ccedil;&otilde;es de campo.',
      payment: 'A combinar conforme medi&ccedil;&otilde;es e marcos de entrega.',
      delivery: 'Prazo conforme complexidade do escopo e libera&ccedil;&atilde;o da &aacute;rea.',
      warranty: 'Garantia limitada aos servi&ccedil;os executados pela IMEC dentro do escopo contratado.'
    },
    laudo_inspecao: {
      label: 'Laudo / Inspe&ccedil;&atilde;o',
      title: 'Laudo t&eacute;cnico de capacidade e inspe&ccedil;&atilde;o operacional',
      scope: 'Elabora&ccedil;&atilde;o de laudo t&eacute;cnico, inspe&ccedil;&atilde;o visual, verifica&ccedil;&atilde;o documental e avalia&ccedil;&atilde;o de capacidade operacional de equipamento industrial, munck, guindaste, caminh&atilde;o ou conjunto de movimenta&ccedil;&atilde;o de cargas.',
      equipment: 'Equipamento informado pelo cliente, incluindo dados de identifica&ccedil;&atilde;o, placa, patrim&ocirc;nio, capacidade nominal, condi&ccedil;&otilde;es de uso, documenta&ccedil;&atilde;o dispon&iacute;vel e evid&ecirc;ncias t&eacute;cnicas anexas.',
      contracted: 'Realizar inspe&ccedil;&atilde;o t&eacute;cnica conforme escopo contratado.\nRegistrar evid&ecirc;ncias, fotos, dados do equipamento e condi&ccedil;&otilde;es observadas.\nEmitir laudo ou relat&oacute;rio t&eacute;cnico com conclus&atilde;o objetiva.\nIndicar restri&ccedil;&otilde;es, recomenda&ccedil;&otilde;es e prazos quando aplic&aacute;vel.',
      client: 'Disponibilizar o equipamento para inspe&ccedil;&atilde;o.\nFornecer documentos, manuais, certificados, hist&oacute;rico de manuten&ccedil;&atilde;o e informa&ccedil;&otilde;es operacionais.\nGarantir acesso seguro ao local e acompanhamento respons&aacute;vel quando necess&aacute;rio.',
      commercial: 'Valor definido conforme quantidade de equipamentos, complexidade da inspe&ccedil;&atilde;o, deslocamento e necessidade de documenta&ccedil;&atilde;o complementar.',
      payment: '20 dias ap&oacute;s entrega do laudo ou conforme condi&ccedil;&atilde;o negociada.',
      delivery: 'Prazo estimado conforme libera&ccedil;&atilde;o do equipamento e recebimento das informa&ccedil;&otilde;es necess&aacute;rias.',
      warranty: 'O laudo reflete as condi&ccedil;&otilde;es observadas na data da inspe&ccedil;&atilde;o e n&atilde;o substitui manuten&ccedil;&otilde;es preventivas, corretivas ou exig&ecirc;ncias legais espec&iacute;ficas.'
    }
  };

  function templatePreview(type) {
    var t = templates[type] || templates.locacao_equipamento;
    return 'PROPOSTA TECNICA E COMERCIAL\n\n1. OBJETIVO\n' + t.scope + '\n\n2. EQUIPAMENTO / ESCOPO\n' + t.equipment + '\n\n3. OBRIGACOES DA CONTRATADA\n' + t.contracted + '\n\n4. OBRIGACOES DA CONTRATANTE\n' + t.client + '\n\nPROPOSTA COMERCIAL\n' + t.commercial;
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
      return '<div class="proposal-card"><div class="proposal-card-icon">' + icon('spark') + '</div><div><h3>Comece com uma proposta modelo</h3><p>Cadastre as propostas antigas em PDF e use o assistente para padronizar novas propostas.</p></div><button class="btn btn-primary btn-sm" onclick="openProposalModal()">' + icon('plus') + ' Nova</button></div>';
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
    return '<div class="proposal-template-grid">' + Object.keys(templates).map(function (key) {
      var item = templates[key];
      return '<div class="proposal-template"><h3>' + item.label + '</h3><p>' + item.scope.slice(0, 135) + '...</p><button class="btn btn-outline btn-sm" onclick="openProposalModal(null, \'' + key + '\')">' + icon('spark') + ' Usar modelo</button></div>';
    }).join('') + '</div>';
  }

  function renderProposals() {
    var m = metrics();
    return '<div class="proposal-suite">'
      + '<section class="proposal-hero"><div><p class="proposal-kicker">Centro comercial executivo</p><h2>Propostas T&eacute;cnicas e Comerciais</h2><p>Organize PDFs antigos, controle revis&otilde;es e crie novas propostas no padr&atilde;o IMEC.</p></div><div class="proposal-actions"><button class="btn btn-outline" onclick="openProposalAssistant()">' + icon('spark') + ' Assistente</button><button class="btn btn-primary" onclick="openProposalModal()">' + icon('plus') + ' Nova proposta</button></div></section>'
      + '<div class="proposal-kpis">' + renderKpi('Propostas cadastradas', m.total, 'proposal', '#1269ff', 'hist&oacute;rico comercial') + renderKpi('Em aberto', m.open, 'brief', '#d97706', 'enviadas/negocia&ccedil;&atilde;o') + renderKpi('Aprovadas', m.approved, 'chart', '#16a34a', 'ganhas') + renderKpi('Valor aprovado', money(m.approvedValue), 'money', '#0f766e', 'resultado acumulado') + '</div>'
      + '<section class="proposal-section"><div class="proposal-section-head"><div><h2>Pipeline comercial</h2><p>Vis&atilde;o r&aacute;pida por etapa da proposta.</p></div></div><div class="proposal-section-body">' + renderPipeline() + '</div></section>'
      + '<div class="proposal-grid"><section class="proposal-section"><div class="proposal-section-head"><div><h2>Propostas recentes</h2><p>&Uacute;ltimos modelos usados pela equipe.</p></div></div><div class="proposal-section-body">' + renderTopCards() + '</div></section><section class="proposal-section"><div class="proposal-section-head"><div><h2>Modelos inteligentes</h2><p>Baseados nas propostas reais de munck, guindaste e manuten&ccedil;&atilde;o.</p></div></div><div class="proposal-section-body">' + renderTemplates() + '</div></section></div>'
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
    var tpl = templates[model] || templates.locacao_equipamento;
    var title = p ? (duplicate ? 'Duplicar proposta' : 'Editar proposta') : 'Nova proposta';
    var proposalNumber = duplicate ? '' : (p ? p.proposal_number : '');
    var html = '<div class="proposal-modal p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">' + title + '</h2><p class="text-sm text-gray-500 mb-6">Cadastro executivo com anexo, escopo e condi&ccedil;&otilde;es comerciais.</p><form onsubmit="saveProposal(event, \'' + (duplicate ? '' : (id || '')) + '\')"><div class="proposal-form-grid">'
      + '<div><label class="label">Modelo</label><select class="input" id="proposalModel" onchange="applyProposalTemplate(this.value)"><option value="locacao_equipamento"' + (model === 'locacao_equipamento' ? ' selected' : '') + '>Loca&ccedil;&atilde;o Munck / Guindaste</option><option value="manutencao_industrial"' + (model === 'manutencao_industrial' ? ' selected' : '') + '>Manuten&ccedil;&atilde;o industrial</option><option value="caldeiraria"' + (model === 'caldeiraria' ? ' selected' : '') + '>Caldeiraria / reforma</option><option value="laudo_inspecao"' + (model === 'laudo_inspecao' ? ' selected' : '') + '>Laudo / inspe&ccedil;&atilde;o</option></select></div>'
      + '<div><label class="label">Status</label><select class="input" id="proposalStatus"><option value="rascunho"' + (p && p.status === 'rascunho' ? ' selected' : '') + '>Rascunho</option><option value="enviada"' + (p && p.status === 'enviada' ? ' selected' : '') + '>Enviada</option><option value="negociacao"' + (p && p.status === 'negociacao' ? ' selected' : '') + '>Em negocia&ccedil;&atilde;o</option><option value="aprovada"' + (p && p.status === 'aprovada' ? ' selected' : '') + '>Aprovada</option><option value="perdida"' + (p && p.status === 'perdida' ? ' selected' : '') + '>Perdida</option></select></div>'
      + '<div><label class="label">N&uacute;mero</label><input class="input" id="proposalNumber" value="' + esc(proposalNumber) + '" placeholder="2851"></div><div><label class="label">Revis&atilde;o</label><input class="input" id="proposalRevision" value="' + esc(p && !duplicate ? p.revision : 'R00') + '"></div>'
      + '<div class="span-2"><label class="label">T&iacute;tulo *</label><input class="input" id="proposalTitle" value="' + esc(p && !duplicate ? p.title : tpl.title) + '" required></div>'
      + '<div><label class="label">Cliente</label><select class="input" id="proposalClient">' + clientOptions(p && !duplicate ? p.client_id : '') + '</select></div><div><label class="label">Obra vinculada</label><select class="input" id="proposalProject">' + projectOptions(p && !duplicate ? p.project_id : '') + '</select></div>'
      + '<div><label class="label">Contato</label><input class="input" id="proposalContact" value="' + esc(p && !duplicate ? p.contact_name : '') + '"></div><div><label class="label">&Aacute;rea / setor</label><input class="input" id="proposalArea" value="' + esc(p && !duplicate ? p.contact_area : '') + '"></div>'
      + '<div><label class="label">Data da proposta</label><input type="date" class="input" id="proposalDate" value="' + esc(p && !duplicate ? inputDateValue(p.proposal_date) : todayValue()) + '"></div><div><label class="label">Validade</label><input type="date" class="input" id="proposalValidity" value="' + esc(p && !duplicate ? inputDateValue(p.validity_date) : addMonthsValue(todayValue(), 1)) + '"></div>'
      + '<div><label class="label">Valor total</label><input type="number" step="0.01" class="input" id="proposalValue" value="' + esc(p && !duplicate ? (p.total_value || '') : '') + '"></div><div><label class="label">Local</label><input class="input" id="proposalLocation" value="' + esc(p && !duplicate ? p.location : '') + '"></div>'
      + '<div class="span-2"><label class="label">Resumo do escopo</label><textarea class="input" rows="2" id="proposalSummary">' + esc(p && !duplicate ? p.scope_summary : tpl.scope) + '</textarea></div>'
      + '<div class="span-2"><label class="label">Escopo t&eacute;cnico</label><textarea class="input" rows="4" id="proposalTechnical">' + esc(p && !duplicate ? p.technical_scope : tpl.scope) + '</textarea></div>'
      + '<div class="span-2"><label class="label">Equipamentos / servi&ccedil;o</label><textarea class="input" rows="3" id="proposalEquipment">' + esc(p && !duplicate ? p.equipment_description : tpl.equipment) + '</textarea></div>'
      + '<div><label class="label">Obriga&ccedil;&otilde;es da IMEC</label><textarea class="input" rows="5" id="proposalContracted">' + esc(p && !duplicate ? p.contracted_obligations : tpl.contracted) + '</textarea></div><div><label class="label">Obriga&ccedil;&otilde;es do cliente</label><textarea class="input" rows="5" id="proposalClientObligations">' + esc(p && !duplicate ? p.client_obligations : tpl.client) + '</textarea></div>'
      + '<div class="span-2"><label class="label">Condi&ccedil;&otilde;es comerciais</label><textarea class="input" rows="3" id="proposalCommercial">' + esc(p && !duplicate ? p.commercial_terms : tpl.commercial) + '</textarea></div>'
      + '<div><label class="label">Pagamento</label><textarea class="input" rows="2" id="proposalPayment">' + esc(p && !duplicate ? p.payment_terms : tpl.payment) + '</textarea></div><div><label class="label">Prazo / disponibilidade</label><textarea class="input" rows="2" id="proposalDelivery">' + esc(p && !duplicate ? p.delivery_time : tpl.delivery) + '</textarea></div>'
      + '<div class="span-2"><label class="label">Garantia / observa&ccedil;&otilde;es</label><textarea class="input" rows="2" id="proposalWarranty">' + esc(p && !duplicate ? p.warranty_terms : tpl.warranty) + '</textarea></div>'
      + '<div class="span-2 proposal-upload-box"><label class="label">Anexo da proposta (PDF, Word ou Excel)</label><input type="file" class="input" id="proposalFile" accept=".pdf,.doc,.docx,.xls,.xlsx"><input type="hidden" id="proposalFileUrl" value="' + esc(p && !duplicate ? p.file_url : '') + '">' + (p && p.file_url && !duplicate ? '<p class="mt-2 text-xs"><a class="text-imec-blue font-bold" href="' + esc(p.file_url) + '" target="_blank" rel="noopener">Arquivo atual cadastrado</a></p>' : '') + '</div>'
      + '<div class="span-2"><label class="label">Notas internas</label><textarea class="input" rows="2" id="proposalNotes">' + esc(p && !duplicate ? p.notes : '') + '</textarea></div>'
      + '</div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar proposta</button></div></form></div>';
    openModal(html);
  };

  window.applyProposalTemplate = function (type) {
    var tpl = templates[type] || templates.locacao_equipamento;
    var pairs = {
      proposalTitle: tpl.title,
      proposalSummary: tpl.scope,
      proposalTechnical: tpl.scope,
      proposalEquipment: tpl.equipment,
      proposalContracted: tpl.contracted,
      proposalClientObligations: tpl.client,
      proposalCommercial: tpl.commercial,
      proposalPayment: tpl.payment,
      proposalDelivery: tpl.delivery,
      proposalWarranty: tpl.warranty
    };
    Object.keys(pairs).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.value.trim()) el.value = pairs[id];
    });
    var preview = document.getElementById('proposalAssistantPreview');
    if (preview) preview.textContent = templatePreview(type);
  };

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

  window.openProposalAssistant = function () {
    var html = '<div class="proposal-modal p-6"><h2 class="font-display text-xl font-bold text-imec-dark mb-2">Assistente de proposta IMEC</h2><p class="text-sm text-gray-500 mb-5">Escolha um modelo e use o texto-base como rascunho executivo.</p><div class="proposal-form-grid"><div><label class="label">Modelo</label><select class="input" onchange="document.getElementById(\'proposalAssistantPreview\').textContent = window.proposalTemplatePreview(this.value)"><option value="locacao_equipamento">Loca&ccedil;&atilde;o Munck / Guindaste</option><option value="manutencao_industrial">Manuten&ccedil;&atilde;o industrial</option><option value="caldeiraria">Caldeiraria / Reforma</option><option value="laudo_inspecao">Laudo / inspe&ccedil;&atilde;o</option></select></div><div style="display:flex;align-items:end"><button class="btn btn-primary" onclick="openProposalModal(null, document.querySelector(\'.proposal-modal select\').value)">' + icon('plus') + ' Criar com este modelo</button></div><div class="span-2"><div class="proposal-preview" id="proposalAssistantPreview">' + esc(templatePreview('locacao_equipamento')) + '</div></div></div><div class="flex justify-end mt-6"><button class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>';
    window.proposalTemplatePreview = templatePreview;
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
