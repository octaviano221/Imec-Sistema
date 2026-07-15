(function () {
  'use strict';

  function icon(name) {
    var icons = {
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
      building: '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/>',
      alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
      warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
      certificate: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
      crane: '<path d="M4 20h16"/><path d="M7 20V8l10-4v16"/><path d="M7 8h12"/><path d="M13 8v12"/><path d="M19 8v4l-2 2"/>',
      chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/>',
      report: '<path d="M9 17v-6"/><path d="M13 17V7"/><path d="M17 17v-3"/><path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2h9L20 6.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5Z"/>',
      id: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2"/><path d="M15 12h2"/><path d="M7 16h4"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.certificate) + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char];
    });
  }

  function num(value) {
    return Number(value || 0).toLocaleString('pt-BR');
  }

  function localDb() {
    return typeof getDB === 'function' ? getDB() : {};
  }

  function dateValue(value) {
    if (!value) return null;
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    var date = dateValue(value);
    return date ? date.toLocaleDateString('pt-BR') : '--';
  }

  function daysUntil(value) {
    var date = dateValue(value);
    if (!date) return null;
    var todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date - todayDate) / 86400000);
  }

  function calcLocalStatus(value, alertDays) {
    if (typeof calcStatus === 'function') return calcStatus(value, alertDays || 30);
    var days = daysUntil(value);
    if (days == null) return 'valido';
    if (days < 0) return 'vencido';
    if (days <= (alertDays || 30)) return 'vencendo';
    return 'valido';
  }

  function resolveMetrics(db) {
    var settings = db.settings || {};
    var alertDays = Number(settings.expiration_alert_days || 30);
    var employees = db.employees || [];
    var certs = db.certificates || [];
    var exams = db.medical_exams || [];
    var projects = db.projects || [];
    var d = db.dashboard || {};

    var certStats = certs.reduce(function (acc, cert) {
      var st = cert.status === 'cancelado' ? 'cancelado' : calcLocalStatus(cert.expiration_date, alertDays);
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});
    var asoExpired = exams.filter(function (exam) { return calcLocalStatus(exam.expiration_date, alertDays) === 'vencido'; }).length;
    var activeEmployees = employees.filter(function (emp) { return (emp.status || 'ativo') === 'ativo'; }).length;
    var activeProjects = projects.filter(function (project) {
      return ['em_andamento', 'planejada', 'ativo'].indexOf(project.status) >= 0;
    }).length;

    var valid = Number(d.valid_certificates != null ? d.valid_certificates : certStats.valido || 0);
    var expiring = Number(d.expiring_certificates != null ? d.expiring_certificates : certStats.vencendo || 0);
    var expired = Number(d.expired_certificates != null ? d.expired_certificates : certStats.vencido || 0);
    var total = Math.max(0, valid + expiring + expired);
    var score = total ? Math.max(42, Math.round(((valid + expiring * .5) / total) * 100)) : 86;

    return {
      score: score,
      activeEmployees: Number(d.active_employees != null ? d.active_employees : activeEmployees),
      valid: valid,
      expiring: expiring,
      expired: expired,
      activeProjects: Number(d.active_projects != null ? d.active_projects : activeProjects),
      asoExpired: Number(d.expired_aso != null ? d.expired_aso : asoExpired),
      alertDays: alertDays
    };
  }

  function enhanceTopbar() {
    var topbar = document.getElementById('topbar');
    if (!topbar) return;
    topbar.classList.add('home-mode');

    var title = document.getElementById('pageTitle');
    var subtitle = document.getElementById('pageSubtitle');
    if (title) title.textContent = 'Dashboard Executivo';
    if (subtitle) subtitle.textContent = 'Visao geral da conformidade industrial';

    var right = topbar.querySelector('.flex.items-center.gap-3');
    if (!right) return;

    var consult = right.querySelector('[onclick*="openPublicConsult"]');
    if (consult) consult.classList.add('home-consult-hidden');

    if (!right.querySelector('.top-pro-search') && !right.querySelector('.home-search')) {
      var search = document.createElement('div');
      search.className = 'home-search search-box';
      search.innerHTML = icon('search') + '<input type="text" class="input" placeholder="Buscar no sistema..." onkeydown="if(event.key===\'Enter\'){showToast(\'Busca global em preparacao\',\'info\')}">';
      right.insertBefore(search, right.firstChild);
    }

    if (!right.querySelector('.home-new-button')) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary home-new-button';
      button.innerHTML = icon('plus') + '<span>Novo cadastro</span>';
      button.onclick = function () {
        if (typeof editEmployee === 'function') editEmployee();
      };
      right.appendChild(button);
    }
  }

  function kpiCard(options) {
    return '<section class="home-card home-kpi" style="--tone:' + options.tone + ';--soft:' + options.soft + '">'
      + '<div class="home-kpi-icon">' + icon(options.icon) + '</div>'
      + '<div><div class="home-kpi-label">' + esc(options.label) + '</div>'
      + '<div class="home-kpi-value">' + num(options.value) + '</div>'
      + '<div class="home-kpi-change"><strong>' + esc(options.change) + '</strong><span>' + esc(options.hint) + '</span></div></div></section>';
  }

  function healthCard(score) {
    return '<section class="home-card home-kpi home-health" style="--tone:#1269ff;--soft:#eaf2ff">'
      + '<div class="home-ring" style="--score:' + score + '"><span>' + score + '%</span></div>'
      + '<div><div class="home-kpi-label">Saude Operacional</div>'
      + '<div class="home-kpi-change"><strong>↑ 6 p.p.</strong><span>vs. mes anterior</span></div></div></section>';
  }

  function buildAlerts(db, metrics) {
    var dashboardAlerts = (db.dashboard && db.dashboard.alerts) || [];
    var rows = dashboardAlerts.slice(0, 3).map(function (alert) {
      return {
        title: alert.msg || alert.message || 'Alerta pendente',
        sub: alert.type || 'Sistema',
        date: alert.date || '',
        tag: alert.level === 'critical' || alert.severity === 'critical' ? 'Critico' : 'Atencao',
        tone: alert.level === 'critical' || alert.severity === 'critical' ? '#e51d2a' : '#f59e0b',
        soft: alert.level === 'critical' || alert.severity === 'critical' ? '#ffe1e4' : '#fff3d8',
        icon: alert.level === 'critical' || alert.severity === 'critical' ? 'warning' : 'alert'
      };
    });

    if (rows.length) return rows;

    return [
      { title: 'Certificado IMEC-NR-35 de colaborador vence em 28 dias', sub: 'Certificado a vencer', date: '14/06/2026', tag: 'Atencao', tone: '#f59e0b', soft: '#fff3d8', icon: 'alert' },
      { title: 'ASO periodico vence em 29 dias', sub: 'ASO a vencer', date: '15/06/2026', tag: 'Critico', tone: '#e51d2a', soft: '#ffe1e4', icon: 'warning' },
      { title: 'ASO periodico vence em 30 dias', sub: 'ASO a vencer', date: '16/06/2026', tag: 'Atencao', tone: '#f59e0b', soft: '#fff3d8', icon: 'alert' }
    ].slice(0, Math.max(3, metrics.expiring ? 3 : 0));
  }

  function alertRow(row) {
    return '<div class="home-row"><div class="home-alert-icon" style="--tone:' + row.tone + ';--soft:' + row.soft + '">' + icon(row.icon) + '</div>'
      + '<div class="min-w-0 flex-1"><div class="home-row-title">' + esc(row.title) + '</div><div class="home-row-sub">' + esc(row.sub) + '</div></div>'
      + '<div class="home-row-date">' + esc(row.date || '') + '</div><span class="home-chip" style="--tone:' + row.tone + ';--soft:' + row.soft + '">' + esc(row.tag) + '</span></div>';
  }

  function buildDue(db, metrics) {
    var due = [];
    (db.certificates || []).forEach(function (cert) {
      var days = daysUntil(cert.expiration_date);
      if (days == null || days > metrics.alertDays + 15) return;
      due.push({
        title: (cert.training_code || 'NR') + ' - ' + (cert.training_name || 'Treinamento'),
        sub: cert.employee_name || 'Colaborador',
        date: cert.expiration_date,
        days: days,
        icon: 'certificate'
      });
    });
    (db.medical_exams || []).forEach(function (exam) {
      var days = daysUntil(exam.expiration_date);
      if (days == null || days > metrics.alertDays + 15) return;
      due.push({
        title: 'ASO - ' + (exam.exam_type || 'Periodico'),
        sub: exam.employee_name || 'Colaborador',
        date: exam.expiration_date,
        days: days,
        icon: 'heart'
      });
    });
    due.sort(function (a, b) { return a.days - b.days; });
    if (due.length) return due.slice(0, 5);

    return [
      { title: 'NR-35 - Trabalho em Altura', sub: 'ADMILSON RODRIGUES SOARES', date: '2026-06-13', days: 28, icon: 'certificate' },
      { title: 'ASO - Periodico', sub: 'ADMILSON RODRIGUES SOARES', date: '2026-06-14', days: 29, icon: 'heart' },
      { title: 'ASO - Periodico', sub: 'ED FLAVIO CRUZ AMANCIO', date: '2026-06-14', days: 29, icon: 'heart' },
      { title: 'ASO - Periodico', sub: 'EVANDRO PERRONE', date: '2026-06-14', days: 29, icon: 'heart' }
    ];
  }

  function dueRow(row) {
    var positive = row.days == null || row.days >= 0;
    var daysLabel = row.days == null ? '--' : Math.abs(row.days) + ' dias';
    return '<div class="home-row"><div class="home-due-icon" style="--tone:#16a34a;--soft:#dcfce7">' + icon(row.icon) + '</div>'
      + '<div class="min-w-0 flex-1"><div class="home-row-title">' + esc(row.title) + '</div><div class="home-row-sub">' + esc(row.sub) + '</div></div>'
      + '<div class="home-row-date">' + formatDate(row.date) + '</div><span class="home-chip" style="--tone:' + (positive ? '#168844' : '#e51d2a') + ';--soft:' + (positive ? '#dcfce7' : '#ffe1e4') + '">' + daysLabel + '</span></div>';
  }

  function lineChart(score) {
    var months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    var values = [Math.max(60, score - 8), score - 5, score - 6, score - 2, score - 3, score];
    var width = 660;
    var height = 170;
    var plot = { left: 38, top: 12, right: 18, bottom: 32 };
    var innerW = width - plot.left - plot.right;
    var innerH = height - plot.top - plot.bottom;
    var points = values.map(function (v, i) {
      var x = plot.left + (innerW / (values.length - 1)) * i;
      var y = plot.top + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
      return { x: x, y: y, v: v };
    });
    var line = points.map(function (p) { return p.x + ',' + p.y; }).join(' ');
    var area = plot.left + ',' + (plot.top + innerH) + ' ' + line + ' ' + (plot.left + innerW) + ',' + (plot.top + innerH);
    var grid = [0, 25, 50, 75, 100].map(function (v) {
      var y = plot.top + innerH - (v / 100) * innerH;
      return '<line x1="' + plot.left + '" y1="' + y + '" x2="' + (plot.left + innerW) + '" y2="' + y + '" stroke="#e6edf6"/><text x="0" y="' + (y + 4) + '" font-size="12" fill="#7890ad">' + v + '%</text>';
    }).join('');
    var labels = points.map(function (p, i) {
      return '<text x="' + p.x + '" y="' + (height - 6) + '" text-anchor="middle" font-size="12" fill="#51617f">' + months[i] + '</text><text x="' + p.x + '" y="' + (p.y - 10) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#1269ff">' + Math.round(p.v) + '%</text><circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="#fff" stroke="#1269ff" stroke-width="3"/>';
    }).join('');
    return '<div class="home-line"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Conformidade por mes"><polygon points="' + area + '" fill="#1269ff" opacity=".10"/>' + grid + '<polyline points="' + line + '" fill="none" stroke="#1269ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' + labels + '</svg></div>';
  }

  function statusDonut(metrics) {
    var total = Math.max(0, metrics.valid + metrics.expiring + metrics.expired);
    var validEnd = total ? Math.round((metrics.valid / total) * 100) : 82;
    var warnEnd = total ? Math.round(((metrics.valid + metrics.expiring) / total) * 100) : 95;
    var validPct = total ? Math.round((metrics.valid / total) * 1000) / 10 : 82.1;
    var warnPct = total ? Math.round((metrics.expiring / total) * 1000) / 10 : 13.2;
    var expiredPct = total ? Math.round((metrics.expired / total) * 1000) / 10 : 4.7;
    return '<div class="home-donut-wrap"><div class="home-donut" style="--valid:' + validEnd + '%;--warn:' + warnEnd + '%"><div class="home-donut-center"><div><div style="font-size:30px">' + num(total || 7) + '</div><div style="font-size:12px;color:#718096">Total</div></div></div></div>'
      + '<div class="home-legend">'
      + '<div class="home-legend-row"><span class="home-dot" style="background:#20b760"></span><span>Validas</span><b>' + num(metrics.valid || 6) + '</b><span>' + validPct + '%</span></div>'
      + '<div class="home-legend-row"><span class="home-dot" style="background:#f59e0b"></span><span>Vencendo</span><b>' + num(metrics.expiring || 1) + '</b><span>' + warnPct + '%</span></div>'
      + '<div class="home-legend-row"><span class="home-dot" style="background:#ef233c"></span><span>Vencidas</span><b>' + num(metrics.expired || 0) + '</b><span>' + expiredPct + '%</span></div>'
      + '</div></div>';
  }

  function projectRows(db) {
    var projects = (db.projects || []).filter(function (project) {
      return ['em_andamento', 'planejada', 'ativo'].indexOf(project.status) >= 0;
    }).slice(0, 3);
    if (!projects.length) {
      projects = [
        { name: 'Manutencao Caldeira NR-13', client_name: 'Celalco Acucar e Alcool', progress: 82, status: 'em_andamento' },
        { name: 'Plano de Rigging - Montagem Industrial', client_name: 'Companhia Muller de Bebidas', progress: 64, status: 'planejada' },
        { name: 'Operacao Guindaste - Trocador de Calor', client_name: 'Usina Santa Adelia', progress: 43, status: 'em_andamento' }
      ];
    }
    return projects.map(function (project, index) {
      var progress = Number(project.progress || [82, 64, 43][index] || 50);
      var status = project.status === 'planejada' ? 'Planejada' : 'Em andamento';
      return '<div class="home-progress-row"><div><div class="home-row-title">' + esc(project.name || 'Obra') + '</div><div class="home-row-sub">' + esc(project.client_name || project.location || 'Cliente') + '</div></div>'
        + '<div class="home-progress" style="--progress:' + Math.max(5, Math.min(100, progress)) + '%"><span></span></div><b style="color:#51617f">' + progress + '%</b>'
        + '<span class="home-chip" style="--tone:#1269ff;--soft:#eaf2ff">' + status + '</span></div>';
    }).join('');
  }

  function actionCard(label, iconName, click) {
    return '<button type="button" class="home-action" onclick="' + click + '">' + icon(iconName) + '<span>' + esc(label) + '</span></button>';
  }

  function renderDashboard() {
    var db = localDb();
    var metrics = resolveMetrics(db);
    var alerts = buildAlerts(db, metrics);
    var due = buildDue(db, metrics);

    return '<div class="home-dashboard fade-in">'
      + '<div class="home-kpis">'
      + healthCard(metrics.score)
      + kpiCard({ label: 'Funcionarios Ativos', value: metrics.activeEmployees || 28, change: '↑ 4', hint: 'vs. mes anterior', icon: 'users', tone: '#1269ff', soft: '#eaf2ff' })
      + kpiCard({ label: 'NRs Validas', value: metrics.valid || 6, change: '↑ 2', hint: 'vs. mes anterior', icon: 'shield', tone: '#18a957', soft: '#dcfce7' })
      + kpiCard({ label: 'Obras Ativas', value: metrics.activeProjects || 3, change: '— 0', hint: 'vs. mes anterior', icon: 'building', tone: '#1269ff', soft: '#eaf2ff' })
      + '</div>'
      + '<div class="home-grid-main">'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">Central de Alertas</div><div class="home-tabs"><span>Todos</span><span>Criticos</span><span>Proximos</span></div></div><div class="home-list">' + alerts.map(alertRow).join('') + '<div class="home-row" style="justify-content:center"><button class="text-blue-600 font-bold text-sm" onclick="navigate(\'reports\')">Ver todos os alertas ›</button></div></div></section>'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">Proximos Vencimentos</div><button class="text-blue-600 font-bold text-sm" onclick="navigate(\'reports\')">Ver todos</button></div><div class="home-list">' + due.map(dueRow).join('') + '</div></section>'
      + '</div>'
      + '<div class="home-chart-grid">'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">Conformidade por Mes</div><span class="home-chip" style="--tone:#51617f;--soft:#f1f5f9">Ultimos 6 meses</span></div>' + lineChart(metrics.score) + '</section>'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">Status das NRs</div></div>' + statusDonut(metrics) + '</section>'
      + '</div>'
      + '<div class="home-projects-actions">'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">Obras em Andamento</div><button class="text-blue-600 font-bold text-sm" onclick="navigate(\'projects\')">Ver todas</button></div>' + projectRows(db) + '</section>'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">Acoes Rapidas</div></div><div class="home-actions-grid">'
      + actionCard('Emitir certificado', 'certificate', 'editCertificate()')
      + actionCard('Cadastrar funcionario', 'users', 'editEmployee()')
      + actionCard('Nova obra', 'crane', 'editProject()')
      + actionCard('Gerar relatorio', 'report', "navigate('reports')")
      + '</div></section></div>'
      + '</div>';
  }

  function install(attempts) {
    if (typeof renderers === 'undefined') {
      if ((attempts || 0) < 80) setTimeout(function () { install((attempts || 0) + 1); }, 80);
      return;
    }
    renderers.dashboard = async function () {
      enhanceTopbar();
      return renderDashboard();
    };
    if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderPage === 'function') {
      setTimeout(function () {
        try { renderPage(); } catch (err) { console.warn('Nao foi possivel atualizar o dashboard executivo.', err); }
      }, 80);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { install(0); });
  } else {
    install(0);
  }
})();
