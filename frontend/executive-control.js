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

  function data() {
    return typeof getDB === 'function' ? getDB() : {};
  }

  function same(a, b) {
    return String(a) === String(b);
  }

  function fmtDate(value) {
    return typeof formatDate === 'function' ? formatDate(value) : (value || '-');
  }

  function until(value) {
    if (!value) return 9999;
    if (typeof daysUntil === 'function') return daysUntil(value);
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date - now) / 86400000);
  }

  function calc(value) {
    var db = data();
    var alertDays = db.settings && db.settings.expiration_alert_days ? db.settings.expiration_alert_days : 30;
    return typeof calcStatus === 'function' ? calcStatus(value, alertDays) : (until(value) < 0 ? 'vencido' : 'valido');
  }

  function label(status) {
    if (typeof statusLabel === 'function') return statusLabel(status);
    return status;
  }

  function badge(status) {
    if (typeof statusBadge === 'function') return statusBadge(status);
    return '<span class="badge badge-gray">' + esc(status) + '</span>';
  }

  function getEmployee(employeeId) {
    return (data().employees || []).find(function (item) { return same(item.id, employeeId); }) || {};
  }

  function getProject(projectId) {
    return (data().projects || []).find(function (item) { return same(item.id, projectId); }) || {};
  }

  function pendingRecord(kind, title, owner, dueDate, targetPage, severity, meta) {
    var days = until(dueDate);
    var finalSeverity = severity || (days < 0 ? 'critical' : 'warning');
    return {
      kind: kind,
      title: title || '-',
      owner: owner || '-',
      dueDate: dueDate || '',
      targetPage: targetPage || 'dashboard',
      severity: finalSeverity,
      days: days,
      meta: meta || ''
    };
  }

  function buildPendingItems() {
    var db = data();
    var items = [];

    (db.certificates || []).forEach(function (cert) {
      if (cert.status === 'cancelado') return;
      var st = calc(cert.expiration_date);
      if (st === 'valido') return;
      items.push(pendingRecord(
        'NR',
        (cert.training_code ? cert.training_code + ' - ' : '') + (cert.training_name || 'Treinamento'),
        cert.employee_name || getEmployee(cert.employee_id).full_name,
        cert.expiration_date,
        'certificates',
        st === 'vencido' ? 'critical' : 'warning',
        cert.certificate_code || ''
      ));
    });

    (db.medical_exams || []).forEach(function (exam) {
      var st = calc(exam.expiration_date);
      if (st === 'valido') return;
      items.push(pendingRecord(
        'ASO',
        exam.exam_type || 'ASO',
        exam.employee_name || getEmployee(exam.employee_id).full_name,
        exam.expiration_date,
        'aso',
        st === 'vencido' ? 'critical' : 'warning',
        exam.doctor_name || ''
      ));
    });

    (db.technical_documents || []).forEach(function (doc) {
      if (!doc.expiration_date) return;
      var st = calc(doc.expiration_date);
      if (st === 'valido') return;
      items.push(pendingRecord(
        'DOC',
        doc.title || doc.document_type || 'Documento tecnico',
        doc.project_name || getProject(doc.project_id).name,
        doc.expiration_date,
        'documents',
        st === 'vencido' ? 'critical' : 'warning',
        doc.document_number || ''
      ));
    });

    (db.epi_records || []).forEach(function (epi) {
      if (!epi.replacement_date) return;
      var st = calc(epi.replacement_date);
      if (st === 'valido') return;
      items.push(pendingRecord(
        'EPI',
        epi.epi_name || 'EPI',
        epi.employee_name || getEmployee(epi.employee_id).full_name,
        epi.replacement_date,
        'epi',
        st === 'vencido' ? 'critical' : 'warning',
        epi.ca_number ? 'CA ' + epi.ca_number : ''
      ));
    });

    return items.sort(function (a, b) {
      var sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] - sev[b.severity]) || (a.days - b.days);
    });
  }

  function complianceScore() {
    var pending = buildPendingItems();
    var db = data();
    var total =
      (db.certificates || []).filter(function (item) { return item.status !== 'cancelado'; }).length +
      (db.medical_exams || []).length +
      (db.technical_documents || []).filter(function (item) { return item.expiration_date; }).length +
      (db.epi_records || []).filter(function (item) { return item.replacement_date; }).length;
    if (!total) return 100;
    var penalty = pending.reduce(function (sum, item) {
      return sum + (item.severity === 'critical' ? 2 : 1);
    }, 0);
    return Math.max(0, Math.round(100 - (penalty / Math.max(total, 1)) * 100));
  }

  function daysText(item) {
    if (!item.dueDate) return 'sem validade';
    if (item.days < 0) return Math.abs(item.days) + ' dia(s) vencido';
    if (item.days === 0) return 'vence hoje';
    return item.days + ' dia(s)';
  }

  function pendingHtml(items, limit) {
    var list = (limit ? items.slice(0, limit) : items);
    if (!list.length) {
      return '<div class="text-center text-slate-400 text-sm py-8">Nenhuma pendencia critica ou vencendo.</div>';
    }
    return '<div class="exec-pending-list">' + list.map(function (item) {
      return '<button class="exec-pending-item exec-sev-' + esc(item.severity) + '" onclick="navigate(\'' + esc(item.targetPage) + '\')">'
        + '<span class="exec-pending-icon">' + esc(item.kind) + '</span>'
        + '<span><span class="exec-pending-title">' + esc(item.title) + '</span><span class="exec-pending-meta">' + esc(item.owner || '-') + (item.meta ? ' | ' + esc(item.meta) : '') + ' | validade ' + esc(fmtDate(item.dueDate)) + '</span></span>'
        + '<span class="exec-pending-days">' + esc(daysText(item)) + '</span>'
        + '</button>';
    }).join('') + '</div>';
  }

  function executiveHero() {
    var db = data();
    var items = buildPendingItems();
    var critical = items.filter(function (item) { return item.severity === 'critical'; }).length;
    var warning = items.filter(function (item) { return item.severity === 'warning'; }).length;
    var active = (db.employees || []).filter(function (item) { return (item.status || 'ativo') === 'ativo'; }).length;
    var score = complianceScore();
    return '<section class="exec-hero">'
      + '<div><p class="text-xs font-black uppercase tracking-widest text-blue-200">Controle executivo de conformidade</p><h2>Visao operacional pronta para auditoria</h2><p>O sistema cruza NRs, ASO, EPI e documentos tecnicos para mostrar vencimentos, riscos e proximas acoes em uma unica tela.</p>'
      + '<div class="exec-kpis">'
      + '<div class="exec-kpi"><small>Funcionarios ativos</small><strong>' + esc(active) + '</strong></div>'
      + '<div class="exec-kpi"><small>Pendencias criticas</small><strong>' + esc(critical) + '</strong></div>'
      + '<div class="exec-kpi"><small>Vencendo</small><strong>' + esc(warning) + '</strong></div>'
      + '<div class="exec-kpi"><small>Total monitorado</small><strong>' + esc(items.length) + '</strong></div>'
      + '</div></div>'
      + '<div class="exec-score"><div class="exec-score-ring" style="--score:' + score + '"><span>' + score + '%</span></div><div><h3 class="font-display text-xl font-black">Indice de conformidade</h3><p>Quanto menos pendencias e vencimentos, maior a pontuacao. Use a central para priorizar regularizacoes.</p><button class="btn btn-primary btn-sm mt-4" onclick="openPendingCenter()">Abrir central de pendencias</button></div></div>'
      + '</section>';
  }

  window.openPendingCenter = function openPendingCenter(filter) {
    var items = buildPendingItems();
    if (filter) items = items.filter(function (item) { return item.severity === filter || item.kind === filter; });
    var html = '<div class="p-6"><div class="exec-toolbar"><div><p class="text-xs font-black uppercase tracking-widest text-blue-700">Gestao de risco</p><h2 class="font-display text-2xl font-black text-imec-dark">Central de Pendencias</h2><p class="text-sm text-slate-500 mt-1">Itens vencidos e proximos do vencimento calculados automaticamente.</p></div><div class="flex gap-2"><button class="btn btn-outline btn-sm" onclick="exportPendingCSV()">Exportar CSV</button><button class="btn btn-primary btn-sm" onclick="generateReport(\'rpt_pending_center\');closeModal();navigate(\'reports\')">Gerar relatorio</button></div></div>'
      + '<div class="exec-filter-row mb-4"><button class="btn btn-outline btn-sm active" onclick="openPendingCenter()">Todas</button><button class="btn btn-outline btn-sm" onclick="openPendingCenter(\'critical\')">Criticas</button><button class="btn btn-outline btn-sm" onclick="openPendingCenter(\'warning\')">Vencendo</button><button class="btn btn-outline btn-sm" onclick="openPendingCenter(\'NR\')">NR</button><button class="btn btn-outline btn-sm" onclick="openPendingCenter(\'ASO\')">ASO</button><button class="btn btn-outline btn-sm" onclick="openPendingCenter(\'EPI\')">EPI</button><button class="btn btn-outline btn-sm" onclick="openPendingCenter(\'DOC\')">Documentos</button></div>'
      + pendingHtml(items)
      + '<div class="flex justify-end mt-5"><button class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>';
    openModal(html);
  };

  window.exportPendingCSV = function exportPendingCSV() {
    var rows = [['Tipo', 'Item', 'Responsavel', 'Validade', 'Dias', 'Severidade']];
    buildPendingItems().forEach(function (item) {
      rows.push([item.kind, item.title, item.owner, fmtDate(item.dueDate), daysText(item), item.severity]);
    });
    var csv = rows.map(function (row) {
      return row.map(function (cell) { return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'pendencias-imec.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  function timelineForEmployee(employeeId) {
    var db = data();
    var rows = [];
    (db.certificates || []).filter(function (item) { return same(item.employee_id, employeeId); }).forEach(function (item) {
      rows.push({ date: item.issue_date, title: 'Certificado emitido', meta: (item.training_code ? item.training_code + ' - ' : '') + (item.training_name || 'Treinamento') + ' | validade ' + fmtDate(item.expiration_date) });
    });
    (db.medical_exams || []).filter(function (item) { return same(item.employee_id, employeeId); }).forEach(function (item) {
      rows.push({ date: item.issue_date, title: 'ASO registrado', meta: (item.exam_type || 'ASO') + ' | validade ' + fmtDate(item.expiration_date) });
    });
    (db.epi_records || []).filter(function (item) { return same(item.employee_id, employeeId); }).forEach(function (item) {
      rows.push({ date: item.delivery_date, title: 'EPI entregue', meta: (item.epi_name || 'EPI') + (item.ca_number ? ' | CA ' + item.ca_number : '') });
    });
    return rows.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  }

  window.openComplianceTimeline = function openComplianceTimeline(employeeId) {
    var emp = getEmployee(employeeId);
    var rows = timelineForEmployee(employeeId);
    var body = rows.length ? '<div class="exec-timeline">' + rows.map(function (row) {
      return '<div class="exec-timeline-item"><div class="exec-timeline-date">' + esc(fmtDate(row.date)) + '</div><div><div class="exec-timeline-title">' + esc(row.title) + '</div><div class="exec-timeline-meta">' + esc(row.meta) + '</div></div></div>';
    }).join('') + '</div>' : '<div class="text-center text-slate-400 py-8">Nenhum historico encontrado para este colaborador.</div>';
    openModal('<div class="p-6"><div class="exec-panel-head"><div><p class="text-xs font-black uppercase tracking-widest text-blue-700">Dossie historico</p><h2 class="font-display text-2xl font-black text-imec-dark">' + esc(emp.full_name || 'Colaborador') + '</h2></div><button class="btn btn-primary btn-sm" onclick="openEmployeeReport(\'' + esc(employeeId) + '\')">Relatorio PDF</button></div>' + body + '<div class="flex justify-end mt-5"><button class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>');
  };

  function patchDashboard() {
    if (typeof renderers === 'undefined' || !renderers.dashboard || renderers.dashboard.__execPatched) return false;
    renderers.dashboard.__execPatched = true;
    return true;
  }

  function patchReports() {
    if (typeof renderers === 'undefined' || !renderers.reports || renderers.reports.__execPatched) return false;
    var originalReports = renderers.reports;
    renderers.reports = async function () {
      var base = await originalReports.apply(this, arguments);
      var extra = '<div class="exec-panel mb-6"><div class="exec-panel-head"><div><p class="text-xs font-black uppercase tracking-widest text-blue-700">Relatorios executivos</p><h3>Pacote de auditoria</h3></div></div><div class="grid md:grid-cols-3 gap-4"><button class="card p-5 text-left hover:border-imec-blue" onclick="generateReport(\'rpt_pending_center\')"><h4 class="font-bold text-imec-dark">Pendencias por prioridade</h4><p class="text-xs text-slate-500 mt-1">NR, ASO, EPI e documentos vencidos ou vencendo.</p></button><button class="card p-5 text-left hover:border-imec-blue" onclick="generateReport(\'rpt_project_status\')"><h4 class="font-bold text-imec-dark">Obras e documentos</h4><p class="text-xs text-slate-500 mt-1">Status das obras e controles vinculados.</p></button><button class="card p-5 text-left hover:border-imec-blue" onclick="generateReport(\'rpt_compliance_summary\')"><h4 class="font-bold text-imec-dark">Resumo gerencial</h4><p class="text-xs text-slate-500 mt-1">Indicadores para apresentar ao cliente.</p></button></div></div>';
      return extra + base;
    };
    renderers.reports.__execPatched = true;

    if (typeof window.generateReport === 'function' && !window.generateReport.__execPatched) {
      var originalGenerate = window.generateReport;
      window.generateReport = function generateExecutiveReport(reportId) {
        if (['rpt_pending_center', 'rpt_project_status', 'rpt_compliance_summary'].indexOf(reportId) < 0) {
          return originalGenerate.apply(this, arguments);
        }
        var output = document.getElementById('reportOutput');
        if (!output) return;
        var rows = [];
        var headers = [];
        var title = 'Relatorio';
        if (reportId === 'rpt_pending_center') {
          title = 'Central de pendencias de conformidade';
          headers = ['Tipo', 'Item', 'Responsavel', 'Validade', 'Prazo', 'Criticidade'];
          buildPendingItems().forEach(function (item) { rows.push([item.kind, item.title, item.owner, fmtDate(item.dueDate), daysText(item), item.severity === 'critical' ? 'Critica' : 'Atencao']); });
        } else if (reportId === 'rpt_project_status') {
          title = 'Obras e documentos';
          headers = ['Obra', 'Cliente', 'Status', 'Inicio', 'Fim'];
          (data().projects || []).forEach(function (project) { rows.push([project.name, project.client_name || '-', label(project.status || '-'), fmtDate(project.start_date), fmtDate(project.end_date)]); });
        } else {
          title = 'Resumo gerencial de conformidade';
          headers = ['Indicador', 'Resultado'];
          rows = [['Indice de conformidade', complianceScore() + '%'], ['Pendencias criticas', buildPendingItems().filter(function (item) { return item.severity === 'critical'; }).length], ['Itens vencendo', buildPendingItems().filter(function (item) { return item.severity === 'warning'; }).length], ['Funcionarios ativos', (data().employees || []).filter(function (item) { return (item.status || 'ativo') === 'ativo'; }).length], ['Certificados emitidos', (data().certificates || []).length]];
        }
        output.innerHTML = '<div class="enhanced-report-sheet"><div class="enhanced-report-toolbar"><div><p class="text-xs font-black tracking-widest uppercase text-blue-700">IMEC Compliance Industrial</p><h3>' + esc(title) + '</h3><p class="text-xs text-slate-500 mt-1">Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + '</p></div><div class="flex gap-2"><button class="btn btn-outline btn-sm" onclick="exportCSV()">Exportar CSV</button><button class="btn btn-primary btn-sm" onclick="window.print()">Imprimir / PDF</button></div></div>' + (rows.length ? '<div class="table-container"><table><thead><tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (row) { return '<tr>' + row.map(function (cell) { return '<td class="text-sm">' + esc(cell) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '<p class="text-gray-400 text-center py-8">Nenhum registro encontrado.</p>') + '</div>';
      };
      window.generateReport.__execPatched = true;
    }
    return true;
  }

  function patchEmployeeProfile() {
    if (typeof window.viewEmployeeProfile !== 'function' || window.viewEmployeeProfile.__execPatched) return false;
    var original = window.viewEmployeeProfile;
    window.viewEmployeeProfile = function (employeeId) {
      original.apply(this, arguments);
      setTimeout(function () {
        var modal = document.getElementById('modalContent');
        var actions = modal && modal.querySelector('.profile-actions');
        if (!actions || actions.querySelector('[data-exec-timeline]')) return;
        var btn = document.createElement('button');
        btn.className = 'btn btn-outline btn-sm';
        btn.type = 'button';
        btn.dataset.execTimeline = '1';
        btn.textContent = 'Historico';
        btn.onclick = function () { openComplianceTimeline(employeeId); };
        actions.appendChild(btn);
      }, 30);
    };
    window.viewEmployeeProfile.__execPatched = true;
    return true;
  }

  function patchNotifications() {
    if (typeof window.updateNotifBadge !== 'function' || window.updateNotifBadge.__execPatched) return false;
    window.updateNotifBadge = function updateExecutiveNotifBadge() {
      var badgeEl = document.getElementById('notifBadge');
      if (badgeEl) badgeEl.textContent = buildPendingItems().length;
    };
    window.updateNotifBadge.__execPatched = true;
    return true;
  }

  function qrUrl(text) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(text || location.href);
  }

  function patchPublicVerification() {
    if (typeof API === 'undefined' || !API.certificates || !API.certificates.verify || (window.showPublicVerification && window.showPublicVerification.__execPatched)) return false;
    window.showPublicVerification = async function showExecutivePublicVerification(token) {
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
        var payload = await API.certificates.verify(token);
        var cert = payload && payload.certificate;
        if (!cert) throw new Error('not-found');
        var st = cert.status === 'cancelado' ? 'cancelado' : calc(cert.expiration_date);
        var tone = st === 'valido' ? '#16a34a' : (st === 'vencendo' ? '#f59e0b' : '#dc2626');
        var verifyLink = location.origin + '/verificar/' + encodeURIComponent(token);
        result.innerHTML = '<div class="exec-public-shell"><article class="exec-public-proof"><header class="exec-public-head"><div><p class="text-xs font-black uppercase tracking-widest text-blue-200">Consulta publica de autenticidade</p><h2>' + esc(label(st)) + '</h2><p class="mt-2 text-blue-100">Registro localizado na base oficial do sistema IMEC.</p></div><div class="exec-public-seal" style="background:' + tone + '">QR<br>VALIDADO</div></header><div class="exec-public-body"><div class="exec-public-fields">'
          + '<div class="exec-public-field"><span>Funcionario</span><b>' + esc(cert.employee_name || '-') + '</b></div>'
          + '<div class="exec-public-field"><span>CPF</span><b>' + esc(cert.employee_cpf_masked || '-') + '</b></div>'
          + '<div class="exec-public-field"><span>Treinamento</span><b>' + esc((cert.training_code ? cert.training_code + ' - ' : '') + (cert.training_name || '-')) + '</b></div>'
          + '<div class="exec-public-field"><span>Codigo</span><b>' + esc(cert.certificate_code || '-') + '</b></div>'
          + '<div class="exec-public-field"><span>Emissao</span><b>' + esc(fmtDate(cert.issue_date)) + '</b></div>'
          + '<div class="exec-public-field"><span>Validade</span><b>' + esc(fmtDate(cert.expiration_date)) + '</b></div>'
          + '<div class="exec-public-field"><span>Instrutor</span><b>' + esc(cert.instructor_name || '-') + '</b></div>'
          + '<div class="exec-public-field"><span>Responsavel tecnico</span><b>' + esc(cert.technical_responsible || cert.crea_number || '-') + '</b></div>'
          + '</div><aside class="exec-public-qr"><img src="' + qrUrl(verifyLink) + '" alt="QR Code de verificacao"><b>Codigo autenticado</b><p class="text-xs text-slate-500">Consulta feita em ' + esc(new Date().toLocaleString('pt-BR')) + '.</p></aside></div></article></div>';
      } catch (err) {
        result.innerHTML = '<div class="exec-public-shell"><div class="card p-8 text-center"><h2 class="font-display text-2xl font-bold text-gray-800 mb-2">Registro nao encontrado</h2><p class="text-gray-500 text-sm">Nao localizamos este codigo na base oficial.</p></div></div>';
      }
    };
    window.showPublicVerification.__execPatched = true;
    return true;
  }

  function boot(attempt) {
    patchDashboard();
    patchReports();
    patchEmployeeProfile();
    patchNotifications();
    patchPublicVerification();
    if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderPage === 'function' && !boot.__rendered) {
      boot.__rendered = true;
      setTimeout(function () { renderPage(); }, 80);
    }
    if (attempt < 50) setTimeout(function () { boot(attempt + 1); }, 160);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(0); });
  } else {
    boot(0);
  }
})();
