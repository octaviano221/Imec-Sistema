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
      car: '<path d="M19 17h2l-1.6-5.2A3 3 0 0 0 16.5 10h-9A3 3 0 0 0 4.6 11.8L3 17h2"/><path d="M5 17h14"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M6 10l1.2-3.2A2 2 0 0 1 9.1 5h5.8a2 2 0 0 1 1.9 1.8L18 10"/>',
      chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
      report: '<path d="M9 17v-6"/><path d="M13 17V7"/><path d="M17 17v-3"/><path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2h9L20 6.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5Z"/>',
      clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M8 12h8"/><path d="M8 16h5"/>'
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
    var activeEmployees = employees.filter(function (emp) { return (emp.status || 'ativo') === 'ativo'; }).length;
    var activeProjects = projects.filter(function (project) {
      return ['em_andamento', 'planejada', 'ativo'].indexOf(project.status) >= 0;
    }).length;
    var valid = Number(d.valid_certificates != null ? d.valid_certificates : certStats.valido || 0);
    var expiring = Number(d.expiring_certificates != null ? d.expiring_certificates : certStats.vencendo || 0);
    var expired = Number(d.expired_certificates != null ? d.expired_certificates : certStats.vencido || 0);
    var total = Math.max(0, valid + expiring + expired);
    var score = total ? Math.max(42, Math.round(((valid + expiring * .5) / total) * 100)) : 93;
    return {
      score: score,
      activeEmployees: Number(d.active_employees != null ? d.active_employees : activeEmployees),
      valid: valid,
      expiring: expiring,
      expired: expired,
      activeProjects: Number(d.active_projects != null ? d.active_projects : activeProjects),
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
    if (subtitle) subtitle.textContent = 'Vis\u00e3o geral da conformidade industrial';
    var right = topbar.querySelector('.flex.items-center.gap-3');
    if (!right) return;
    var consult = right.querySelector('[onclick*="openPublicConsult"]');
    if (consult) consult.classList.add('home-consult-hidden');
    if (!right.querySelector('.top-pro-search') && !right.querySelector('.home-search')) {
      var search = document.createElement('div');
      search.className = 'home-search search-box';
      search.innerHTML = icon('search') + '<input type="text" class="input" placeholder="Buscar no sistema..." onkeydown="if(event.key===\'Enter\'){showToast(\'Busca global em prepara\\u00e7\\u00e3o\',\'info\')}">';
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
    setupAvatarMenu(right);
  }

  function setupAvatarMenu(right) {
    var avatar = document.getElementById('topAvatar');
    if (!avatar || avatar.dataset.homeMenuReady === '1') return;
    avatar.dataset.homeMenuReady = '1';
    avatar.setAttribute('role', 'button');
    avatar.setAttribute('tabindex', '0');
    avatar.setAttribute('title', 'Menu do administrador');
    avatar.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      window.toggleHomeUserMenu();
    };
    avatar.onkeydown = function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.toggleHomeUserMenu();
      }
    };
    if (!document.getElementById('homeUserMenu')) {
      var menu = document.createElement('div');
      menu.id = 'homeUserMenu';
      menu.className = 'home-user-menu hidden';
      menu.innerHTML = '<button type="button" onclick="navigate(\'settings\'); window.toggleHomeUserMenu(false)">Configura&ccedil;&otilde;es</button>'
        + '<button type="button" onclick="navigate(\'reports\'); window.toggleHomeUserMenu(false)">Relat&oacute;rios</button>'
        + '<button type="button" class="danger" onclick="handleLogout()">Sair do sistema</button>';
      right.appendChild(menu);
      document.addEventListener('click', function () { window.toggleHomeUserMenu(false); });
    }
  }

  window.toggleHomeUserMenu = function (force) {
    var menu = document.getElementById('homeUserMenu');
    if (!menu) return;
    var show = typeof force === 'boolean' ? force : menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !show);
  };

  function spark(kind, tone) {
    if (kind === 'line') {
      return '<svg class="home-sparkline" viewBox="0 0 84 42" aria-hidden="true"><path d="M2 34 C12 26 17 33 27 24 S43 26 51 15 S66 18 82 4" fill="none" stroke="' + tone + '" stroke-width="4" stroke-linecap="round"/><path d="M2 38 C16 31 24 32 34 25 S54 28 82 8 L82 42 L2 42 Z" fill="' + tone + '" opacity=".11"/></svg>';
    }
    return '<div class="home-minibars" style="--tone:' + tone + '"><span style="height:18px"></span><span style="height:30px"></span><span style="height:24px"></span><span style="height:36px"></span><span style="height:44px"></span></div>';
  }

  function kpiCard(options) {
    return '<section class="home-card home-kpi" style="--tone:' + options.tone + ';--soft:' + options.soft + '">'
      + '<div class="home-kpi-icon">' + icon(options.icon) + '</div>'
      + '<div class="home-kpi-copy"><div class="home-kpi-label">' + esc(options.label) + '</div>'
      + '<div class="home-kpi-value">' + num(options.value) + '</div>'
      + '<div class="home-kpi-change"><strong>' + esc(options.change) + '</strong><span>' + esc(options.hint) + '</span></div></div>'
      + '<div class="home-kpi-mini">' + spark(options.spark || 'bars', options.tone) + '</div></section>';
  }

  function buildAlerts(db) {
    var dashboardAlerts = (db.dashboard && db.dashboard.alerts) || [];
    var rows = dashboardAlerts.slice(0, 3).map(function (alert) {
      var critical = alert.level === 'critical' || alert.severity === 'critical';
      return {
        title: alert.msg || alert.message || 'Alerta pendente',
        sub: alert.type || 'Sistema',
        date: alert.date || '',
        tag: critical ? 'Cr&iacute;tico' : 'Aten&ccedil;&atilde;o',
        kind: critical ? 'critico' : 'proximo',
        tone: critical ? '#e51d2a' : '#f59e0b',
        soft: critical ? '#ffe1e4' : '#fff3d8',
        icon: critical ? 'warning' : 'alert'
      };
    });
    if (rows.length) return rows;
    return [
      { title: 'Certificado IMEC-NR-35 vence em 29 dias', sub: 'Certificado a vencer', date: '', tag: 'Aten&ccedil;&atilde;o', tone: '#e51d2a', soft: '#ffe1e4', icon: 'warning', kind: 'critico' },
      { title: 'ASO peri&oacute;dico vence em 30 dias', sub: 'ASO a vencer', date: '', tag: 'Aten&ccedil;&atilde;o', tone: '#f59e0b', soft: '#fff3d8', icon: 'alert', kind: 'proximo' },
      { title: 'Peri&oacute;dico de colaborador vence em 30 dias', sub: 'ASO a vencer', date: '', tag: 'Aten&ccedil;&atilde;o', tone: '#f59e0b', soft: '#fff3d8', icon: 'alert', kind: 'proximo' }
    ];
  }

  function alertRow(row) {
    return '<div class="home-row home-alert-row" data-alert-kind="' + esc(row.kind || 'proximo') + '"><div class="home-alert-icon" style="--tone:' + row.tone + ';--soft:' + row.soft + '">' + icon(row.icon) + '</div>'
      + '<div class="min-w-0 flex-1"><div class="home-row-title">' + row.title + '</div><div class="home-row-sub">' + row.sub + '</div></div>'
      + (row.date ? '<div class="home-row-date">' + esc(row.date) + '</div>' : '')
      + '<span class="home-chip" style="--tone:' + row.tone + ';--soft:' + row.soft + '">' + row.tag + '</span></div>';
  }

  window.filterHomeAlerts = function (kind, button) {
    var panel = button && button.closest ? button.closest('.home-panel') : document;
    panel.querySelectorAll('.home-tab-button').forEach(function (tab) {
      tab.classList.toggle('active', tab === button);
    });
    panel.querySelectorAll('.home-alert-row').forEach(function (row) {
      var shouldShow = kind === 'todos' || row.getAttribute('data-alert-kind') === kind;
      row.style.display = shouldShow ? '' : 'none';
    });
  };

  function buildDue(db, metrics) {
    var due = [];
    (db.certificates || []).forEach(function (cert) {
      var days = daysUntil(cert.expiration_date);
      if (days == null || days > metrics.alertDays + 15) return;
      due.push({
        type: 'NR',
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
        type: 'ASO',
        title: 'ASO - ' + (exam.exam_type || 'Peri\u00f3dico'),
        sub: exam.employee_name || 'Colaborador',
        date: exam.expiration_date,
        days: days,
        icon: 'heart'
      });
    });
    due.sort(function (a, b) { return a.days - b.days; });
    if (due.length) return due.slice(0, 5);
    return [
      { type: 'NR', title: 'NR-35 - NR-35 - Trabalho em Altura', sub: 'ADMILSON RODRIGUES SOARES', date: '2026-08-12', days: 28, icon: 'certificate' },
      { type: 'ASO', title: 'ASO - peri&oacute;dico', sub: 'ADMILSON RODRIGUES SOARES', date: '2026-08-13', days: 29, icon: 'heart' },
      { type: 'ASO', title: 'ASO - peri&oacute;dico', sub: 'ED FLAVIO CRUZ AMANCIO', date: '2026-08-13', days: 29, icon: 'heart' },
      { type: 'ASO', title: 'ASO - peri&oacute;dico', sub: 'EVANDRO PERRONE', date: '2026-08-13', days: 29, icon: 'heart' },
      { type: 'ASO', title: 'ASO - peri&oacute;dico', sub: 'HUDSON DOS SANTOS BORANGA', date: '2026-08-13', days: 29, icon: 'heart' }
    ];
  }

  function dueTable(rows) {
    return '<div class="home-due-table"><div class="home-due-head"><span>Tipo</span><span>Funcion&aacute;rio</span><span>Vencimento</span><span>Dias</span></div>'
      + rows.map(function (row) {
        var positive = row.days == null || row.days >= 0;
        var daysLabel = row.days == null ? '--' : Math.abs(row.days) + ' dias';
        return '<div class="home-due-row"><div class="home-due-type"><span class="home-due-icon" style="--tone:#16a34a;--soft:#dcfce7">' + icon(row.icon) + '</span></div>'
          + '<div class="min-w-0"><div class="home-row-title">' + row.title + '</div><div class="home-row-sub">' + esc(row.sub) + '</div></div>'
          + '<div class="home-row-date">' + formatDate(row.date) + '</div>'
          + '<span class="home-chip" style="--tone:' + (positive ? '#168844' : '#e51d2a') + ';--soft:' + (positive ? '#dcfce7' : '#ffe1e4') + '">' + daysLabel + '</span></div>';
      }).join('') + '</div>';
  }

  function lineChart(score) {
    var months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    var values = [Math.max(60, score - 8), score - 5, score - 6, score - 2, score - 3, score];
    var width = 660;
    var height = 186;
    var plot = { left: 38, top: 18, right: 18, bottom: 34 };
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
      return '<text x="' + p.x + '" y="' + (height - 7) + '" text-anchor="middle" font-size="12" fill="#51617f">' + months[i] + '</text><text x="' + p.x + '" y="' + (p.y - 10) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#1269ff">' + Math.round(p.v) + '%</text><circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="#fff" stroke="#1269ff" stroke-width="3"/>';
    }).join('');
    return '<div class="home-line"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Conformidade por mes"><polygon points="' + area + '" fill="#1269ff" opacity=".10"/>' + grid + '<polyline points="' + line + '" fill="none" stroke="#1269ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' + labels + '</svg></div>';
  }

  function statusDonut(metrics) {
    var total = Math.max(0, metrics.valid + metrics.expiring + metrics.expired);
    var validEnd = total ? Math.round((metrics.valid / total) * 100) : 86;
    var warnEnd = total ? Math.round(((metrics.valid + metrics.expiring) / total) * 100) : 96;
    var validPct = total ? Math.round((metrics.valid / total) * 1000) / 10 : 85.7;
    var warnPct = total ? Math.round((metrics.expiring / total) * 1000) / 10 : 14.3;
    var expiredPct = total ? Math.round((metrics.expired / total) * 1000) / 10 : 0;
    return '<div class="home-donut-wrap"><div class="home-donut" style="--valid:' + validEnd + '%;--warn:' + warnEnd + '%"><div class="home-donut-center"><div><div style="font-size:30px">' + num(total || 7) + '</div><div style="font-size:12px;color:#718096">Total</div></div></div></div>'
      + '<div class="home-legend">'
      + '<div class="home-legend-row"><span class="home-dot" style="background:#20b760"></span><span>V&aacute;lidas</span><b>' + num(metrics.valid || 6) + '</b><span>' + validPct + '%</span></div>'
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
        { name: 'Manuten&ccedil;&atilde;o Caldeira NR-13', client_name: 'Celalco A&ccedil;&uacute;car e &Aacute;lcool', progress: 82, status: 'em_andamento' },
        { name: 'Plano de Rigging - Montagem Industrial', client_name: 'Companhia M&uuml;ller de Bebidas', progress: 64, status: 'planejada' },
        { name: 'Opera&ccedil;&atilde;o Guindaste - Trocador de Calor', client_name: 'Usina Santa Ad&eacute;lia', progress: 43, status: 'em_andamento' }
      ];
    }
    return projects.map(function (project, index) {
      var progress = Number(project.progress || [82, 64, 43][index] || 50);
      var status = project.status === 'planejada' ? 'Planejada' : 'Em andamento';
      return '<div class="home-progress-row"><div><div class="home-row-title">' + (project.name || 'Obra') + '</div><div class="home-row-sub">' + (project.client_name || project.location || 'Cliente') + '</div></div>'
        + '<div class="home-progress" style="--progress:' + Math.max(5, Math.min(100, progress)) + '%"><span></span></div><b style="color:#51617f">' + progress + '%</b>'
        + '<span class="home-chip" style="--tone:#1269ff;--soft:#eaf2ff">' + status + '</span></div>';
    }).join('');
  }

  function isVehicleEquipment(eq) {
    var text = ((eq.type || '') + ' ' + (eq.name || '')).toLowerCase();
    return !!eq.plate || /veiculo|carro|caminh|munck|van|pickup|utilitario|utilit/.test(text);
  }

  function vehicleDocsSummary(db, metrics) {
    var vehicles = (db.equipment || []).filter(isVehicleEquipment);
    var activeVehicles = vehicles.filter(function (eq) { return (eq.status || 'ativo') === 'ativo'; }).length;
    var maintenanceVehicles = vehicles.filter(function (eq) { return eq.status === 'manutencao'; }).length;
    var inactiveVehicles = vehicles.filter(function (eq) { return eq.status === 'inativo'; }).length;
    var vehicleMap = vehicles.reduce(function (acc, eq) {
      acc[String(eq.id)] = eq;
      return acc;
    }, {});
    var docs = (db.equipment_documents || []).filter(function (doc) {
      var text = String((doc.document_type || '') + ' ' + (doc.title || '')).toLowerCase();
      return vehicleMap[String(doc.equipment_id)] || /ipva|licenciamento|crlv|seguro|antt|tacografo/.test(text);
    });
    var expired = 0;
    var expiring = 0;
    var valid = 0;
    var queue = [];
    var recent = [];
    docs.forEach(function (doc) {
      var remaining = daysUntil(doc.expiration_date);
      var status = calcLocalStatus(doc.expiration_date, metrics.alertDays);
      if (status === 'vencido') expired += 1;
      else if (status === 'vencendo') expiring += 1;
      else valid += 1;
      recent.push({
        title: doc.document_type || doc.title || 'Documento',
        vehicle: vehicleMap[String(doc.equipment_id)] ? vehicleMap[String(doc.equipment_id)].name + (vehicleMap[String(doc.equipment_id)].plate ? ' - ' + vehicleMap[String(doc.equipment_id)].plate : '') : 'Ve&iacute;culo',
        date: doc.expiration_date,
        days: remaining,
        status: status,
        file: doc.file_url || ''
      });
      if (remaining != null && remaining <= metrics.alertDays + 30) {
        queue.push({
          title: doc.document_type || doc.title || 'Documento',
          vehicle: vehicleMap[String(doc.equipment_id)] ? vehicleMap[String(doc.equipment_id)].name + (vehicleMap[String(doc.equipment_id)].plate ? ' - ' + vehicleMap[String(doc.equipment_id)].plate : '') : 'Ve&iacute;culo',
          date: doc.expiration_date,
          days: remaining,
          status: status
        });
      }
    });
    queue.sort(function (a, b) { return a.days - b.days; });
    recent.sort(function (a, b) {
      var ad = dateValue(a.date);
      var bd = dateValue(b.date);
      return (ad ? ad.getTime() : 0) - (bd ? bd.getTime() : 0);
    });
    var score = docs.length ? Math.max(0, Math.round((valid / docs.length) * 100)) : 100;
    return { vehicles: vehicles, activeVehicles: activeVehicles, maintenanceVehicles: maintenanceVehicles, inactiveVehicles: inactiveVehicles, docs: docs, expired: expired, expiring: expiring, valid: valid, queue: queue.slice(0, 4), recent: recent.slice(0, 4), score: score };
  }

  function vehicleDocDashboard(db, metrics) {
    var summary = vehicleDocsSummary(db, metrics);
    var rows = summary.queue.length ? summary.queue : summary.recent;
    var listTitle = summary.queue.length ? 'Pr&oacute;ximos vencimentos' : 'Documentos cadastrados';
    var allClear = summary.expired === 0 && summary.expiring === 0 && summary.maintenanceVehicles === 0 && summary.inactiveVehicles === 0 && summary.vehicles.length > 0;
    var statusNote = summary.maintenanceVehicles || summary.inactiveVehicles
      ? summary.maintenanceVehicles + ' em manuten&ccedil;&atilde;o &bull; ' + summary.inactiveVehicles + ' inativos'
      : 'Todos liberados para opera&ccedil;&atilde;o';
    var okMessage = allClear
      ? '<div class="home-vehicle-ok"><div class="home-vehicle-ok-icon">' + icon('shield') + '</div><div><strong>Tudo certo com a frota</strong><span>Ve&iacute;culos ativos e documentos sem vencimentos pr&oacute;ximos.</span></div><em>Operacional</em></div>'
      : '';
    var queue = rows.length ? rows.map(function (item) {
      var critical = item.status === 'vencido' || (item.days !== null && item.days !== undefined && item.days <= 7);
      var validDoc = item.status === 'valido';
      var tone = critical ? '#e51d2a' : validDoc ? '#168844' : '#f59e0b';
      var soft = critical ? '#ffe1e4' : validDoc ? '#dcfce7' : '#fff3d8';
      var label = item.days == null ? 'Sem prazo' : (item.days < 0 ? Math.abs(item.days) + 'd vencido' : item.days + ' dias');
      if (!summary.queue.length && validDoc) label = 'Cadastrado';
      return '<div class="home-vehicle-row"><div class="home-vehicle-row-icon" style="--tone:' + tone + ';--soft:' + soft + '">' + icon(critical ? 'warning' : validDoc ? 'shield' : 'calendar') + '</div><div><div class="home-row-title">' + esc(item.title) + '</div><div class="home-row-sub">' + item.vehicle + ' &bull; validade ' + formatDate(item.date) + '</div></div><span class="home-chip" style="--tone:' + tone + ';--soft:' + soft + '">' + label + '</span></div>';
    }).join('') : '<div class="home-empty">Nenhum documento de ve&iacute;culo cadastrado ainda.</div>';
    return '<section class="home-card home-panel home-vehicle-dashboard"><div class="home-panel-header"><div><div class="home-panel-title">' + icon('car') + 'Dashboard de Documentos de Ve&iacute;culos</div><p>' + listTitle + ' de IPVA, licenciamento, CRLV, seguro e ANTT.</p></div><button class="text-blue-600 font-bold text-sm" onclick="navigate(\'vehicleDocuments\')">Abrir m&oacute;dulo</button></div><div class="home-vehicle-grid"><div class="home-vehicle-score"><span>Regularidade da frota</span><strong>' + summary.score + '%</strong><div class="home-vehicle-bar"><i style="width:' + summary.score + '%"></i></div></div><div class="home-vehicle-mini status"><span>Status dos ve&iacute;culos</span><strong>' + num(summary.activeVehicles) + ' ativos</strong><small>' + statusNote + '</small></div><div class="home-vehicle-mini warn"><span>Vencendo</span><strong>' + num(summary.expiring) + '</strong></div><div class="home-vehicle-mini danger"><span>Vencidos</span><strong>' + num(summary.expired) + '</strong></div></div><div class="home-vehicle-list">' + okMessage + queue + '</div></section>';
  }

  function actionCard(label, iconName, click) {
    return '<button type="button" class="home-action" onclick="' + click + '">' + icon(iconName) + '<span>' + label + '</span></button>';
  }

  function toolbar() {
    return '<div class="home-toolbar"><button class="home-tool-button" type="button">' + icon('calendar') + '<span>&Uacute;ltimos 30 dias</span></button><button class="home-tool-button" type="button" onclick="navigate(\'reports\')">' + icon('download') + '<span>Exportar relat&oacute;rio</span></button></div>';
  }

  function allAlertItems(db, metrics) {
    var items = [];
    buildAlerts(db).forEach(function (alert) {
      items.push({
        title: alert.title,
        sub: alert.sub,
        date: alert.date || '',
        tag: alert.tag,
        kind: alert.kind || 'proximo',
        type: alert.sub && alert.sub.indexOf('ASO') >= 0 ? 'aso' : 'nr',
        tone: alert.tone,
        soft: alert.soft,
        icon: alert.icon
      });
    });
    buildDue(db, metrics).forEach(function (due) {
      var critical = due.days != null && due.days <= 7;
      var type = String(due.type || '').toLowerCase();
      items.push({
        title: due.title,
        sub: due.sub,
        date: formatDate(due.date),
        tag: due.days == null ? 'Conferir' : (due.days < 0 ? 'Vencido' : due.days + ' dias'),
        kind: critical || due.days < 0 ? 'critico' : 'proximo',
        type: type === 'aso' ? 'aso' : 'nr',
        tone: critical || due.days < 0 ? '#e51d2a' : '#f59e0b',
        soft: critical || due.days < 0 ? '#ffe1e4' : '#fff3d8',
        icon: due.icon || 'alert'
      });
    });
    var epiOpen = (db.epi_deliveries || []).filter(function (epi) {
      return !epi.return_date && !epi.returned_at && !epi.devolution_date;
    }).slice(0, 4);
    epiOpen.forEach(function (epi) {
      items.push({
        title: 'EPI entregue sem devolu\u00e7\u00e3o registrada',
        sub: (epi.employee_name || 'Funcion\u00e1rio') + ' - ' + (epi.epi_name || 'EPI'),
        date: formatDate(epi.delivery_date),
        tag: 'EPI',
        kind: 'proximo',
        type: 'epi',
        tone: '#1269ff',
        soft: '#eaf2ff',
        icon: 'shield'
      });
    });
    var vehicleIds = (db.equipment || []).filter(function (eq) {
      var text = ((eq.type || '') + ' ' + (eq.name || '')).toLowerCase();
      return !!eq.plate || /veiculo|carro|caminh|munck|van|pickup|utilitario|utilit/.test(text);
    }).reduce(function (acc, eq) {
      acc[String(eq.id)] = eq.name + (eq.plate ? ' - ' + eq.plate : '');
      return acc;
    }, {});
    (db.equipment_documents || []).forEach(function (doc) {
      var docText = String((doc.document_type || '') + ' ' + (doc.title || '')).toLowerCase();
      if (!vehicleIds[String(doc.equipment_id)] && !/ipva|licenciamento|crlv|seguro|antt|tacografo/.test(docText)) return;
      var remaining = daysUntil(doc.expiration_date);
      if (remaining == null || remaining > metrics.alertDays + 30) return;
      var criticalVehicle = remaining < 0 || remaining <= 7;
      items.push({
        title: (doc.document_type || 'Documento') + ' de ve&iacute;culo ' + (remaining < 0 ? 'vencido' : 'a vencer'),
        sub: vehicleIds[String(doc.equipment_id)] || doc.title || 'Ve&iacute;culo',
        date: formatDate(doc.expiration_date),
        tag: remaining < 0 ? 'Vencido' : remaining + ' dias',
        kind: criticalVehicle ? 'critico' : 'proximo',
        type: 'veiculos',
        tone: criticalVehicle ? '#e51d2a' : '#f59e0b',
        soft: criticalVehicle ? '#ffe1e4' : '#fff3d8',
        icon: 'calendar'
      });
    });
    return items.length ? items : [
      { title: 'Certificados e ASOs pr&oacute;ximos do vencimento', sub: 'Acompanhe os prazos dos documentos', date: '', tag: 'Aten&ccedil;&atilde;o', kind: 'proximo', type: 'nr', tone: '#f59e0b', soft: '#fff3d8', icon: 'alert' },
      { title: 'Funcion&aacute;rios sem ficha de EPI completa', sub: 'Regularizar assinatura e entrega', date: '', tag: 'EPI', kind: 'proximo', type: 'epi', tone: '#1269ff', soft: '#eaf2ff', icon: 'shield' }
    ];
  }

  function reportAlertRow(item) {
    return '<div class="reports-alert-row" data-alert-kind="' + esc(item.kind || 'proximo') + '" data-alert-type="' + esc(item.type || 'geral') + '">'
      + '<div class="home-alert-icon" style="--tone:' + item.tone + ';--soft:' + item.soft + '">' + icon(item.icon || 'alert') + '</div>'
      + '<div class="min-w-0"><div class="home-row-title">' + item.title + '</div><div class="home-row-sub">' + item.sub + '</div></div>'
      + '<div class="home-row-date">' + (item.date || '--') + '</div>'
      + '<span class="home-chip" style="--tone:' + item.tone + ';--soft:' + item.soft + '">' + item.tag + '</span>'
      + '</div>';
  }

  window.filterReportAlerts = function (kind, button) {
    var root = button && button.closest ? button.closest('.reports-alerts, .home-alert-modal') : document;
    root.querySelectorAll('.home-tab-button').forEach(function (tab) {
      tab.classList.toggle('active', tab === button);
    });
    root.querySelectorAll('.reports-alert-row').forEach(function (row) {
      var rowKind = row.getAttribute('data-alert-kind');
      var rowType = row.getAttribute('data-alert-type');
      var show = kind === 'todos' || rowKind === kind || rowType === kind;
      row.style.display = show ? '' : 'none';
    });
  };

  window.openHomeAlertCenter = function () {
    var db = localDb();
    var metrics = resolveMetrics(db);
    var items = allAlertItems(db, metrics);
    var html = '<div class="home-alert-modal p-6"><div class="reports-modal-head"><div><p class="reports-kicker">Central operacional</p><h2>Todos os alertas</h2><p>Confer&ecirc;ncia r&aacute;pida de vencimentos, pend&ecirc;ncias e itens que precisam de a&ccedil;&atilde;o.</p></div><button class="btn btn-outline btn-sm" onclick="closeModal()">Fechar</button></div>'
      + '<div class="home-tabs reports-tabs"><button type="button" class="home-tab-button active" onclick="filterReportAlerts(\'todos\', this)">Todos</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'critico\', this)">Cr&iacute;ticos</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'proximo\', this)">Pr&oacute;ximos</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'nr\', this)">NR</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'aso\', this)">ASO</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'epi\', this)">EPI</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'veiculos\', this)">Ve&iacute;culos</button></div>'
      + '<div class="reports-alert-list">' + items.map(reportAlertRow).join('') + '</div>'
      + '<div class="reports-modal-actions"><button class="btn btn-outline" onclick="closeModal();navigate(\'reports\');setTimeout(function(){generateReport(\'rpt_pending_center\')},180)">Gerar relat&oacute;rio de pend&ecirc;ncias</button><button class="btn btn-primary" onclick="closeModal();navigate(\'reports\')">Abrir Central de Relat&oacute;rios</button></div></div>';
    if (typeof openModal === 'function') openModal(html);
  };

  function reportMiniCard(label, value, iconName, tone, hint) {
    return '<section class="reports-mini-card" style="--tone:' + tone + '"><div>' + icon(iconName) + '</div><span>' + label + '</span><strong>' + value + '</strong><small>' + hint + '</small></section>';
  }

  function reportCard(id, title, desc, iconName, tag) {
    return '<button type="button" class="reports-card" onclick="generateReport(\'' + id + '\')"><div class="reports-card-icon">' + icon(iconName) + '</div><div><span>' + tag + '</span><h3>' + title + '</h3><p>' + desc + '</p></div><b>Gerar agora &rsaquo;</b></button>';
  }

  function reportNavCard(page, title, desc, iconName, tag) {
    return '<button type="button" class="reports-card" onclick="navigate(\'' + page + '\')"><div class="reports-card-icon">' + icon(iconName) + '</div><div><span>' + tag + '</span><h3>' + title + '</h3><p>' + desc + '</p></div><b>Abrir m&oacute;dulo &rsaquo;</b></button>';
  }

  function renderReportsPage() {
    var db = localDb();
    var metrics = resolveMetrics(db);
    var items = allAlertItems(db, metrics);
    var critical = items.filter(function (item) { return item.kind === 'critico'; }).length;
    var expiring = items.filter(function (item) { return item.kind === 'proximo'; }).length;
    return '<div class="reports-dashboard fade-in">'
      + '<section class="reports-hero home-card"><div><p class="reports-kicker">Relat&oacute;rios executivos</p><h2>Central de auditoria e alertas</h2><p>Uma tela para acompanhar pend&ecirc;ncias, gerar documentos para cliente e conferir o que precisa de regulariza&ccedil;&atilde;o.</p></div><div class="reports-hero-actions"><button class="btn btn-outline" onclick="openHomeAlertCenter()">Ver alertas</button><button class="btn btn-primary" onclick="generateReport(\'rpt_compliance_summary\')">Resumo gerencial</button></div></section>'
      + '<div class="reports-kpis">'
      + reportMiniCard('Alertas cr&iacute;ticos', num(critical), 'warning', '#e51d2a', 'exigem a&ccedil;&atilde;o')
      + reportMiniCard('Pr&oacute;ximos prazos', num(expiring), 'calendar', '#f59e0b', 'vencendo')
      + reportMiniCard('Funcion&aacute;rios ativos', num(metrics.activeEmployees || 0), 'users', '#1269ff', 'base atual')
      + reportMiniCard('Conformidade', (metrics.score || 0) + '%', 'shield', '#18a957', 'vis&atilde;o geral')
      + '</div>'
      + '<section class="reports-alerts home-card"><div class="reports-section-head"><div><h2>Central de Alertas</h2><p>Filtre por prioridade ou tipo antes de gerar o relat&oacute;rio.</p></div><div class="home-tabs reports-tabs"><button type="button" class="home-tab-button active" onclick="filterReportAlerts(\'todos\', this)">Todos</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'critico\', this)">Cr&iacute;ticos</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'proximo\', this)">Pr&oacute;ximos</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'nr\', this)">NR</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'aso\', this)">ASO</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'epi\', this)">EPI</button><button type="button" class="home-tab-button" onclick="filterReportAlerts(\'veiculos\', this)">Ve&iacute;culos</button></div></div><div class="reports-alert-list">' + items.map(reportAlertRow).join('') + '</div></section>'
      + '<section class="reports-section"><div class="reports-section-head"><div><h2>Pacote de relat&oacute;rios</h2><p>Modelos prontos para auditoria, obra, vencimentos e gest&atilde;o interna.</p></div><button class="btn btn-outline btn-sm" onclick="window.print()">Imprimir tela</button></div><div class="reports-card-grid">'
      + reportCard('rpt_pending_center', 'Pend&ecirc;ncias por prioridade', 'NR, ASO, EPI e documentos vencidos ou pr&oacute;ximos.', 'warning', 'Auditoria')
      + reportCard('rpt_compliance_summary', 'Resumo gerencial', 'Indicadores consolidados para apresentar ao cliente.', 'chart', 'Executivo')
      + reportCard('rpt_project_status', 'Obras e documentos', 'Status das obras, ART, APR, rigging e controles vinculados.', 'building', 'Opera&ccedil;&otilde;es')
      + reportCard('rpt_emps', 'Funcion&aacute;rios ativos', 'Lista completa da equipe ativa com fun&ccedil;&atilde;o e setor.', 'users', 'Pessoas')
      + reportCard('rpt_certs', 'Certificados emitidos', 'Hist&oacute;rico completo de certificados e validade.', 'certificate', 'NR')
      + reportCard('rpt_nr_expiring', 'NRs a vencer', 'Treinamentos pr&oacute;ximos do vencimento para planejamento.', 'calendar', 'Vencimentos')
      + reportCard('rpt_nr_expired', 'NRs vencidas', 'Itens fora do prazo para a&ccedil;&atilde;o imediata.', 'alert', 'Cr&iacute;tico')
      + reportCard('rpt_aso_expired', 'ASOs vencidos', 'Exames m&eacute;dicos vencidos por colaborador.', 'heart', 'Sa&uacute;de')
      + reportCard('rpt_eq_expired', 'Equipamentos com laudo vencido', 'Equipamentos que exigem regulariza&ccedil;&atilde;o.', 'crane', 'Equipamentos')
      + reportNavCard('vehicleDocuments', 'Documentos de ve&iacute;culos', 'Fila de IPVA, licenciamento, CRLV, seguro e ANTT.', 'certificate', 'Frota')
      + '</div></section><div id="reportOutput" class="mt-6"></div></div>';
  }

  function renderDashboard() {
    var db = localDb();
    var metrics = resolveMetrics(db);
    var alerts = buildAlerts(db);
    var due = buildDue(db, metrics);
    return '<div class="home-dashboard fade-in">'
      + toolbar()
      + '<div class="home-kpis">'
      + kpiCard({ label: 'Conformidade Geral', value: metrics.score, change: '+6 p.p.', hint: 'vs. m\u00eas anterior', icon: 'shield', tone: '#1269ff', soft: '#eaf2ff', spark: 'line' })
      + kpiCard({ label: 'Funcion\u00e1rios Ativos', value: metrics.activeEmployees || 28, change: '+4', hint: 'vs. m\u00eas anterior', icon: 'users', tone: '#1269ff', soft: '#eaf2ff', spark: 'bars' })
      + kpiCard({ label: 'NRs V\u00e1lidas', value: metrics.valid || 6, change: '+2', hint: 'vs. m\u00eas anterior', icon: 'shield', tone: '#18a957', soft: '#dcfce7', spark: 'bars' })
      + kpiCard({ label: 'Obras Ativas', value: metrics.activeProjects || 3, change: '0', hint: 'vs. m\u00eas anterior', icon: 'building', tone: '#1269ff', soft: '#eaf2ff', spark: 'bars' })
      + '</div>'
      + '<div class="home-grid-main">'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">' + icon('warning') + 'Central de Alertas</div><div class="home-tabs"><button type="button" class="home-tab-button active" onclick="filterHomeAlerts(\'todos\', this)">Todos</button><button type="button" class="home-tab-button" onclick="filterHomeAlerts(\'critico\', this)">Cr&iacute;ticos</button><button type="button" class="home-tab-button" onclick="filterHomeAlerts(\'proximo\', this)">Pr&oacute;ximos</button></div></div><div class="home-list">' + alerts.map(alertRow).join('') + '<div class="home-row" style="justify-content:center"><button class="text-blue-600 font-bold text-sm" onclick="openHomeAlertCenter()">Ver todos os alertas &rsaquo;</button></div></div></section>'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">' + icon('calendar') + 'Pr&oacute;ximos Vencimentos</div><button class="text-blue-600 font-bold text-sm" onclick="navigate(\'reports\')">Ver todos</button></div>' + dueTable(due) + '</section>'
      + '</div>'
      + '<div class="home-chart-grid">'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">' + icon('chart') + 'Conformidade por M&ecirc;s</div><span class="home-chip" style="--tone:#51617f;--soft:#f1f5f9">&Uacute;ltimos 6 meses</span></div>' + lineChart(metrics.score) + '</section>'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">' + icon('shield') + 'Status das NRs</div></div>' + statusDonut(metrics) + '</section>'
      + '</div>'
      + vehicleDocDashboard(db, metrics)
      + '<div class="home-projects-actions">'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">' + icon('building') + 'Obras em Andamento</div><button class="text-blue-600 font-bold text-sm" onclick="navigate(\'projects\')">Ver todas</button></div>' + projectRows(db) + '</section>'
      + '<section class="home-card home-panel"><div class="home-panel-header"><div class="home-panel-title">' + icon('alert') + 'A&ccedil;&otilde;es R&aacute;pidas</div></div><div class="home-actions-grid">'
      + actionCard('Emitir certificado', 'certificate', 'editCertificate()')
      + actionCard('Cadastrar funcion&aacute;rio', 'users', 'editEmployee()')
      + actionCard('Nova obra', 'crane', 'editProject()')
      + actionCard('Docs. ve&iacute;culos', 'certificate', "navigate('vehicleDocuments')")
      + '</div></section></div>'
      + '</div>';
  }

  function install(attempts) {
    if (typeof renderers === 'undefined') {
      if ((attempts || 0) < 80) setTimeout(function () { install((attempts || 0) + 1); }, 80);
      return;
    }
    var homeDashboardRenderer = async function () {
      enhanceTopbar();
      return renderDashboard();
    };
    homeDashboardRenderer.__homeDashboard = true;
    homeDashboardRenderer.__premium = true;
    homeDashboardRenderer.__execPatched = true;
    homeDashboardRenderer.__suiteTools = true;
    renderers.dashboard = homeDashboardRenderer;

    var homeReportsRenderer = async function () {
      enhanceTopbar();
      var title = document.getElementById('pageTitle');
      var subtitle = document.getElementById('pageSubtitle');
      if (title) title.textContent = 'Relat\u00f3rios Executivos';
      if (subtitle) subtitle.textContent = 'Central de alertas, auditoria e exporta\u00e7\u00f5es';
      return renderReportsPage();
    };
    homeReportsRenderer.__homeReports = true;
    homeReportsRenderer.__premium = true;
    homeReportsRenderer.__execPatched = true;
    homeReportsRenderer.__suiteTools = true;
    renderers.reports = homeReportsRenderer;

    if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderPage === 'function') {
      [80, 360, 900].forEach(function (delay) {
        setTimeout(function () {
          try {
            if (renderers.dashboard !== homeDashboardRenderer) renderers.dashboard = homeDashboardRenderer;
            if (currentPage === 'dashboard') renderPage();
          } catch (err) {
            console.warn('Nao foi possivel atualizar o dashboard executivo.', err);
          }
        }, delay);
      });
    }
    if (typeof currentPage !== 'undefined' && currentPage === 'reports' && typeof renderPage === 'function') {
      [80, 360, 900].forEach(function (delay) {
        setTimeout(function () {
          try {
            if (renderers.reports !== homeReportsRenderer) renderers.reports = homeReportsRenderer;
            if (currentPage === 'reports') renderPage();
          } catch (err) {
            console.warn('Nao foi possivel atualizar os relatorios executivos.', err);
          }
        }, delay);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { install(0); });
  } else {
    install(0);
  }
})();
