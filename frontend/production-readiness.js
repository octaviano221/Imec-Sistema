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

  function findRecord(collection, id) {
    return ((db()[collection] || [])).find(function (item) { return same(item.id, id); }) || {};
  }

  function fieldHtml(id, label, value) {
    return '<div><label class="label">' + esc(label) + '</label><input class="input prod-url-field" id="' + esc(id) + '" value="' + esc(value || '') + '" placeholder="/uploads/arquivo.pdf ou URL externa"></div>';
  }

  function uploadHtml(targetId) {
    return '<label class="prod-upload-button">Enviar arquivo<input type="file" onchange="uploadProductionAttachment(this,\'' + esc(targetId) + '\')"></label>';
  }

  function panel(title, content) {
    return '<div class="prod-extra-panel"><div class="prod-extra-title"><span>' + esc(title) + '</span><span>Anexos e rastreabilidade</span></div>' + content + '</div>';
  }

  function insertBeforeActions(html) {
    var modal = document.getElementById('modalContent');
    if (!modal || modal.querySelector('.prod-extra-panel')) return;
    var grid = modal.querySelector('form .grid');
    if (!grid) return;
    grid.insertAdjacentHTML('beforeend', html);
  }

  window.uploadProductionAttachment = async function uploadProductionAttachment(input, targetId) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      if (typeof showToast === 'function') showToast('Use um arquivo menor que 8 MB.', 'error');
      input.value = '';
      return;
    }
    try {
      var form = new FormData();
      form.append('file', file);
      var result = await API.upload(form);
      var target = document.getElementById(targetId);
      if (target) target.value = result.url || '';
      if (typeof showToast === 'function') showToast('Arquivo enviado e vinculado.', 'success');
    } catch (err) {
      if (typeof showToast === 'function') showToast('Erro no upload: ' + (err.message || err), 'error');
    }
  };

  function augmentCertificate(id) {
    var cert = id ? findRecord('certificates', id) : {};
    insertBeforeActions(panel('Certificado digital', '<div class="prod-attachment-grid">' + fieldHtml('certPdfUrl', 'PDF do certificado', cert.pdf_url) + uploadHtml('certPdfUrl') + fieldHtml('certCardImageUrl', 'Imagem/PDF da carteirinha', cert.card_image_url) + uploadHtml('certCardImageUrl') + '</div>'));
  }

  function augmentAso(id) {
    var exam = id ? findRecord('medical_exams', id) : {};
    insertBeforeActions(panel('ASO assinado', '<div class="prod-attachment-grid">' + fieldHtml('asoPdfUrl', 'PDF do ASO', exam.pdf_url) + uploadHtml('asoPdfUrl') + '</div>'));
  }

  function augmentEpi(id) {
    var epi = id ? findRecord('epi_records', id) : {};
    insertBeforeActions(panel('Ficha de entrega', '<div class="prod-attachment-grid">' + fieldHtml('epiAttachmentUrl', 'Ficha assinada / anexo', epi.attachment_url) + uploadHtml('epiAttachmentUrl') + '</div>'));
  }

  function augmentDocument(id) {
    var doc = id ? findRecord('technical_documents', id) : {};
    insertBeforeActions(panel('Arquivo tecnico', '<div class="prod-attachment-grid">' + fieldHtml('docFileUrl', 'Arquivo do documento', doc.file_url) + uploadHtml('docFileUrl') + '</div>'));
  }

  function augmentEquipment(id) {
    var equipment = id ? findRecord('equipment', id) : {};
    insertBeforeActions(panel('Foto e identificacao', '<div class="prod-attachment-grid">' + fieldHtml('eqPhotoUrl', 'Foto do equipamento', equipment.photo_url) + uploadHtml('eqPhotoUrl') + '</div>'));
  }

  function wrapEdit(name, augmenter) {
    var original = window[name];
    if (typeof original !== 'function' || original.__prodWrapped) return;
    window[name] = function (id) {
      var result = original.apply(this, arguments);
      setTimeout(function () { augmenter(id); }, 30);
      return result;
    };
    window[name].__prodWrapped = true;
  }

  function value(id) {
    var el = document.getElementById(id);
    return el ? el.value : undefined;
  }

  function mergeExtra(payload, map) {
    var copy = Object.assign({}, payload || {});
    Object.keys(map).forEach(function (field) {
      var v = value(map[field]);
      if (v !== undefined) copy[field] = v;
    });
    return copy;
  }

  function wrapApiGroup(groupName, map) {
    var group = API && API[groupName];
    if (!group || group.__prodWrapped) return;
    ['create', 'update'].forEach(function (method) {
      if (typeof group[method] !== 'function') return;
      var original = group[method];
      group[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        var dataIndex = method === 'update' ? 1 : 0;
        args[dataIndex] = mergeExtra(args[dataIndex], map);
        return original.apply(this, args);
      };
    });
    group.__prodWrapped = true;
  }

  function attachmentLink(label, url) {
    if (!url) return '';
    return '<div class="prod-link-item"><span>' + esc(label) + '</span><a href="' + esc(url) + '" target="_blank" rel="noopener">Abrir</a></div>';
  }

  function renderAttachmentsForEmployee(employeeId) {
    var data = db();
    var certLinks = (data.certificates || []).filter(function (c) { return same(c.employee_id, employeeId); }).map(function (c) {
      return attachmentLink('Certificado ' + (c.certificate_code || c.training_code || ''), c.pdf_url) + attachmentLink('Carteirinha ' + (c.certificate_code || c.training_code || ''), c.card_image_url);
    }).join('');
    var asoLinks = (data.medical_exams || []).filter(function (m) { return same(m.employee_id, employeeId); }).map(function (m) {
      return attachmentLink('ASO ' + (m.exam_type || ''), m.pdf_url);
    }).join('');
    var epiLinks = (data.epi_records || []).filter(function (e) { return same(e.employee_id, employeeId); }).map(function (e) {
      return attachmentLink('EPI ' + (e.epi_name || ''), e.attachment_url);
    }).join('');
    var html = certLinks + asoLinks + epiLinks;
    return html || '<div class="text-center text-slate-400 text-sm py-6">Nenhum anexo cadastrado para este funcionario.</div>';
  }

  function wrapProfile() {
    if (typeof window.viewEmployeeProfile !== 'function' || window.viewEmployeeProfile.__prodWrapped) return;
    var original = window.viewEmployeeProfile;
    window.viewEmployeeProfile = function (employeeId) {
      var result = original.apply(this, arguments);
      setTimeout(function () {
        var modal = document.getElementById('modalContent');
        if (!modal || modal.querySelector('.prod-profile-attachments')) return;
        var closeRow = modal.querySelector('.flex.justify-end.mt-5');
        if (!closeRow) return;
        closeRow.insertAdjacentHTML('beforebegin', '<section class="profile-card mt-4 prod-profile-attachments"><div class="profile-card-title"><span>Anexos do dossie</span></div><div class="prod-link-list">' + renderAttachmentsForEmployee(employeeId) + '</div></section>');
      }, 40);
      return result;
    };
    window.viewEmployeeProfile.__prodWrapped = true;
  }

  function boot(attempt) {
    if (typeof API === 'undefined') {
      if (attempt < 40) setTimeout(function () { boot(attempt + 1); }, 150);
      return;
    }
    wrapEdit('editCertificate', augmentCertificate);
    wrapEdit('editASO', augmentAso);
    wrapEdit('editEPI', augmentEpi);
    wrapEdit('editDocument', augmentDocument);
    wrapEdit('editEquipment', augmentEquipment);
    wrapApiGroup('certificates', { pdf_url: 'certPdfUrl', card_image_url: 'certCardImageUrl' });
    wrapApiGroup('medicalExams', { pdf_url: 'asoPdfUrl' });
    wrapApiGroup('epi', { attachment_url: 'epiAttachmentUrl' });
    wrapApiGroup('technicalDocuments', { file_url: 'docFileUrl' });
    wrapApiGroup('equipment', { photo_url: 'eqPhotoUrl' });
    wrapProfile();
    if (attempt < 12) setTimeout(function () { boot(attempt + 1); }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(0); });
  } else {
    boot(0);
  }
})();
