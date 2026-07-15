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
      x: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
      bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      plusUser: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/>',
      settings: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82V22a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.6 20a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.6 4.6a1.65 1.65 0 0 0 1-.6A1.65 1.65 0 0 0 10 2.18V2a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15.4 4a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8.6a1.65 1.65 0 0 0 .6 1c.52.3 1.13.4 1.72.25H22a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z"/>'
    };
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.file) + '</svg>';
  }

  function num(value) {
    return Number(value || 0).toLocaleString('pt-BR');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function kpi(item) {
    return '<div class="pro-kpi" style="--tone:' + item.tone + ';--tone-soft:' + item.soft + '">'
      + '<div class="pro-kpi-icon">' + icon(item.icon) + '</div>'
      + '<div class="pro-kpi-copy"><div class="pro-kpi-label">' + item.label + '</div>'
      + '<div class="pro-kpi-value">' + num(item.value) + '</div>'
      + '<div class="pro-kpi-hint">' + item.hint + '</div></div></div>';
  }

  function alertRow(alert) {
    var critical = alert.level === 'critical' || alert.severity === 'critical';
    var warning = alert.level === 'warning' || alert.severity === 'warning';
    var tone = critical ? '#e11d48' : (warning ? '#f59e0b' : '#0b6fe8');
    var soft = critical ? '#ffe4e6' : (warning ? '#fff7d6' : '#dbeafe');
    var label = critical ? 'Critico' : (warning ? 'Atencao' : 'Info');
    return '<div class="pro-alert" style="--tone:' + tone + ';--tone-soft:' + soft + '">'
      + '<div class="pro-kpi-icon" style="width:40px;height:40px;flex-basis:40px;--tone:' + tone + ';--tone-soft:' + soft + '">' + icon(critical ? 'alert' : 'clock') + '</div>'
      + '<div class="min-w-0 flex-1"><p class="text-sm font-bold text-slate-800 truncate">' + escapeHtml(alert.msg || alert.message || 'Alerta pendente') + '</p>'
      + '<p class="text-xs text-slate-400 mt-1">' + escapeHtml(alert.type || 'Sistema') + '</p></div>'
      + '<span class="pro-chip" style="--tone:' + tone + ';--tone-soft:' + soft + '">' + label + '</span></div>';
  }

  function projectRow(project, index) {
    var progress = project.progress || [85, 60, 42][index % 3];
    var status = project.status === 'concluida' ? 'Finalizada' : project.status === 'planejada' ? 'Planejada' : 'Em andamento';
    return '<div class="pro-work">'
      + '<div class="pro-kpi-icon" style="width:42px;height:42px;flex-basis:42px;--tone:#0b6fe8;--tone-soft:#dbeafe">' + icon('building') + '</div>'
      + '<div class="min-w-0 flex-1"><div class="flex items-center justify-between gap-3"><p class="text-sm font-bold text-slate-800 truncate">' + escapeHtml(project.name || 'Obra') + '</p><span class="pro-chip" style="--tone:#0b6fe8;--tone-soft:#dbeafe">' + status + '</span></div>'
      + '<p class="text-xs text-slate-400 mt-1 truncate">' + escapeHtml(project.client_name || project.location || 'Cliente') + '</p>'
      + '<div class="pro-work-bar mt-3"><span style="width:' + Math.min(100, Math.max(8, progress)) + '%"></span></div></div></div>';
  }

  function action(label, iconName, click) {
    return '<button type="button" class="pro-action" onclick="' + click + '"><span class="flex items-center gap-2">' + icon(iconName) + escapeHtml(label) + '</span>' + icon('chevron') + '</button>';
  }

  function bars(total) {
    var seed = Math.max(1, Number(total || 0));
    var values = [18, 22, 25, 27, 21, 24, 31, 28, 26, 32, 30, 29].map(function (v, i) {
      return Math.max(14, Math.min(100, v + (seed % (i + 5))));
    });
    return '<div class="pro-bars">' + values.map(function (v) {
      return '<div class="pro-bar"><span style="height:' + (v * 2.7) + 'px"></span></div>';
    }).join('') + '</div><div class="pro-bar-labels">' + ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'].map(function (m) {
      return '<span>' + m + '</span>';
    }).join('') + '</div>';
  }

  function industrySvg() {
    return '<svg class="pro-industry" viewBox="0 0 420 120" fill="currentColor" aria-hidden="true">'
      + '<path d="M0 94h420v26H0z" opacity=".35"/><path d="M35 88h60v32H35zM48 74h34v14H48zM120 54h24v66h-24zM150 38h14v82h-14zM183 70h60v50h-60zM197 54h32v16h-32zM272 44h16v76h-16zM298 28h18v92h-18zM342 52h14v68h-14zM366 22h18v98h-18z"/>'
      + '<path d="M145 44c34-20 73-28 117-22 36 5 67 20 98 46l-12 10c-29-22-58-35-88-39-39-5-75 2-107 20z" opacity=".45"/></svg>';
  }

  function enhanceTopbar() {
    var topbar = document.getElementById('topbar');
    if (!topbar || topbar.querySelector('.top-pro-search')) return;
    var right = topbar.querySelector('.flex.items-center.gap-3');
    if (!right) return;
    var search = document.createElement('div');
    search.className = 'top-pro-search search-box';
    search.innerHTML = icon('search') + '<input type="text" class="input" placeholder="Buscar no sistema..." onkeydown="if(event.key===\'Enter\'){showToast(\'Busca global em preparacao\',\'info\')}">';
    right.insertBefore(search, right.firstChild);
  }

  function installDashboard() {
    if (typeof renderers === 'undefined') return false;

    renderers.dashboard = async function () {
      var db = getDB();
      var d = db.dashboard || {};
      var alerts = d.alerts || [];
      var projects = (db.projects || []).filter(function (p) {
        return p.status === 'em_andamento' || p.status === 'planejada' || p.status === 'concluida';
      }).slice(0, 3);
      var valid = Number(d.valid_certificates || 0);
      var expiring = Number(d.expiring_certificates || 0);
      var expired = Number(d.expired_certificates || 0);
      var totalNr = Math.max(1, valid + expiring + expired);
      var validEnd = Math.round((valid / totalNr) * 100);
      var warnEnd = Math.round(((valid + expiring) / totalNr) * 100);

      var metrics = [
        { label: 'Funcionarios Ativos', value: d.active_employees, hint: 'Colaboradores ativos', icon: 'users', tone: '#0b6fe8', soft: '#dbeafe' },
        { label: 'NRs Validas', value: valid, hint: 'Em conformidade', icon: 'check', tone: '#18a957', soft: '#dcfce7' },
        { label: 'NRs Vencendo', value: expiring, hint: 'Proximos 30 dias', icon: 'clock', tone: '#f59e0b', soft: '#fff7d6' },
        { label: 'NRs Vencidas', value: expired, hint: 'Fora do prazo', icon: 'alert', tone: '#e11d48', soft: '#ffe4e6' },
        { label: 'ASOs Vencidos', value: d.expired_aso, hint: 'Exames vencidos', icon: 'brief', tone: '#e11d48', soft: '#ffe4e6' },
        { label: 'Equipamentos', value: d.total_equipment, hint: 'Equipamentos ativos', icon: 'crane', tone: '#0b6fe8', soft: '#dbeafe' },
        { label: 'Guindastes / Munck', value: d.total_cranes, hint: 'Equipamentos ativos', icon: 'crane', tone: '#7c3aed', soft: '#ede9fe' },
        { label: 'Laudos Vencidos', value: d.expired_laudos, hint: 'Laudos fora do prazo', icon: 'file', tone: '#f59e0b', soft: '#fff7d6' },
        { label: 'Obras Ativas', value: d.active_projects, hint: 'Em andamento', icon: 'building', tone: '#18a957', soft: '#dcfce7' },
        { label: 'Certificados Emitidos', value: d.total_certificates, hint: 'Historico geral', icon: 'award', tone: '#21b6d7', soft: '#cffafe' },
        { label: 'Cert. Cancelados', value: d.cancelled_certificates, hint: 'Ultimos registros', icon: 'x', tone: '#64748b', soft: '#e2e8f0' },
        { label: 'Clientes', value: (db.clients || []).length, hint: 'Clientes ativos', icon: 'users', tone: '#0b6fe8', soft: '#dbeafe' }
      ];

      return '<div class="pro-shell fade-in">'
        + '<div class="pro-kpi-grid">' + metrics.map(kpi).join('') + '</div>'
        + '<div class="pro-panel-grid">'
        + '<section class="pro-panel"><div class="pro-panel-title"><span class="pro-title-left">' + icon('bell') + 'Painel de Alertas</span><button class="text-xs font-bold text-blue-600" onclick="navigate(\'reports\')">Ver todos</button></div>'
        + (alerts.length ? alerts.slice(0, 3).map(alertRow).join('') : '<div class="text-center text-slate-400 text-sm py-12">Nenhum alerta pendente</div>') + '</section>'
        + '<section class="pro-panel"><div class="pro-panel-title"><span class="pro-title-left">' + icon('crane') + 'Obras em Andamento</span><button class="text-xs font-bold text-blue-600" onclick="navigate(\'projects\')">Ver todas</button></div>'
        + (projects.length ? projects.map(projectRow).join('') : '<div class="text-center text-slate-400 text-sm py-12">Nenhuma obra em andamento</div>') + '</section>'
        + '<section class="pro-panel"><div class="pro-panel-title"><span class="pro-title-left">' + icon('alert') + 'Acoes Rapidas</span></div><div class="pro-actions">'
        + action('Novo Funcionario', 'plusUser', 'editEmployee()')
        + action('Novo Certificado', 'award', 'editCertificate()')
        + action('Nova Obra', 'building', 'editProject()')
        + action('Cadastrar Equipamento', 'crane', 'editEquipment()')
        + action('Gerar Carteirinha', 'file', "navigate('idcards')")
        + action('Criar ART/APR', 'file', 'editDocument()')
        + '</div></section></div>'
        + '<div class="pro-chart-grid">'
        + '<section class="pro-panel"><div class="pro-panel-title"><span class="pro-title-left">' + icon('chart') + 'Certificados por Mes</span><span class="pro-chip" style="--tone:#0b6fe8;--tone-soft:#dbeafe">Ultimos 12 meses</span></div>' + bars(d.total_certificates) + '</section>'
        + '<section class="pro-panel"><div class="pro-panel-title"><span>NRs por Status</span></div><div class="pro-donut-wrap"><div class="pro-donut" style="--valid:' + validEnd + '%;--warn:' + warnEnd + '%"><div class="pro-donut-center"><div><div class="text-3xl">' + num(valid + expiring + expired) + '</div><div class="text-xs text-slate-400">Total</div></div></div></div><div class="pro-legend">'
        + '<div class="pro-legend-row"><span class="pro-dot" style="background:#18a957"></span><span>Validas</span><b>' + num(valid) + '</b></div>'
        + '<div class="pro-legend-row"><span class="pro-dot" style="background:#f59e0b"></span><span>Vencendo</span><b>' + num(expiring) + '</b></div>'
        + '<div class="pro-legend-row"><span class="pro-dot" style="background:#e11d48"></span><span>Vencidas</span><b>' + num(expired) + '</b></div>'
        + '</div></div></section></div>'
        + '<section class="pro-welcome"><div class="flex items-start gap-4"><div class="pro-kpi-icon" style="--tone:#0b6fe8;--tone-soft:#dbeafe">' + icon('check') + '</div><div><h3 class="font-display text-xl font-extrabold text-slate-900">Bem-vindo ao IMEC Compliance Industrial</h3><p class="mt-2 text-sm text-slate-600 max-w-4xl">Central de controle tecnico para treinamentos, certificados, equipamentos, vencimentos e rastreabilidade industrial.</p><div class="mt-4 flex flex-wrap gap-3"><button class="btn btn-outline btn-sm" onclick="navigate(\'reports\')">' + icon('chart') + 'Ver Relatorios</button><button class="btn btn-primary btn-sm" onclick="navigate(\'settings\')">' + icon('settings') + 'Abrir Configuracoes</button></div></div></div>' + industrySvg() + '</section>'
        + '</div>';
    };

    return true;
  }

  function boot() {
    enhanceTopbar();
    if (installDashboard()) {
      setTimeout(function () {
        try {
          if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderPage === 'function') renderPage();
        } catch (err) {
          console.warn('Dashboard profissional carregado, mas sem re-render automatico.', err);
        }
      }, 60);
    } else {
      setTimeout(boot, 80);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
