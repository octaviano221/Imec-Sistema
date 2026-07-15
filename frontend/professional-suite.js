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

  function same(a, b) {
    return String(a) === String(b);
  }

  function fmtDate(value) {
    return typeof formatDate === 'function' ? formatDate(value) : (value || '-');
  }

  function calc(value) {
    var data = db();
    var days = data.settings && data.settings.expiration_alert_days ? data.settings.expiration_alert_days : 30;
    return typeof calcStatus === 'function' ? calcStatus(value, days) : 'valido';
  }

  function find(collection, id) {
    return (db()[collection] || []).find(function (item) { return same(item.id, id); }) || {};
  }

  function collectionForApi(groupName) {
    return {
      employees: 'employees',
      trainings: 'trainings',
      certificates: 'certificates',
      medicalExams: 'medical_exams',
      epi: 'epi_records',
      equipment: 'equipment',
      clients: 'clients',
      projects: 'projects',
      technicalDocuments: 'technical_documents',
      competency: 'competency_requirements'
    }[groupName];
  }

  function patchUpdatePreservation() {
    if (typeof API === 'undefined' || API.__suitePreserve) return false;
    Object.keys(API).forEach(function (groupName) {
      var group = API[groupName];
      var collection = collectionForApi(groupName);
      if (!group || !collection || typeof group.update !== 'function' || group.update.__suitePreserve) return;
      var original = group.update;
      group.update = function (id, payload) {
        var oldRecord = find(collection, id);
        var merged = Object.assign({}, oldRecord, payload || {});
        delete merged.created_at;
        delete merged.updated_at;
        return original.call(this, id, merged);
      };
      group.update.__suitePreserve = true;
    });
    API.__suitePreserve = true;
    return true;
  }

  function ensureApiExtensions() {
    if (typeof API === 'undefined' || API.__suiteApiExtensions) return false;
    API.auth.changePassword = function (payload) {
      return apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify(payload) });
    };
    API.notifications = {
      pending: function () { return apiFetch('/api/notifications/pending'); },
      sendTest: function (payload) { return apiFetch('/api/notifications/send-test', { method: 'POST', body: JSON.stringify(payload || {}) }); }
    };
    API.reportsServer = {
      auditHtml: function () { return API_BASE + '/api/reports/audit/html'; },
      employeeHtml: function (id) { return API_BASE + '/api/reports/employee/' + encodeURIComponent(id) + '/html'; }
    };
    API.__suiteApiExtensions = true;
    return true;
  }

  function getPendingItems() {
    var items = [];
    var data = db();
    (data.certificates || []).forEach(function (cert) {
      if (cert.status !== 'cancelado' && calc(cert.expiration_date) !== 'valido') {
        items.push({ type: 'NR', name: cert.training_name || cert.training_code || 'Treinamento', owner: cert.employee_name || '-', due: cert.expiration_date, page: 'certificates' });
      }
    });
    (data.medical_exams || []).forEach(function (exam) {
      if (calc(exam.expiration_date) !== 'valido') {
        items.push({ type: 'ASO', name: exam.exam_type || 'ASO', owner: exam.employee_name || '-', due: exam.expiration_date, page: 'aso' });
      }
    });
    (data.epi_records || []).forEach(function (epi) {
      if (epi.replacement_date && calc(epi.replacement_date) !== 'valido') {
        items.push({ type: 'EPI', name: epi.epi_name || 'EPI', owner: epi.employee_name || '-', due: epi.replacement_date, page: 'epi' });
      }
    });
    (data.technical_documents || []).forEach(function (doc) {
      if (doc.expiration_date && calc(doc.expiration_date) !== 'valido') {
        items.push({ type: 'DOC', name: doc.title || doc.document_type || 'Documento', owner: doc.project_name || '-', due: doc.expiration_date, page: 'documents' });
      }
    });
    return items;
  }

  function auditChecks() {
    var data = db();
    var activeEmployees = (data.employees || []).filter(function (emp) { return (emp.status || 'ativo') === 'ativo'; });
    var employeesWithoutNr = activeEmployees.filter(function (emp) {
      return !(data.certificates || []).some(function (cert) { return same(cert.employee_id, emp.id) && cert.status !== 'cancelado' && calc(cert.expiration_date) === 'valido'; });
    });
    var employeesWithoutAso = activeEmployees.filter(function (emp) {
      return !(data.medical_exams || []).some(function (exam) { return same(exam.employee_id, emp.id) && calc(exam.expiration_date) === 'valido'; });
    });
    var equipmentWithoutPhoto = (data.equipment || []).filter(function (eq) { return !eq.photo_url; });
    var documentsWithoutFile = (data.technical_documents || []).filter(function (doc) { return !doc.file_url; });
    var expired = getPendingItems().filter(function (item) { return typeof daysUntil === 'function' ? daysUntil(item.due) < 0 : calc(item.due) === 'vencido'; });
    return [
      { title: 'Funcionarios com NR valida', total: activeEmployees.length, fail: employeesWithoutNr.length, text: employeesWithoutNr.length ? employeesWithoutNr.length + ' funcionario(s) sem NR valida' : 'Todos os funcionarios ativos tem NR valida.' },
      { title: 'ASO ocupacional', total: activeEmployees.length, fail: employeesWithoutAso.length, text: employeesWithoutAso.length ? employeesWithoutAso.length + ' funcionario(s) sem ASO valido' : 'ASO regular para funcionarios ativos.' },
      { title: 'Documentos anexados', total: (data.technical_documents || []).length, fail: documentsWithoutFile.length, text: documentsWithoutFile.length ? documentsWithoutFile.length + ' documento(s) sem arquivo vinculado' : 'Documentos tecnicos possuem arquivo.' },
      { title: 'Equipamentos identificados', total: (data.equipment || []).length, fail: equipmentWithoutPhoto.length, text: equipmentWithoutPhoto.length ? equipmentWithoutPhoto.length + ' equipamento(s) sem foto' : 'Equipamentos com identificacao visual.' },
      { title: 'Vencidos criticos', total: getPendingItems().length, fail: expired.length, text: expired.length ? expired.length + ' item(ns) ja vencidos precisam acao imediata' : 'Nenhum item vencido no momento.' }
    ];
  }

  function checkClass(check) {
    if (!check.fail) return 'suite-ok';
    if (check.total && check.fail < check.total) return 'suite-warn';
    return 'suite-bad';
  }

  function checkIcon(check) {
    return check.fail ? '!' : 'OK';
  }

  window.openAuditBoard = function openAuditBoard() {
    var checks = auditChecks();
    var data = db();
    var active = (data.employees || []).filter(function (emp) { return (emp.status || 'ativo') === 'ativo'; }).length;
    var pending = getPendingItems().length;
    var failed = checks.reduce(function (sum, item) { return sum + item.fail; }, 0);
    var score = Math.max(0, Math.round(100 - (failed / Math.max(active + (data.certificates || []).length + 1, 1)) * 100));
    var html = '<div class="p-6"><div class="exec-panel-head"><div><p class="text-xs font-black uppercase tracking-widest text-blue-700">Auditoria interna</p><h2 class="font-display text-2xl font-black text-imec-dark">Painel de Prontidao</h2><p class="text-sm text-slate-500 mt-1">Checklist automatico para preparar auditoria, cliente e fiscalizacao.</p></div><button class="btn btn-primary btn-sm" onclick="printProfessionalDocument(\'audit\')">Imprimir / PDF</button></div>'
      + '<div class="suite-audit-grid"><div class="suite-audit-card"><small>Score</small><strong>' + esc(score) + '%</strong></div><div class="suite-audit-card"><small>Ativos</small><strong>' + esc(active) + '</strong></div><div class="suite-audit-card"><small>Pendencias</small><strong>' + esc(pending) + '</strong></div><div class="suite-audit-card"><small>Checklist</small><strong>' + esc(checks.length) + '</strong></div></div>'
      + '<div class="suite-checklist">' + checks.map(function (check) {
        return '<div class="suite-check-item ' + checkClass(check) + '"><span class="suite-check-dot">' + checkIcon(check) + '</span><span><span class="suite-check-title">' + esc(check.title) + '</span><span class="suite-check-text">' + esc(check.text) + '</span></span><span>' + (check.fail ? '<span class="badge badge-orange">Revisar</span>' : '<span class="badge badge-green">OK</span>') + '</span></div>';
      }).join('') + '</div><div class="flex justify-end mt-5"><button class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>';
    openModal(html);
  };

  function allAttachments() {
    var data = db();
    var items = [];
    (data.certificates || []).forEach(function (cert) {
      if (cert.pdf_url) items.push({ type: 'Certificado', title: cert.certificate_code || cert.training_name, owner: cert.employee_name, url: cert.pdf_url });
      if (cert.card_image_url) items.push({ type: 'Carteirinha', title: cert.certificate_code || cert.training_name, owner: cert.employee_name, url: cert.card_image_url });
    });
    (data.medical_exams || []).forEach(function (exam) {
      if (exam.pdf_url) items.push({ type: 'ASO', title: exam.exam_type || 'ASO', owner: exam.employee_name, url: exam.pdf_url });
    });
    (data.epi_records || []).forEach(function (epi) {
      if (epi.attachment_url) items.push({ type: 'EPI', title: epi.epi_name, owner: epi.employee_name, url: epi.attachment_url });
    });
    (data.technical_documents || []).forEach(function (doc) {
      if (doc.file_url) items.push({ type: 'Documento', title: doc.title || doc.document_type, owner: doc.project_name, url: doc.file_url });
    });
    (data.equipment || []).forEach(function (eq) {
      if (eq.photo_url) items.push({ type: 'Equipamento', title: eq.name, owner: eq.asset_number || eq.serial_number, url: eq.photo_url });
    });
    return items;
  }

  window.openAttachmentVault = function openAttachmentVault() {
    var items = allAttachments();
    var html = '<div class="p-6"><div class="exec-panel-head"><div><p class="text-xs font-black uppercase tracking-widest text-blue-700">Documentos vinculados</p><h2 class="font-display text-2xl font-black text-imec-dark">Central de Anexos</h2><p class="text-sm text-slate-500 mt-1">Atalhos para todos os arquivos salvos no sistema.</p></div><button class="btn btn-outline btn-sm" onclick="exportBackupJSON()">Backup JSON</button></div>'
      + (items.length ? '<div class="suite-vault">' + items.map(function (item) {
        return '<div class="suite-vault-item"><small>' + esc(item.type) + '</small><b>' + esc(item.title || '-') + '</b><p class="text-xs text-slate-500 mb-3">' + esc(item.owner || '-') + '</p><a class="btn btn-primary btn-sm" href="' + esc(item.url) + '" target="_blank" rel="noopener">Abrir arquivo</a></div>';
      }).join('') + '</div>' : '<div class="text-center text-slate-400 py-8">Nenhum anexo vinculado ainda.</div>')
      + '<div class="flex justify-end mt-5"><button class="btn btn-outline" onclick="closeModal()">Fechar</button></div></div>';
    openModal(html);
  };

  function downloadText(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  window.exportBackupJSON = function exportBackupJSON() {
    var backup = {
      generated_at: new Date().toISOString(),
      source: location.origin,
      data: db()
    };
    downloadText('backup-imec-compliance.json', JSON.stringify(backup, null, 2), 'application/json;charset=utf-8;');
    if (typeof showToast === 'function') showToast('Backup exportado.', 'success');
  };

  window.openPasswordModal = function openPasswordModal() {
    openModal('<div class="p-6"><div class="exec-panel-head"><div><p class="text-xs font-black uppercase tracking-widest text-blue-700">Seguranca</p><h2 class="font-display text-2xl font-black text-imec-dark">Alterar senha</h2><p class="text-sm text-slate-500 mt-1">Use no minimo 8 caracteres, maiuscula, minuscula, numero e especial.</p></div></div><form onsubmit="savePasswordChange(event)"><div class="grid md:grid-cols-2 gap-4"><div><label class="label">Senha atual</label><input class="input" type="password" id="suiteCurrentPassword" required></div><div><label class="label">Nova senha</label><input class="input" type="password" id="suiteNewPassword" required></div></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" type="submit">Salvar senha</button></div></form></div>');
  };

  window.savePasswordChange = async function savePasswordChange(event) {
    event.preventDefault();
    try {
      await API.auth.changePassword({
        current_password: document.getElementById('suiteCurrentPassword').value,
        new_password: document.getElementById('suiteNewPassword').value
      });
      closeModal();
      if (typeof showToast === 'function') showToast('Senha alterada com seguranca.', 'success');
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Erro ao alterar senha.', 'error');
    }
  };

  window.openEmailSettingsModal = function openEmailSettingsModal() {
    var s = db().settings || {};
    openModal('<div class="p-6"><div class="exec-panel-head"><div><p class="text-xs font-black uppercase tracking-widest text-blue-700">Notificacoes</p><h2 class="font-display text-2xl font-black text-imec-dark">Configurar e-mail SMTP</h2><p class="text-sm text-slate-500 mt-1">Se deixar vazio, o sistema gera apenas uma previa para conferencia.</p></div><button class="btn btn-outline btn-sm" onclick="sendNotificationPreview()">Enviar teste</button></div><form onsubmit="saveEmailSettings(event)"><div class="grid md:grid-cols-2 gap-4"><div><label class="label">E-mail de destino</label><input class="input" id="suiteNotificationEmail" value="' + esc(s.notification_email || s.email || '') + '"></div><div><label class="label">Remetente</label><input class="input" id="suiteSmtpFrom" value="' + esc(s.smtp_from || s.smtp_user || '') + '"></div><div><label class="label">SMTP host</label><input class="input" id="suiteSmtpHost" value="' + esc(s.smtp_host || '') + '"></div><div><label class="label">SMTP porta</label><input class="input" id="suiteSmtpPort" type="number" value="' + esc(s.smtp_port || 587) + '"></div><div><label class="label">SMTP usuario</label><input class="input" id="suiteSmtpUser" value="' + esc(s.smtp_user || '') + '"></div><div><label class="label">SMTP senha</label><input class="input" id="suiteSmtpPass" type="password" value="' + esc(s.smtp_pass || '') + '"></div><label class="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" id="suiteSmtpSecure" ' + (s.smtp_secure ? 'checked' : '') + '> Usar SSL/TLS</label></div><div id="suiteNotificationResult" class="mt-4"></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" type="submit">Salvar configuracao</button></div></form></div>');
  };

  function settingsPayloadWithEmail() {
    var s = db().settings || {};
    return Object.assign({}, s, {
      notification_email: document.getElementById('suiteNotificationEmail').value,
      smtp_from: document.getElementById('suiteSmtpFrom').value,
      smtp_host: document.getElementById('suiteSmtpHost').value,
      smtp_port: Number(document.getElementById('suiteSmtpPort').value || 587),
      smtp_user: document.getElementById('suiteSmtpUser').value,
      smtp_pass: document.getElementById('suiteSmtpPass').value,
      smtp_secure: document.getElementById('suiteSmtpSecure').checked
    });
  }

  window.saveEmailSettings = async function saveEmailSettings(event) {
    event.preventDefault();
    try {
      await API.settings.update(settingsPayloadWithEmail());
      await refreshData();
      if (typeof showToast === 'function') showToast('Configuracao de e-mail salva.', 'success');
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Erro ao salvar e-mail.', 'error');
    }
  };

  window.sendNotificationPreview = async function sendNotificationPreview() {
    try {
      var target = document.getElementById('suiteNotificationResult');
      if (target) target.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
      var result = await API.notifications.sendTest({ to: document.getElementById('suiteNotificationEmail').value });
      if (target) {
        target.innerHTML = '<div class="suite-template">' + esc(result.sent ? ('Enviado para ' + result.to + ' com ' + result.total + ' pendencia(s).') : ('Previa gerada. Pendencias: ' + result.total + '\\n\\n' + (result.message || ''))) + '</div>';
      }
      if (typeof showToast === 'function') showToast(result.sent ? 'E-mail enviado.' : 'Previa de e-mail gerada.', result.sent ? 'success' : 'info');
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Erro ao testar e-mail.', 'error');
    }
  };

  window.openServerReport = function openServerReport(type, id) {
    var url = type === 'employee' ? API.reportsServer.employeeHtml(id) : API.reportsServer.auditHtml();
    var token = typeof getToken === 'function' ? getToken() : '';
    var w = window.open('', '_blank', 'width=1180,height=820');
    w.document.write('<html><body style="font-family:Arial;padding:30px"><p>Gerando relatorio...</p><script>fetch(' + JSON.stringify(url) + ',{headers:{Authorization:"Bearer ' + token + '"}}).then(function(r){return r.text()}).then(function(html){document.open();document.write(html);document.close();}).catch(function(){document.body.innerHTML="Erro ao gerar relatorio";});</script></body></html>');
    w.document.close();
  };

  function parseCSV(text) {
    var rows = [];
    var row = [];
    var cell = '';
    var quote = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var next = text[i + 1];
      if (ch === '"' && quote && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quote = !quote;
      } else if ((ch === ';' || ch === ',') && !quote) {
        row.push(cell.trim());
        cell = '';
      } else if ((ch === '\n' || ch === '\r') && !quote) {
        if (cell || row.length) {
          row.push(cell.trim());
          rows.push(row);
          row = [];
          cell = '';
        }
        if (ch === '\r' && next === '\n') i++;
      } else {
        cell += ch;
      }
    }
    if (cell || row.length) {
      row.push(cell.trim());
      rows.push(row);
    }
    return rows.filter(function (r) { return r.some(Boolean); });
  }

  function rowsToObjects(rows) {
    var headers = (rows[0] || []).map(function (h) { return String(h || '').trim().toLowerCase(); });
    return rows.slice(1).map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i] || ''; });
      return obj;
    });
  }

  function normalizeImportRow(type, row) {
    if (type === 'employees') {
      return {
        full_name: row.nome || row.full_name || '',
        cpf: row.cpf || '',
        rg: row.rg || '',
        phone: row.telefone || row.phone || '',
        email: row.email || '',
        role_position: row.funcao || row.cargo || row.role_position || '',
        department: row.setor || row.department || '',
        admission_date: row.admissao || row.admission_date || '',
        status: row.status || 'ativo',
        notes: row.observacoes || row.notes || ''
      };
    }
    if (type === 'equipment') {
      return {
        name: row.nome || row.name || '',
        type: row.tipo || row.type || 'Outro',
        brand: row.marca || row.brand || '',
        model: row.modelo || row.model || '',
        serial_number: row.serie || row.serial_number || '',
        asset_number: row.patrimonio || row.asset_number || '',
        plate: row.placa || row.plate || '',
        year: row.ano || row.year || '',
        capacity: row.capacidade || row.capacity || '',
        owner: row.proprietario || row.owner || '',
        status: row.status || 'ativo',
        notes: row.observacoes || row.notes || ''
      };
    }
    return null;
  }

  window.openImportWizard = function openImportWizard(type) {
    var title = type === 'equipment' ? 'Importar equipamentos' : 'Importar funcionarios';
    var template = type === 'equipment'
      ? 'nome;tipo;marca;modelo;serie;patrimonio;placa;ano;capacidade;proprietario;status\nMunck 01;Caminhao Munck;Hyva;HB;123;PAT-01;ABC1D23;2024;20t;IMEC;ativo'
      : 'nome;cpf;rg;telefone;email;funcao;setor;admissao;status\nJoao da Silva;12345678900;123456;11999999999;joao@email.com;Operador;Producao;2026-01-10;ativo';
    openModal('<div class="p-6"><div class="exec-panel-head"><div><p class="text-xs font-black uppercase tracking-widest text-blue-700">Importacao em massa</p><h2 class="font-display text-2xl font-black text-imec-dark">' + esc(title) + '</h2><p class="text-sm text-slate-500 mt-1">Use CSV separado por ponto e virgula. Confira antes de importar no banco.</p></div><button class="btn btn-outline btn-sm" onclick="downloadImportTemplate(\'' + esc(type) + '\')">Baixar modelo</button></div><div class="suite-import-map"><div><label class="label">Arquivo CSV</label><input class="input" type="file" accept=".csv,text/csv" id="suiteImportFile"><p class="text-xs text-slate-500 mt-2">A primeira linha precisa conter os nomes das colunas.</p></div><div><label class="label">Modelo</label><div class="suite-template">' + esc(template) + '</div></div></div><div id="suiteImportPreview" class="mt-4"></div><div class="flex justify-end gap-3 mt-6"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button type="button" class="btn btn-primary" onclick="previewImportCSV(\'' + esc(type) + '\')">Conferir arquivo</button></div></div>');
  };

  window.downloadImportTemplate = function downloadImportTemplate(type) {
    var text = type === 'equipment'
      ? 'nome;tipo;marca;modelo;serie;patrimonio;placa;ano;capacidade;proprietario;status\nMunck 01;Caminhao Munck;Hyva;HB;123;PAT-01;ABC1D23;2024;20t;IMEC;ativo'
      : 'nome;cpf;rg;telefone;email;funcao;setor;admissao;status\nJoao da Silva;12345678900;123456;11999999999;joao@email.com;Operador;Producao;2026-01-10;ativo';
    downloadText('modelo-' + type + '.csv', text, 'text/csv;charset=utf-8;');
  };

  window.previewImportCSV = function previewImportCSV(type) {
    var input = document.getElementById('suiteImportFile');
    var file = input && input.files && input.files[0];
    if (!file) {
      if (typeof showToast === 'function') showToast('Selecione um arquivo CSV.', 'warning');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var rows = rowsToObjects(parseCSV(String(reader.result || '')));
      var payloads = rows.map(function (row) { return normalizeImportRow(type, row); }).filter(function (row) { return row && (row.full_name || row.name); });
      window.__suiteImportPayloads = payloads;
      var preview = document.getElementById('suiteImportPreview');
      preview.innerHTML = '<div class="table-container"><table><thead><tr><th>Nome</th><th>Tipo/Funcao</th><th>Status</th></tr></thead><tbody>' + payloads.slice(0, 10).map(function (item) {
        return '<tr><td>' + esc(item.full_name || item.name) + '</td><td>' + esc(item.role_position || item.type || '-') + '</td><td>' + esc(item.status || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="flex justify-end mt-4"><button class="btn btn-primary" onclick="runImportCSV(\'' + esc(type) + '\')">Importar ' + payloads.length + ' registro(s)</button></div>';
    };
    reader.readAsText(file, 'utf-8');
  };

  window.runImportCSV = async function runImportCSV(type) {
    var payloads = window.__suiteImportPayloads || [];
    if (!payloads.length) return;
    var api = type === 'equipment' ? API.equipment : API.employees;
    var ok = 0;
    for (var i = 0; i < payloads.length; i++) {
      try {
        await api.create(payloads[i]);
        ok++;
      } catch (err) {}
    }
    await refreshData();
    closeModal();
    await renderPage();
    if (typeof showToast === 'function') showToast(ok + ' registro(s) importados.', 'success');
  };

  window.printProfessionalDocument = function printProfessionalDocument(type) {
    var title = type === 'audit' ? 'Painel de Auditoria' : 'Relatorio IMEC';
    var source = type === 'audit' ? document.getElementById('modalContent') : document.getElementById('reportOutput');
    if (!source) return;
    var w = window.open('', '_blank', 'width=1180,height=820');
    w.document.write('<html><head><title>' + esc(title) + '</title><link rel="stylesheet" href="/pro-dashboard.css"><link rel="stylesheet" href="/pro-polish.css"><link rel="stylesheet" href="/executive-control.css"><link rel="stylesheet" href="/professional-suite.css"><style>body{font-family:DM Sans,Arial,sans-serif;background:#fff;padding:28px}.btn,.suite-no-print{display:none!important}.enhanced-report-sheet,.exec-panel{box-shadow:none!important;border:1px solid #dbe7f5!important}</style></head><body><main>' + source.innerHTML + '<div class="suite-sign-box"><div>Assinatura do responsavel</div><div>Assinatura do cliente / auditor</div></div></main><script>setTimeout(function(){window.print();window.close()},500)</script></body></html>');
    w.document.close();
  };

  function patchReportPrint() {
    if (typeof window.generateReport !== 'function' || window.generateReport.__suitePrint) return false;
    var original = window.generateReport;
    window.generateReport = function () {
      var result = original.apply(this, arguments);
      setTimeout(function () {
        var toolbar = document.querySelector('#reportOutput .enhanced-report-toolbar, #reportOutput .flex.items-center.justify-between.mb-4');
        if (toolbar && !toolbar.querySelector('[data-suite-print]')) {
          var wrap = toolbar.querySelector('.flex.gap-2') || toolbar;
          wrap.insertAdjacentHTML('beforeend', '<button data-suite-print="1" class="btn btn-primary btn-sm" onclick="printProfessionalDocument(\'report\')">Imprimir / PDF</button>');
        }
      }, 50);
      return result;
    };
    window.generateReport.__suitePrint = true;
    return true;
  }

  function patchCardPrint() {
    if (typeof window.printEmployeeCard !== 'function' || window.printEmployeeCard.__suitePrint) return false;
    var original = window.printEmployeeCard;
    function loadHtml2Canvas() {
      if (window.html2canvas) return Promise.resolve(window.html2canvas);
      if (window.__imecHtml2CanvasLoading) return window.__imecHtml2CanvasLoading;
      window.__imecHtml2CanvasLoading = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.async = true;
        script.onload = function () { resolve(window.html2canvas); };
        script.onerror = function () { reject(new Error('Falha ao carregar gerador de imagem.')); };
        document.head.appendChild(script);
      });
      return window.__imecHtml2CanvasLoading;
    }
    function fileSafeName(value) {
      return String(value || 'carteirinha-nr')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'carteirinha-nr';
    }
    function downloadDataUrl(dataUrl, filename) {
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    function cloneCardForImage(set) {
      var clone = set.cloneNode(true);
      var originalCanvases = set.querySelectorAll('canvas');
      var cloneCanvases = clone.querySelectorAll('canvas');
      originalCanvases.forEach(function (canvas, index) {
        var target = cloneCanvases[index];
        if (!target) return;
        try {
          var img = document.createElement('img');
          img.src = canvas.toDataURL('image/png');
          img.width = canvas.width;
          img.height = canvas.height;
          img.style.width = target.style.width || '112px';
          img.style.height = target.style.height || '112px';
          target.replaceWith(img);
        } catch (err) {}
      });
      clone.querySelectorAll('.nr-actions,.nr-side-label').forEach(function (node) { node.remove(); });
      clone.querySelectorAll('.nr-id-wrap').forEach(function (node) {
        node.style.display = 'block';
      });
      Object.assign(clone.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 610px)',
        gap: '32px',
        alignItems: 'start',
        justifyContent: 'center',
        width: '1252px',
        margin: '0',
        padding: '32px',
        background: '#f8fbff',
        position: 'fixed',
        left: '-20000px',
        top: '0',
        zIndex: '-1'
      });
      clone.querySelectorAll('.nr-id-card').forEach(function (card) {
        card.style.width = '610px';
        card.style.maxWidth = '610px';
        card.style.margin = '0';
        card.style.boxShadow = '0 22px 50px rgba(7,27,58,.16), 0 0 0 1px #cbd6e5';
      });
      return clone;
    }
    window.printEmployeeCard = function (employeeId) {
      var set = document.getElementById('nr-set-' + employeeId);
      if (!set) return original.apply(this, arguments);
      var employeeName = (set.querySelector('.nr-row strong') || {}).textContent || employeeId;
      var clone = cloneCardForImage(set);
      document.body.appendChild(clone);
      loadHtml2Canvas().then(function (html2canvas) {
        return html2canvas(clone, {
          backgroundColor: '#f8fbff',
          scale: Math.min(2, window.devicePixelRatio || 1.5),
          useCORS: true,
          allowTaint: true,
          logging: false
        });
      }).then(function (canvas) {
        downloadDataUrl(canvas.toDataURL('image/png', 0.98), fileSafeName('carteirinha-' + employeeName) + '.png');
        if (typeof showToast === 'function') showToast('Imagem da carteirinha baixada.', 'success');
      }).catch(function () {
        if (typeof showToast === 'function') showToast('Nao foi possivel gerar imagem. Abrindo PDF.', 'warning');
        original.apply(window, [employeeId]);
      }).finally(function () {
        clone.remove();
      });
    };
    window.printEmployeeCard.__suitePrint = true;
    return true;
  }

  function actionBar() {
    return '<div class="suite-action-bar suite-no-print"><div><strong class="text-imec-dark">Ferramentas profissionais</strong><p class="text-xs text-slate-500">Auditoria, backup, anexos, seguranca e notificacoes.</p></div><div class="suite-action-group"><button class="btn btn-outline btn-sm" onclick="openAuditBoard()">Auditoria</button><button class="btn btn-outline btn-sm" onclick="openAttachmentVault()">Anexos</button><button class="btn btn-outline btn-sm" onclick="exportBackupJSON()">Backup</button><button class="btn btn-outline btn-sm" onclick="openPasswordModal()">Senha</button><button class="btn btn-outline btn-sm" onclick="openEmailSettingsModal()">E-mail</button><button class="btn btn-primary btn-sm" onclick="openServerReport(\'audit\')">PDF servidor</button></div></div>';
  }

  function patchDashboardTools() {
    if (typeof renderers === 'undefined' || !renderers.dashboard || renderers.dashboard.__suiteTools) return false;
    renderers.dashboard.__suiteTools = true;
    return true;
  }

  function patchImportButtons() {
    if (typeof renderers === 'undefined') return false;
    if (renderers.employees && !renderers.employees.__suiteImport) {
      var originalEmployees = renderers.employees;
      renderers.employees = async function () {
        return '<div class="suite-action-bar suite-no-print"><div><strong class="text-imec-dark">Funcionarios</strong><p class="text-xs text-slate-500">Cadastre manualmente ou importe por CSV.</p></div><button class="btn btn-outline btn-sm" onclick="openImportWizard(\'employees\')">Importar CSV</button></div>' + await originalEmployees.apply(this, arguments);
      };
      renderers.employees.__suiteImport = true;
    }
    if (renderers.equipment && !renderers.equipment.__suiteImport) {
      var originalEquipment = renderers.equipment;
      renderers.equipment = async function () {
        return '<div class="suite-action-bar suite-no-print"><div><strong class="text-imec-dark">Equipamentos</strong><p class="text-xs text-slate-500">Importe maquinas, placas e patrimonio por CSV.</p></div><button class="btn btn-outline btn-sm" onclick="openImportWizard(\'equipment\')">Importar CSV</button></div>' + await originalEquipment.apply(this, arguments);
      };
      renderers.equipment.__suiteImport = true;
    }
    return true;
  }

  function patchReportsTools() {
    if (typeof renderers === 'undefined' || !renderers.reports || renderers.reports.__suiteTools) return false;
    renderers.reports.__suiteTools = true;
    return true;
  }

  function boot(attempt) {
    ensureApiExtensions();
    patchUpdatePreservation();
    patchReportPrint();
    patchCardPrint();
    patchDashboardTools();
    patchImportButtons();
    patchReportsTools();
    if (attempt < 50) setTimeout(function () { boot(attempt + 1); }, 180);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(0); });
  } else {
    boot(0);
  }
})();
