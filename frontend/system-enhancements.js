(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function db() {
    return typeof getDB === 'function' ? getDB() : {};
  }

  function idEq(a, b) {
    return String(a) === String(b);
  }

  function fmtDate(value) {
    return typeof formatDate === 'function' ? formatDate(value) : (value || '-');
  }

  function fmtCpf(value) {
    return typeof formatCPF === 'function' ? formatCPF(value) : (value || '');
  }

  function badge(status) {
    return typeof statusBadge === 'function' ? statusBadge(status) : '<span class="badge badge-gray">' + esc(status) + '</span>';
  }

  function statusName(status) {
    return typeof statusLabel === 'function' ? statusLabel(status) : status;
  }

  function calc(expirationDate) {
    var data = db();
    var days = data.settings && data.settings.expiration_alert_days ? data.settings.expiration_alert_days : 30;
    return typeof calcStatus === 'function' ? calcStatus(expirationDate, days) : 'valido';
  }

  function days(expirationDate) {
    return typeof daysUntil === 'function' ? daysUntil(expirationDate) : 0;
  }

  function initials(name) {
    return String(name || 'IM')
      .split(/\s+/)
      .filter(Boolean)
      .map(function (part) { return part.charAt(0); })
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  function employeePhoto(employee) {
    if (employee && employee.photo_url) {
      return '<img src="' + esc(employee.photo_url) + '" alt="Foto de ' + esc(employee.full_name) + '" onerror="this.remove();this.parentNode.textContent=\'' + initials(employee.full_name) + '\'">';
    }
    return initials(employee && employee.full_name);
  }

  function stat(label, value, tone) {
    return '<div class="profile-stat" style="--tone:' + tone + '"><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong></div>';
  }

  function row(label, value) {
    return '<div class="profile-info-row"><span>' + esc(label) + '</span><b>' + (value == null || value === '' ? '-' : esc(value)) + '</b></div>';
  }

  function miniTable(headers, rows, empty) {
    if (!rows.length) {
      return '<div class="text-center text-slate-400 text-sm py-8">' + esc(empty || 'Nenhum registro encontrado') + '</div>';
    }
    return '<table class="profile-mini-table"><thead><tr>' + headers.map(function (h) {
      return '<th>' + esc(h) + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.map(function (cells) {
      return '<tr>' + cells.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
  }

  function getEmployeeCollections(employeeId) {
    var data = db();
    var certs = (data.certificates || []).filter(function (item) { return idEq(item.employee_id, employeeId); });
    var exams = (data.medical_exams || []).filter(function (item) { return idEq(item.employee_id, employeeId); });
    var epis = (data.epi_records || []).filter(function (item) { return idEq(item.employee_id, employeeId); });
    var docs = (data.technical_documents || []).filter(function (item) { return idEq(item.employee_id, employeeId); });
    return { certs: certs, exams: exams, epis: epis, docs: docs };
  }

  window.viewEmployeeProfile = function viewEmployeeProfile(employeeId) {
    var data = db();
    var emp = (data.employees || []).find(function (item) { return idEq(item.id, employeeId); });
    if (!emp) {
      if (typeof showToast === 'function') showToast('Funcionario nao encontrado', 'error');
      return;
    }

    var related = getEmployeeCollections(employeeId);
    var valid = related.certs.filter(function (c) { return c.status !== 'cancelado' && calc(c.expiration_date) === 'valido'; }).length;
    var expiring = related.certs.filter(function (c) { return c.status !== 'cancelado' && calc(c.expiration_date) === 'vencendo'; }).length;
    var expired = related.certs.filter(function (c) { return c.status !== 'cancelado' && calc(c.expiration_date) === 'vencido'; }).length;
    var latestAso = related.exams.slice().sort(function (a, b) { return String(b.expiration_date || '').localeCompare(String(a.expiration_date || '')); })[0];
    var asoStatus = latestAso ? calc(latestAso.expiration_date) : 'sem ASO';

    var certRows = related.certs.slice(0, 8).map(function (c) {
      var st = c.status === 'cancelado' ? 'cancelado' : calc(c.expiration_date);
      return [
        esc((c.training_code ? c.training_code + ' - ' : '') + (c.training_name || 'Treinamento')),
        esc(c.certificate_code || '-'),
        esc(fmtDate(c.expiration_date)),
        badge(st)
      ];
    });

    var examRows = related.exams.slice(0, 6).map(function (exam) {
      return [
        esc(exam.exam_type || 'ASO'),
        esc(fmtDate(exam.issue_date)),
        esc(fmtDate(exam.expiration_date)),
        badge(exam.aptitude_result || calc(exam.expiration_date))
      ];
    });

    var epiRows = related.epis.slice(0, 8).map(function (epi) {
      return [
        esc(epi.epi_name || '-'),
        esc(epi.ca_number || '-'),
        esc(epi.quantity || '1'),
        esc(fmtDate(epi.replacement_date))
      ];
    });

    var docRows = related.docs.slice(0, 6).map(function (doc) {
      var link = doc.file_url ? '<a class="text-blue-700 font-bold" href="' + esc(doc.file_url) + '" target="_blank" rel="noopener">Abrir</a>' : '-';
      return [esc(doc.title || doc.document_type || 'Documento'), esc(fmtDate(doc.expiration_date)), badge(doc.status || calc(doc.expiration_date)), link];
    });

    var actions = '<div class="profile-actions">'
      + (typeof canEdit === 'function' && canEdit() ? '<button class="btn btn-primary btn-sm" onclick="editEmployee(\'' + esc(emp.id) + '\')">Editar funcionario</button>' : '')
      + (typeof canEdit === 'function' && canEdit() ? '<button class="btn btn-outline btn-sm" onclick="editCertificate()">Nova NR</button>' : '')
      + (typeof canEdit === 'function' && canEdit() ? '<button class="btn btn-outline btn-sm" onclick="editASO()">Novo ASO</button>' : '')
      + '<button class="btn btn-outline btn-sm" onclick="navigate(\'idcards\');closeModal();">Gerar carteirinha</button>'
      + '</div>';

    var html = '<div class="profile-modal p-5">'
      + '<div class="profile-hero">'
      + '<div class="profile-avatar">' + employeePhoto(emp) + '</div>'
      + '<div><h2 class="profile-title">' + esc(emp.full_name) + '</h2><p class="profile-subtitle">' + esc(emp.role_position || 'Cargo nao informado') + ' | ' + esc(emp.department || 'Setor nao informado') + '</p><div class="mt-3">' + badge(emp.status || 'ativo') + '</div></div>'
      + actions
      + '</div>'
      + '<div class="profile-stat-grid">'
      + stat('NRs validas', valid, '#16a34a')
      + stat('NRs vencendo', expiring, '#f59e0b')
      + stat('NRs vencidas', expired, '#dc2626')
      + stat('EPI entregues', related.epis.length, '#0b6fe8')
      + '</div>'
      + '<div class="profile-grid">'
      + '<section class="profile-card"><div class="profile-card-title"><span>Dados do colaborador</span>' + badge(asoStatus) + '</div><div class="profile-info-list">'
      + row('CPF', fmtCpf(emp.cpf))
      + row('RG', emp.rg)
      + row('Nascimento', fmtDate(emp.birth_date))
      + row('Admissao', fmtDate(emp.admission_date))
      + row('Telefone', emp.phone)
      + row('E-mail', emp.email)
      + row('Endereco', emp.address)
      + row('Observacoes', emp.notes)
      + '</div></section>'
      + '<section class="profile-card"><div class="profile-card-title"><span>Resumo de conformidade</span><button class="btn btn-outline btn-sm" onclick="openEmployeeReport(\'' + esc(emp.id) + '\')">Relatorio</button></div>'
      + miniTable(['Item', 'Codigo', 'Validade', 'Status'], certRows, 'Nenhuma NR cadastrada para este funcionario')
      + '</section>'
      + '</div>'
      + '<div class="profile-grid">'
      + '<section class="profile-card"><div class="profile-card-title"><span>ASO e exames</span></div>' + miniTable(['Tipo', 'Emissao', 'Validade', 'Resultado'], examRows, 'Nenhum ASO cadastrado') + '</section>'
      + '<section class="profile-card"><div class="profile-card-title"><span>EPI e documentos</span></div>' + miniTable(['EPI', 'CA', 'Qtd', 'Troca prevista'], epiRows, 'Nenhum EPI entregue') + '</section>'
      + '</div>'
      + '<section class="profile-card mt-4"><div class="profile-card-title"><span>Anexos tecnicos vinculados</span></div>' + miniTable(['Documento', 'Validade', 'Status', 'Arquivo'], docRows, 'Nenhum anexo tecnico vinculado') + '</section>'
      + '<div class="flex justify-end mt-5"><button class="btn btn-outline" onclick="closeModal()">Fechar</button></div>'
      + '</div>';

    openModal(html);
  };

  window.openEmployeeReport = async function openEmployeeReport(employeeId) {
    if (typeof closeModal === 'function') closeModal();
    if (typeof navigate === 'function') await navigate('reports');
    setTimeout(function () {
      if (typeof window.generateReport === 'function') {
        window.generateReport('rpt_employee_profile_' + employeeId);
      }
    }, 120);
  };

  function installEmployeeRenderer() {
    if (typeof renderers === 'undefined') return false;
    renderers.employees = async function () {
      var data = db();
      var html = '<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">'
        + '<div class="flex items-center gap-3 flex-1"><div class="search-box flex-1 max-w-md"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="input" placeholder="Buscar funcionario..." id="empSearch" onkeyup="filterTable(\'empTable\',\'empSearch\')"></div>'
        + '<select class="input w-auto" id="empStatusFilter" onchange="filterTableByStatus(\'empTable\',\'empStatusFilter\',4)"><option value="">Todos</option><option value="ativo">Ativo</option><option value="afastado">Afastado</option><option value="desligado">Desligado</option></select></div>'
        + (typeof canEdit === 'function' && canEdit() ? '<button class="btn btn-primary" onclick="editEmployee()"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Novo Funcionario</button>' : '')
        + '</div>';

      html += '<div class="table-container"><table id="empTable"><thead><tr><th>Funcionario</th><th>CPF</th><th>Funcao</th><th>Setor</th><th>Status</th><th>Conformidade</th><th>Acoes</th></tr></thead><tbody>';
      (data.employees || []).forEach(function (emp) {
        var related = getEmployeeCollections(emp.id);
        var ok = related.certs.filter(function (c) { return c.status !== 'cancelado' && calc(c.expiration_date) === 'valido'; }).length;
        var bad = related.certs.filter(function (c) { return c.status !== 'cancelado' && calc(c.expiration_date) === 'vencido'; }).length;
        html += '<tr data-status="' + esc(emp.status || '') + '"><td><div class="flex items-center gap-3"><div class="profile-avatar" style="width:42px;height:42px;border-radius:14px;font-size:13px">' + employeePhoto(emp) + '</div><div><p class="font-semibold text-gray-800">' + esc(emp.full_name) + '</p><p class="text-xs text-gray-400">' + esc(emp.email || emp.phone || '') + '</p></div></div></td>'
          + '<td class="font-mono text-sm">' + esc(fmtCpf(emp.cpf)) + '</td>'
          + '<td>' + esc(emp.role_position || '') + '</td>'
          + '<td>' + esc(emp.department || '') + '</td>'
          + '<td>' + badge(emp.status || 'ativo') + '</td>'
          + '<td><span class="text-sm font-bold text-green-700">' + ok + '</span><span class="text-xs text-gray-400"> validas</span>' + (bad ? ' <span class="text-sm font-bold text-red-600">' + bad + '</span><span class="text-xs text-gray-400"> vencidas</span>' : '') + '</td>'
          + '<td><div class="flex items-center gap-1"><button class="btn btn-outline btn-sm" onclick="viewEmployeeProfile(\'' + esc(emp.id) + '\')">Perfil</button>'
          + '<button class="btn btn-outline btn-sm" onclick="viewEmployee(\'' + esc(emp.id) + '\')" title="Ver">Ver</button>'
          + (typeof canEdit === 'function' && canEdit() ? '<button class="btn btn-outline btn-sm" onclick="editEmployee(\'' + esc(emp.id) + '\')" title="Editar">Editar</button>' : '')
          + (typeof canAdmin === 'function' && canAdmin() ? '<button class="btn btn-sm text-imec-red hover:bg-red-50" onclick="deleteRecord(\'employees\',\'' + esc(emp.id) + '\',\'' + esc(emp.full_name) + '\')" title="Excluir">Excluir</button>' : '')
          + '</div></td></tr>';
      });
      html += '</tbody></table></div>';
      return html;
    };
    return true;
  }

  function qrUrl(text) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(text || location.href);
  }

  function installPublicVerification() {
    window.showPublicVerification = async function showPublicVerificationEnhanced(token) {
      var login = document.getElementById('loginScreen');
      var app = document.getElementById('appShell');
      var page = document.getElementById('publicPage');
      var form = document.getElementById('publicConsultForm');
      var result = document.getElementById('publicResult');
      if (login) login.classList.add('hidden');
      if (app) app.classList.add('hidden');
      if (page) page.classList.remove('hidden');
      if (form) form.classList.add('hidden');
      if (!result) return;
      result.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

      try {
        var data = await API.certificates.verify(token);
        var cert = data && data.certificate;
        if (!cert) throw new Error('not-found');
        var st = cert.status === 'cancelado' ? 'cancelado' : calc(cert.expiration_date);
        var tone = st === 'valido' ? '#16a34a' : (st === 'vencendo' ? '#f59e0b' : '#dc2626');
        var verifyLink = location.origin + '/verificar/' + encodeURIComponent(token);
        result.innerHTML = '<div class="verify-public-shell"><article class="verify-public-card">'
          + '<header class="verify-public-header"><div><p class="text-sm font-black uppercase tracking-widest opacity-80">IMEC Compliance Industrial</p><h2>' + esc(statusName(st)) + '</h2><p class="mt-3 text-blue-100">Consulta publica de autenticidade do certificado.</p></div><div class="verify-seal" style="background:' + tone + '">CERTIFICADO<br>' + esc(statusName(st)).toUpperCase() + '</div></header>'
          + '<div class="verify-body"><div class="verify-fields">'
          + '<div class="verify-field"><span>Funcionario</span><b>' + esc(cert.employee_name || '-') + '</b></div>'
          + '<div class="verify-field"><span>CPF</span><b>' + esc(cert.employee_cpf_masked || '-') + '</b></div>'
          + '<div class="verify-field"><span>Treinamento</span><b>' + esc((cert.training_code ? cert.training_code + ' - ' : '') + (cert.training_name || '-')) + '</b></div>'
          + '<div class="verify-field"><span>Codigo</span><b>' + esc(cert.certificate_code || '-') + '</b></div>'
          + '<div class="verify-field"><span>Emissao</span><b>' + esc(fmtDate(cert.issue_date)) + '</b></div>'
          + '<div class="verify-field"><span>Validade</span><b>' + esc(fmtDate(cert.expiration_date)) + '</b></div>'
          + '<div class="verify-field"><span>Carga horaria</span><b>' + esc(cert.workload || '-') + ' horas</b></div>'
          + '<div class="verify-field"><span>Instrutor</span><b>' + esc(cert.instructor_name || '-') + '</b></div>'
          + '<div class="verify-field"><span>Responsavel tecnico</span><b>' + esc(cert.technical_responsible || '-') + '</b></div>'
          + '<div class="verify-field"><span>CREA</span><b>' + esc(cert.crea_number || '-') + '</b></div>'
          + '</div><aside class="verify-qr-box"><img src="' + qrUrl(verifyLink) + '" alt="QR Code de verificacao"><b>Leitura QR Code</b><p class="text-xs text-slate-500">A leitura abre esta consulta publica para confirmar a autenticidade.</p><a class="btn btn-outline btn-sm" href="' + esc(verifyLink) + '">Abrir link</a></aside></div>'
          + '<div class="px-7 pb-7 text-xs text-slate-500">Documento consultado em ' + new Date().toLocaleString('pt-BR') + '. A validade depende do certificado oficial e dos registros internos da empresa.</div>'
          + '</article></div>';
      } catch (err) {
        result.innerHTML = '<div class="verify-public-shell"><div class="card p-8 text-center"><h2 class="font-display text-2xl font-bold text-gray-800 mb-2">Certificado nao encontrado</h2><p class="text-gray-500 text-sm">Este certificado nao foi localizado na base oficial da IMEC.</p></div></div>';
      }
    };
  }

  function reportRows(reportId) {
    var data = db();
    var title = 'Relatorio';
    var headers = [];
    var rows = [];

    if (reportId.indexOf('rpt_employee_profile_') === 0) {
      var employeeId = reportId.replace('rpt_employee_profile_', '');
      var emp = (data.employees || []).find(function (item) { return idEq(item.id, employeeId); });
      var related = getEmployeeCollections(employeeId);
      title = 'Dossie de conformidade - ' + (emp ? emp.full_name : 'Funcionario');
      headers = ['Area', 'Item', 'Emissao', 'Validade', 'Status'];
      related.certs.forEach(function (c) { rows.push(['NR', (c.training_code ? c.training_code + ' - ' : '') + (c.training_name || 'Treinamento'), fmtDate(c.issue_date), fmtDate(c.expiration_date), statusName(c.status === 'cancelado' ? 'cancelado' : calc(c.expiration_date))]); });
      related.exams.forEach(function (e) { rows.push(['ASO', e.exam_type || 'ASO', fmtDate(e.issue_date), fmtDate(e.expiration_date), statusName(e.aptitude_result || calc(e.expiration_date))]); });
      related.epis.forEach(function (epi) { rows.push(['EPI', (epi.epi_name || '-') + ' CA ' + (epi.ca_number || '-'), fmtDate(epi.delivery_date), fmtDate(epi.replacement_date), 'Entregue']); });
      return { title: title, headers: headers, rows: rows };
    }

    switch (reportId) {
      case 'rpt_emps':
        title = 'Funcionarios ativos';
        headers = ['Nome', 'CPF', 'Funcao', 'Setor', 'Status'];
        (data.employees || []).filter(function (e) { return e.status === 'ativo'; }).forEach(function (e) { rows.push([e.full_name, fmtCpf(e.cpf), e.role_position, e.department, statusName(e.status)]); });
        break;
      case 'rpt_certs':
        title = 'Certificados emitidos';
        headers = ['Codigo', 'Funcionario', 'Treinamento', 'Emissao', 'Validade', 'Status'];
        (data.certificates || []).forEach(function (c) { rows.push([c.certificate_code, c.employee_name || '-', (c.training_code ? c.training_code + ' - ' : '') + (c.training_name || '-'), fmtDate(c.issue_date), fmtDate(c.expiration_date), statusName(c.status === 'cancelado' ? 'cancelado' : calc(c.expiration_date))]); });
        break;
      case 'rpt_nr_expired':
        title = 'NRs vencidas';
        headers = ['Funcionario', 'Treinamento', 'Codigo', 'Validade', 'Dias'];
        (data.certificates || []).filter(function (c) { return c.status !== 'cancelado' && calc(c.expiration_date) === 'vencido'; }).forEach(function (c) { rows.push([c.employee_name || '-', c.training_name || '-', c.training_code || '-', fmtDate(c.expiration_date), Math.abs(days(c.expiration_date)) + ' dias vencido']); });
        break;
      case 'rpt_nr_expiring':
        title = 'NRs a vencer';
        headers = ['Funcionario', 'Treinamento', 'Codigo', 'Validade', 'Dias'];
        (data.certificates || []).filter(function (c) { return c.status !== 'cancelado' && calc(c.expiration_date) === 'vencendo'; }).forEach(function (c) { rows.push([c.employee_name || '-', c.training_name || '-', c.training_code || '-', fmtDate(c.expiration_date), days(c.expiration_date) + ' dias']); });
        break;
      case 'rpt_aso_expired':
        title = 'ASOs vencidos';
        headers = ['Funcionario', 'Tipo', 'Emissao', 'Validade', 'Resultado'];
        (data.medical_exams || []).filter(function (m) { return calc(m.expiration_date) === 'vencido'; }).forEach(function (m) { rows.push([m.employee_name || '-', m.exam_type || 'ASO', fmtDate(m.issue_date), fmtDate(m.expiration_date), statusName(m.aptitude_result || 'vencido')]); });
        break;
      default:
        title = 'Relatorio geral';
        headers = ['Modulo', 'Quantidade'];
        rows = [['Funcionarios', (data.employees || []).length], ['Certificados', (data.certificates || []).length], ['ASOs', (data.medical_exams || []).length], ['EPIs', (data.epi_records || []).length], ['Equipamentos', (data.equipment || []).length]];
    }

    return { title: title, headers: headers, rows: rows };
  }

  window.generateReport = function generateEnhancedReport(reportId) {
    var report = reportRows(reportId);
    var output = document.getElementById('reportOutput');
    if (!output) return;
    var now = new Date().toLocaleString('pt-BR');
    var html = '<div class="enhanced-report-sheet"><div class="enhanced-report-toolbar"><div><p class="text-xs font-black tracking-widest uppercase text-blue-700">IMEC Compliance Industrial</p><h3>' + esc(report.title) + '</h3><p class="text-xs text-slate-500 mt-1">Gerado em ' + esc(now) + '</p></div><div class="flex gap-2"><button class="btn btn-outline btn-sm" onclick="exportCSV()">Exportar CSV</button><button class="btn btn-primary btn-sm" onclick="window.print()">Imprimir / PDF</button></div></div>';
    if (!report.rows.length) {
      html += '<p class="text-gray-400 text-center py-8">Nenhum registro encontrado.</p>';
    } else {
      html += '<div class="table-container"><table><thead><tr>' + report.headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>';
      report.rows.forEach(function (rowData) {
        html += '<tr>' + rowData.map(function (cell) { return '<td class="text-sm">' + esc(cell) + '</td>'; }).join('') + '</tr>';
      });
      html += '</tbody></table></div>';
    }
    output.innerHTML = html + '</div>';
  };

  function installEditHardening() {
    if (typeof window.refreshData !== 'function' || window.refreshData.__enhancedNormalize) return;
    var originalRefresh = window.refreshData;
    window.refreshData = async function () {
      var result = await originalRefresh.apply(this, arguments);
      var data = db();
      Object.keys(data || {}).forEach(function (key) {
        if (!Array.isArray(data[key])) return;
        data[key].forEach(function (record) {
          if (record && record.id != null) record.id = String(record.id);
          ['employee_id', 'training_id', 'client_id', 'project_id', 'equipment_id'].forEach(function (field) {
            if (record && record[field] != null) record[field] = String(record[field]);
          });
        });
      });
      return result;
    };
    window.refreshData.__enhancedNormalize = true;
  }

  function boot(attempt) {
    installEditHardening();
    installPublicVerification();
    if (installEmployeeRenderer()) {
      if (typeof currentPage !== 'undefined' && currentPage === 'employees' && typeof renderPage === 'function') {
        renderPage();
      }
      return;
    }
    if (attempt < 40) setTimeout(function () { boot(attempt + 1); }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(0); });
  } else {
    boot(0);
  }
})();
