(function () {
  function icon(name) {
    var icons = {
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      check: '<path d="M20 6 9 17l-5-5"/><circle cx="12" cy="12" r="10"/>',
      clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
      alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
      brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M3 13h18"/>',
      crane: '<path d="M4 20h16"/><path d="M7 20V8l10-4v16"/><path d="M7 8h12"/><path d="M13 8v12"/><path d="M19 8v4l-2 2"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
      building: '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/>',
      award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
      chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/>',
      settings: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>'
    };
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.file) + '</svg>';
  }

  function num(value) {
    return Number(value || 0).toLocaleString('pt-BR');
  }

  function metaFor(page) {
    var map = {
      employees: ['Funcionarios', 'Cadastre equipes, funcoes, setores e acompanhe documentos por colaborador.', 'users'],
      trainings: ['NRs / Treinamentos', 'Controle treinamentos obrigatorios, validade e carga horaria.', 'award'],
      certificates: ['Certificados', 'Emissao, rastreabilidade, QR Code e consulta publica em um so lugar.', 'award'],
      idcards: ['Carteirinhas', 'Identificacao profissional com consulta e rastreabilidade.', 'file'],
      aso: ['ASO', 'Acompanhe exames medicos, aptidao e vencimentos criticos.', 'brief'],
      epi: ['EPI', 'Gestao de entrega, CA, troca prevista e historico de equipamentos de protecao.', 'check'],
      equipment: ['Equipamentos', 'Inventario, patrimonio, capacidade, status e documentos tecnicos.', 'crane'],
      cranes: ['Guindastes / Munck', 'Visao dedicada para equipamentos de elevacao e movimentacao.', 'crane'],
      clients: ['Clientes', 'Base comercial e operacional para obras, certificados e documentos.', 'building'],
      projects: ['Obras', 'Operacoes em andamento, clientes, periodo e status de execucao.', 'building'],
      documents: ['ART / APR / Rigging', 'Documentos tecnicos, validade, responsaveis e rastreabilidade.', 'file'],
      matrix: ['Matriz de Competencia', 'Veja rapidamente quem esta apto por atividade e requisito.', 'check'],
      reports: ['Relatorios', 'Relatorios gerenciais prontos para conferencia e exportacao.', 'chart'],
      settings: ['Configuracoes', 'Dados da empresa, prazos de alerta e auditoria do sistema.', 'settings']
    };
    return map[page] || ['Sistema', 'Gestao integrada de compliance industrial.', 'file'];
  }

  function enhanceCurrentPage() {
    var content = document.getElementById('content');
    if (!content || typeof currentPage === 'undefined' || currentPage === 'dashboard') return;
    if (!content.querySelector('.pro-page-intro')) {
      var data = metaFor(currentPage);
      var rows = content.querySelectorAll('tbody tr').length;
      var cards = content.querySelectorAll('.card').length;
      content.insertAdjacentHTML('afterbegin',
        '<section class="pro-page-intro fade-in"><div class="pro-page-title"><div class="pro-page-icon">' + icon(data[2]) + '</div><div><h2>' + data[0] + '</h2><p>' + data[1] + '</p></div></div>'
        + '<div class="pro-page-meta"><span class="pro-pill">' + icon('chart') + num(rows) + ' registros</span><span class="pro-pill">' + icon('check') + num(cards) + ' blocos</span></div></section>'
      );
    }
    content.querySelectorAll('.table-container').forEach(function (table) {
      var tbody = table.querySelector('tbody');
      var next = table.nextElementSibling;
      if (tbody && !tbody.children.length && !(next && next.classList.contains('pro-empty'))) {
        table.insertAdjacentHTML('afterend', '<div class="pro-empty">' + icon('file') + '<div><strong>Nenhum registro encontrado</strong><p class="mt-1 text-sm">Quando voce cadastrar dados, eles aparecem aqui automaticamente.</p></div></div>');
      }
    });
  }

  function installRenderHook() {
    if (typeof renderPage !== 'function' || renderPage.__proPolishWrapped) return;
    var originalRenderPage = renderPage;
    renderPage = async function () {
      var result = await originalRenderPage.apply(this, arguments);
      setTimeout(enhanceCurrentPage, 20);
      return result;
    };
    renderPage.__proPolishWrapped = true;
  }

  function installReports() {
    if (typeof renderers === 'undefined') return false;
    renderers.reports = async function () {
      var reports = [
        ['rpt_emps', 'Funcionarios Ativos', 'Lista completa da equipe ativa no sistema.', 'users'],
        ['rpt_certs', 'Certificados Emitidos', 'Historico completo de certificados e validade.', 'award'],
        ['rpt_nr_expired', 'NRs Vencidas', 'Treinamentos fora do prazo para acao imediata.', 'alert'],
        ['rpt_nr_expiring', 'NRs a Vencer', 'Itens proximos do vencimento para planejamento.', 'clock'],
        ['rpt_aso_expired', 'ASOs Vencidos', 'Exames medicos vencidos por colaborador.', 'brief'],
        ['rpt_eq_expired', 'Equip. com Laudo Vencido', 'Equipamentos que exigem regularizacao.', 'crane']
      ];
      return '<div class="pro-report-grid">' + reports.map(function (r) {
        return '<button type="button" class="pro-report-card text-left" onclick="generateReport(\'' + r[0] + '\')">'
          + '<div class="pro-kpi-icon mb-4" style="--tone:#0b6fe8;--tone-soft:#dbeafe">' + icon(r[3]) + '</div>'
          + '<h3 class="font-display text-lg font-extrabold text-slate-900">' + r[1] + '</h3>'
          + '<p class="mt-2 text-sm text-slate-500">' + r[2] + '</p>'
          + '<span class="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600">Gerar agora ' + icon('chevron') + '</span></button>';
      }).join('') + '</div><div id="reportOutput" class="mt-6"></div>';
    };
    return true;
  }

  function initials(name) {
    return String(name || 'IM').split(' ').filter(Boolean).map(function (word) { return word[0]; }).join('').slice(0, 2).toUpperCase();
  }

  function validCertificatesFor(employeeId) {
    var db = getDB();
    var alertDays = (db.settings && db.settings.expiration_alert_days) || 30;
    return (db.certificates || []).filter(function (cert) {
      return cert.employee_id === employeeId && cert.status !== 'cancelado' && calcStatus(cert.expiration_date, alertDays) !== 'vencido';
    });
  }

  function employeeUpdatePayload(emp, photoUrl) {
    return {
      full_name: emp.full_name,
      cpf: emp.cpf,
      rg: emp.rg,
      birth_date: emp.birth_date,
      phone: emp.phone,
      email: emp.email,
      address: emp.address,
      role_position: emp.role_position,
      department: emp.department,
      admission_date: emp.admission_date,
      status: emp.status,
      notes: emp.notes,
      photo_url: photoUrl
    };
  }

  window.saveEmployeeCardPhoto = function (employeeId, input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      showToast('Selecione uma imagem valida.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Use uma foto menor que 5 MB.', 'error');
      return;
    }
    var db = getDB();
    var emp = (db.employees || []).find(function (item) { return String(item.id) === String(employeeId); });
    if (!emp) return;
    (async function () {
      try {
        var formData = new FormData();
        formData.append('file', file);
        var uploaded = await API.upload(formData);
        await API.employees.update(employeeId, employeeUpdatePayload(emp, uploaded.url));
        await refreshData();
        await renderPage();
        showToast('Foto salva na carteirinha!', 'success');
      } catch (err) {
        showToast('Erro ao salvar foto: ' + err.message, 'error');
      }
    })();
  };

  window.printEmployeeCard = function (employeeId) {
    var card = document.getElementById('nr-card-' + employeeId);
    if (!card) return;
    var printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write('<html><head><title>Carteirinha NR</title><link rel="stylesheet" href="/pro-dashboard.css"><link rel="stylesheet" href="/pro-polish.css"></head><body><div class="print-area">' + card.outerHTML + '</div><script>setTimeout(function(){window.print();window.close();},300)</script></body></html>');
    printWindow.document.close();
  };

  function renderQrCodes() {
    if (typeof QRCode === 'undefined') return;
    document.querySelectorAll('[data-nr-qr]').forEach(function (box) {
      if (box.dataset.done) return;
      box.dataset.done = '1';
      QRCode.toCanvas(box.dataset.nrQr, { width: 74, margin: 1 }, function (err, canvas) {
        if (!err) {
          box.innerHTML = '';
          box.appendChild(canvas);
        }
      });
    });
  }

  function cardHtml(emp) {
    var db = getDB();
    var settings = db.settings || {};
    var certs = validCertificatesFor(emp.id);
    var latest = certs.slice().sort(function (a, b) { return new Date(a.expiration_date) - new Date(b.expiration_date); })[0];
    var qrUrl = latest && latest.verification_token ? (window.location.origin + '/verificar/' + encodeURIComponent(latest.verification_token)) : window.location.href;
    var nrTags = certs.slice(0, 8).map(function (cert) { return '<span>' + (cert.training_code || 'NR') + '</span>'; }).join('') || '<span>Sem NR valida</span>';
    var photo = emp.photo_url ? '<img class="nr-photo" src="' + emp.photo_url + '" alt="Foto de ' + emp.full_name + '">' : '<div class="nr-photo-empty">' + initials(emp.full_name) + '</div>';
    return '<article class="nr-id-card" id="nr-card-' + emp.id + '">'
      + '<div class="nr-card-top"><div><p class="text-xs text-blue-100/80 font-bold uppercase tracking-wide">' + (settings.company_name || 'IMEC Compliance') + '</p><h3 class="font-display text-lg font-extrabold">Carteira de Qualificacao NR</h3></div><div class="text-right"><p class="text-[10px] uppercase text-blue-100/80">Status</p><p class="font-bold">' + (certs.length ? 'APTO' : 'PENDENTE') + '</p></div></div>'
      + '<div class="nr-card-body"><div class="nr-card-info">' + photo + '<div><h4 class="nr-card-name">' + emp.full_name + '</h4><div class="nr-field"><span>Funcao</span><strong>' + (emp.role_position || '-') + '</strong></div><div class="nr-field"><span>Setor</span><strong>' + (emp.department || '-') + '</strong></div></div></div>'
      + '<div class="grid grid-cols-2 gap-3 mt-3"><div class="nr-field"><span>CPF</span><strong>' + formatCPF(emp.cpf || '') + '</strong></div><div class="nr-field"><span>RG</span><strong>' + (emp.rg || '-') + '</strong></div><div class="nr-field"><span>Admissao</span><strong>' + formatDate(emp.admission_date) + '</strong></div><div class="nr-field"><span>Menor validade</span><strong>' + (latest ? formatDate(latest.expiration_date) : '-') + '</strong></div></div>'
      + '<div class="nr-field"><span>Treinamentos NR validos</span><div class="nr-list">' + nrTags + '</div></div>'
      + '<div class="nr-card-footer"><p class="text-[10px] leading-tight text-slate-500 max-w-[260px]">Documento auxiliar de identificacao e controle. A comprovacao normativa deve ser feita pelo certificado/registro completo do treinamento.</p><div class="nr-qr" data-nr-qr="' + qrUrl + '"></div></div></div></article>'
      + '<div class="nr-actions"><label class="btn btn-outline btn-sm"><input class="nr-photo-input" type="file" accept="image/*" onchange="saveEmployeeCardPhoto(\'' + emp.id + '\', this)">Adicionar foto</label><button class="btn btn-primary btn-sm" onclick="printEmployeeCard(\'' + emp.id + '\')">Baixar imagem</button></div>';
  }

  function boot() {
    installRenderHook();
    installReports();
    setTimeout(enhanceCurrentPage, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
