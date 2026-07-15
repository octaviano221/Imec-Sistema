(function () {
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

  function same(a, b) {
    return String(a) === String(b);
  }

  function toDate(value) {
    if (!value) return null;
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function daysLeft(value) {
    var d = toDate(value);
    if (!d) return 9999;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d - today) / 86400000);
  }

  function fmtDate(value) {
    if (typeof formatDate === 'function') return formatDate(value);
    var d = toDate(value);
    return d ? d.toLocaleDateString('pt-BR') : '-';
  }

  function activeEmployees() {
    return (db().employees || []).filter(function (item) { return (item.status || 'ativo') === 'ativo'; });
  }

  function openItems() {
    var data = db();
    var settings = data.settings || {};
    var alertDays = Number(settings.expiration_alert_days || 30);
    var items = [];

    (data.certificates || []).forEach(function (cert) {
      if (cert.status === 'cancelado') return;
      var days = daysLeft(cert.expiration_date);
      if (days <= alertDays) {
        items.push({
          owner: cert.employee_name || '-',
          title: cert.training_name || cert.training_code || 'NR',
          type: 'NR',
          due: cert.expiration_date,
          days: days,
          page: 'certificates'
        });
      }
    });

    (data.medical_exams || []).forEach(function (exam) {
      var days = daysLeft(exam.expiration_date);
      if (days <= alertDays) {
        items.push({
          owner: exam.employee_name || '-',
          title: exam.exam_type || 'ASO',
          type: 'ASO',
          due: exam.expiration_date,
          days: days,
          page: 'aso'
        });
      }
    });

    (data.technical_documents || []).forEach(function (doc) {
      var days = daysLeft(doc.expiration_date || doc.due_date);
      if (days <= alertDays) {
        items.push({
          owner: doc.project_name || doc.client_name || '-',
          title: doc.title || doc.document_type || 'Documento tecnico',
          type: 'DOC',
          due: doc.expiration_date || doc.due_date,
          days: days,
          page: 'documents'
        });
      }
    });

    return items.sort(function (a, b) { return a.days - b.days; });
  }

  function complianceScore() {
    var employees = activeEmployees().length;
    var items = openItems();
    var expired = items.filter(function (item) { return item.days < 0; }).length;
    var warning = items.filter(function (item) { return item.days >= 0; }).length;
    var base = Math.max(employees + (db().certificates || []).length + 1, 1);
    return Math.max(0, Math.min(100, Math.round(100 - ((expired * 2 + warning) / base) * 100)));
  }

  function clientRisks() {
    var data = db();
    var projects = data.projects || [];
    var clients = data.clients || [];
    var items = openItems();
    return clients.map(function (client) {
      var clientProjects = projects.filter(function (project) { return same(project.client_id, client.id); });
      var names = clientProjects.map(function (project) { return project.name; });
      var related = items.filter(function (item) {
        return names.some(function (name) { return name && item.owner && String(item.owner).indexOf(name) >= 0; });
      });
      return {
        name: client.company_name || client.name || 'Cliente',
        projects: clientProjects.length,
        risk: related.filter(function (item) { return item.days < 0; }).length,
        warning: related.filter(function (item) { return item.days >= 0; }).length
      };
    }).sort(function (a, b) { return (b.risk * 2 + b.warning) - (a.risk * 2 + a.warning); }).slice(0, 5);
  }

  function monthlyBars() {
    var now = new Date();
    var months = [];
    for (var i = 11; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), total: 0 });
    }
    (db().certificates || []).forEach(function (cert) {
      var d = toDate(cert.issue_date || cert.created_at);
      if (!d) return;
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      var bucket = months.find(function (item) { return item.key === key; });
      if (bucket) bucket.total += 1;
    });
    var max = Math.max.apply(null, months.map(function (item) { return item.total; }).concat([1]));
    return '<div class="premium-timeline">' + months.map(function (item) {
      var height = Math.max(8, Math.round((item.total / max) * 100));
      return '<div class="premium-bar"><span style="height:' + height + 'px"></span><b>' + item.total + '</b><small>' + esc(item.label) + '</small></div>';
    }).join('') + '</div>';
  }

  function statusChip(item) {
    if (item.days < 0) return '<span class="premium-chip red">' + Math.abs(item.days) + 'd vencido</span>';
    if (item.days <= 7) return '<span class="premium-chip orange">' + item.days + 'd</span>';
    return '<span class="premium-chip green">' + item.days + 'd</span>';
  }

  function renderExecutiveBlock() {
    var items = openItems();
    var expired = items.filter(function (item) { return item.days < 0; }).length;
    var next7 = items.filter(function (item) { return item.days >= 0 && item.days <= 7; }).length;
    var score = complianceScore();
    var risks = clientRisks();
    var rows = items.slice(0, 7).map(function (item) {
      return '<div class="premium-risk-row"><div><b>' + esc(item.type + ' - ' + item.title) + '</b><small>' + esc(item.owner) + ' - ' + fmtDate(item.due) + '</small></div>' + statusChip(item) + '</div>';
    }).join('') || '<div class="text-sm text-slate-400 py-4">Nenhuma pendencia no prazo configurado.</div>';
    var riskRows = risks.map(function (item) {
      var total = item.risk + item.warning;
      var tone = item.risk ? 'red' : (item.warning ? 'orange' : 'green');
      return '<div class="premium-risk-row"><div><b>' + esc(item.name) + '</b><small>' + item.projects + ' obra(s) vinculada(s)</small></div><span class="premium-chip ' + tone + '">' + total + ' pend.</span></div>';
    }).join('') || '<div class="text-sm text-slate-400 py-4">Cadastre clientes e obras para medir risco por cliente.</div>';

    return '<section class="premium-header premium-panel suite-no-print"><div><h3>Centro executivo de conformidade</h3><p>Leitura rapida para decidir renovacoes, cobrancas e prioridades do dia.</p></div><div class="suite-action-group"><button class="btn btn-outline btn-sm" onclick="openAuditBoard()">Auditoria</button><button class="btn btn-outline btn-sm" onclick="openAttachmentVault()">Anexos</button><button class="btn btn-outline btn-sm" onclick="exportBackupJSON()">Backup</button><button class="btn btn-outline btn-sm" onclick="openPremiumActionPlan()">Plano de acao</button><button class="btn btn-primary btn-sm" onclick="navigate(\'reports\')">Relatorios</button></div></section>' +
      '<section class="premium-grid suite-no-print">' +
        '<div class="premium-card premium-panel"><div class="premium-title"><span>Saude operacional</span><span class="premium-chip ' + (score >= 85 ? 'green' : score >= 65 ? 'orange' : 'red') + '">' + score + '%</span></div><div class="premium-progress"><span style="width:' + score + '%"></span></div><div class="premium-kpi mt-4"><div><span>Vencidos</span><strong>' + expired + '</strong></div><div><span>7 dias</span><strong>' + next7 + '</strong></div><div><span>Pendencias</span><strong>' + items.length + '</strong></div></div></div>' +
        '<div class="premium-card premium-panel"><div class="premium-title"><span>Prioridades</span><button class="btn btn-outline btn-sm" onclick="openPremiumActionPlan()">Abrir</button></div>' + rows + '</div>' +
        '<div class="premium-card wide premium-panel"><div class="premium-title"><span>Risco por cliente</span><span class="text-xs text-slate-400">obras e pendencias</span></div>' + riskRows + '</div>' +
      '</section>';
  }

  window.openPremiumActionPlan = function () {
    var items = openItems();
    var html = '<div class="p-6"><div class="flex items-start justify-between gap-4 mb-5"><div><h2 class="font-display text-xl font-bold text-imec-dark">Plano de acao de vencimentos</h2><p class="text-sm text-slate-500">Ordem recomendada para renovar documentos e treinamentos.</p></div><button class="btn btn-outline btn-sm" onclick="exportPremiumActionPlan()">Exportar CSV</button></div>';
    if (!items.length) {
      html += '<div class="pro-empty"><strong>Nenhuma pendencia encontrada</strong><p>O prazo configurado nao possui itens criticos.</p></div>';
    } else {
      html += '<div class="table-container"><table><thead><tr><th>Prioridade</th><th>Tipo</th><th>Responsavel</th><th>Item</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>';
      items.forEach(function (item, index) {
        html += '<tr><td>' + (index + 1) + '</td><td>' + esc(item.type) + '</td><td>' + esc(item.owner) + '</td><td>' + esc(item.title) + '</td><td>' + fmtDate(item.due) + '</td><td>' + (item.days < 0 ? Math.abs(item.days) + ' dias vencido' : item.days + ' dias') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '<div class="flex justify-end mt-5"><button class="btn btn-primary" onclick="closeModal()">Concluir</button></div></div>';
    if (typeof openModal === 'function') openModal(html);
  };

  window.exportPremiumActionPlan = function () {
    var rows = [['Tipo', 'Responsavel', 'Item', 'Vencimento', 'Dias']];
    openItems().forEach(function (item) {
      rows.push([item.type, item.owner, item.title, fmtDate(item.due), item.days]);
    });
    var csv = rows.map(function (row) {
      return row.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'plano_acao_vencimentos.csv';
    a.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('Plano de acao exportado!', 'success');
  };

  function patchDashboard() {
    if (typeof renderers === 'undefined' || !renderers.dashboard || renderers.dashboard.__premium) return false;
    var original = renderers.dashboard;
    renderers.dashboard = async function () {
      return renderExecutiveBlock() + await original.apply(this, arguments);
    };
    renderers.dashboard.__premium = true;
    return true;
  }

  function premiumReportsStrip() {
    return '<div class="premium-panel p-4 mb-5 suite-no-print"><div class="premium-title"><span>Relatorios premium</span><span class="text-xs text-slate-400">entrega para cliente e auditoria</span></div><div class="premium-report-strip">' +
      '<button class="premium-report-button" onclick="generateReport(\'rpt_nr_expiring\')">Vencimentos 30 dias<small>NRs proximas do prazo</small></button>' +
      '<button class="premium-report-button" onclick="generateReport(\'rpt_nr_expired\')">Criticos vencidos<small>Itens fora do prazo</small></button>' +
      '<button class="premium-report-button" onclick="openPremiumActionPlan()">Plano de acao<small>Prioridade de renovacao</small></button>' +
      '<button class="premium-report-button" onclick="openServerReport && openServerReport(\'audit\')">PDF de auditoria<small>Relatorio HTML servidor</small></button>' +
      '</div></div>';
  }

  function patchReports() {
    if (typeof renderers === 'undefined' || !renderers.reports || renderers.reports.__premium) return false;
    renderers.reports.__premium = true;
    return true;
  }

  function patchCards() {
    if (typeof window.renderIdCardsPage !== 'function' || window.renderIdCardsPage.__premium) return false;
    var original = window.renderIdCardsPage;
    window.renderIdCardsPage = function () {
      var html = original.apply(this, arguments);
      var filter = '<div class="premium-panel p-4 mb-4 premium-card-filter suite-no-print"><input class="input" id="premiumCardSearch" placeholder="Buscar colaborador, CPF ou funcao" oninput="filterPremiumCards()"><select class="input" id="premiumCardStatus" onchange="filterPremiumCards()"><option value="">Todos os status</option><option value="apto">Aptos</option><option value="pendente">Pendentes</option></select><button class="btn btn-outline btn-sm" onclick="filterPremiumCards()">Filtrar</button><button class="btn btn-primary btn-sm" onclick="window.print()">Baixar PDFs</button></div>';
      setTimeout(filterPremiumCards, 120);
      return filter + html;
    };
    window.renderIdCardsPage.__premium = true;
    return true;
  }

  window.filterPremiumCards = function () {
    var search = (document.getElementById('premiumCardSearch') || {}).value || '';
    var status = (document.getElementById('premiumCardStatus') || {}).value || '';
    search = search.toLowerCase();
    document.querySelectorAll('.nr-wallet-set').forEach(function (set) {
      var text = set.textContent.toLowerCase();
      var okSearch = !search || text.indexOf(search) >= 0;
      var okStatus = !status || (status === 'apto' ? text.indexOf('apto') >= 0 : text.indexOf('pendente') >= 0);
      set.style.display = okSearch && okStatus ? '' : 'none';
    });
  };

  function boot(attempt) {
    patchDashboard();
    patchReports();
    patchCards();
    if (attempt < 50) setTimeout(function () { boot(attempt + 1); }, 180);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(0); });
  else boot(0);
})();
