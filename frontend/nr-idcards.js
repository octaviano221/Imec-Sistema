(function () {
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initials(name) {
    return String(name || 'IM').split(' ').filter(Boolean).map(function (word) { return word[0]; }).join('').slice(0, 2).toUpperCase();
  }

  function cleanDate(value) {
    if (!value) return '-';
    var raw = String(value);
    var date = raw.indexOf('T') > -1 ? raw.split('T')[0] : raw.slice(0, 10);
    var parts = date.split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
    return raw;
  }

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function safeCPF(value) {
    var cpf = digits(value);
    if (cpf.length === 11 && typeof formatCPF === 'function') return formatCPF(cpf);
    return value || '-';
  }

  function certsFor(employeeId) {
    var db = getDB();
    var days = (db.settings && db.settings.expiration_alert_days) || 30;
    return (db.certificates || []).filter(function (cert) {
      return String(cert.employee_id) === String(employeeId) && cert.status !== 'cancelado' && calcStatus(cert.expiration_date, days) !== 'vencido';
    });
  }

  function employeePayload(employee, photoUrl) {
    return {
      full_name: employee.full_name,
      cpf: employee.cpf,
      rg: employee.rg,
      birth_date: employee.birth_date,
      phone: employee.phone,
      email: employee.email,
      address: employee.address,
      role_position: employee.role_position,
      department: employee.department,
      admission_date: employee.admission_date,
      status: employee.status,
      notes: employee.notes,
      photo_url: photoUrl
    };
  }

  function resizePhoto(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Nao foi possivel ler a foto.')); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error('Imagem invalida.')); };
        image.onload = function () {
          var maxWidth = 420;
          var maxHeight = 560;
          var ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.74));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.saveEmployeeCardPhoto = function (employeeId, input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      showToast('Selecione uma imagem valida.', 'error');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      showToast('Use uma foto menor que 12 MB. O sistema comprime automaticamente antes de salvar.', 'error');
      return;
    }
    var employee = (getDB().employees || []).find(function (item) { return String(item.id) === String(employeeId); });
    if (!employee) return;
    (async function () {
      try {
        var photoData = await resizePhoto(file);
        await API.employees.update(employeeId, employeePayload(employee, photoData));
        await refreshData();
        await renderPage();
        showToast('Foto salva na carteirinha!', 'success');
      } catch (err) {
        showToast('Erro ao salvar foto: ' + err.message, 'error');
      }
    })();
  };

  window.printEmployeeCard = function (employeeId) {
    var set = document.getElementById('nr-set-' + employeeId);
    if (!set) return;
    var w = window.open('', '_blank', 'width=1180,height=820');
    w.document.write('<html><head><title>Carteirinha NR</title><link rel="stylesheet" href="/pro-dashboard.css"><link rel="stylesheet" href="/pro-polish.css"><link rel="stylesheet" href="/nr-idcards.css"></head><body><div class="print-area">' + set.outerHTML + '</div><script>setTimeout(function(){window.print();window.close()},450)</script></body></html>');
    w.document.close();
  };

  window.openCardVerification = function (token) {
    if (!token) {
      showToast('Esta carteirinha ainda nao tem certificado com QR de autenticidade.', 'warning');
      return;
    }
    showPublicVerification(token);
  };

  function renderQrCodes() {
    document.querySelectorAll('[data-nr-qr]').forEach(function (box) {
      if (box.dataset.done) return;
      box.dataset.done = '1';
      if (typeof QRCode === 'undefined') {
        var img = document.createElement('img');
        img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=138x138&margin=1&data=' + encodeURIComponent(box.dataset.nrQr || location.href);
        img.alt = 'QR Code de autenticidade';
        img.width = 138;
        img.height = 138;
        box.innerHTML = '';
        box.appendChild(img);
        return;
      }
      QRCode.toCanvas(box.dataset.nrQr, { width: 138, margin: 1, color: { dark: '#030712', light: '#ffffff' } }, function (err, canvas) {
        if (!err) {
          box.innerHTML = '';
          box.appendChild(canvas);
        }
      });
    });
  }

  function trainingContent(trainingName) {
    var name = String(trainingName || '').toLowerCase();
    if (name.indexOf('11') >= 0 || name.indexOf('movimenta') >= 0 || name.indexOf('carga') >= 0 || name.indexOf('munck') >= 0 || name.indexOf('guind') >= 0) {
      return ['Inspecao pre-operacional', 'Operacao segura do equipamento', 'Sinalizacao e movimentacao de cargas', 'Riscos e medidas preventivas', 'Procedimentos de emergencia', 'Uso correto de EPIs'];
    }
    if (name.indexOf('andaime') >= 0) {
      return ['Montagem, desmontagem e inspecao', 'Travamento, acesso e guarda-corpo', 'Uso correto de EPIs', 'Isolamento e sinalizacao da area', 'Condutas em emergencia'];
    }
    return ['Procedimentos seguros da atividade', 'Riscos e medidas preventivas', 'Responsabilidades do colaborador', 'Uso correto de EPIs', 'Condutas em emergencia'];
  }

  function primaryCertificate(employee) {
    var certs = certsFor(employee.id);
    return certs.slice().sort(function (a, b) { return new Date(a.expiration_date) - new Date(b.expiration_date); })[0] || null;
  }

  function authorizedList(certs) {
    var items = certs.slice(0, 5).map(function (item) {
      return '<li><span></span>' + esc(item.training_code || item.training_name || 'NR') + '</li>';
    }).join('');
    return items || '<li><span></span>Treinamento pendente</li>';
  }

  function verificationUrl(cert) {
    return cert && cert.verification_token ? (location.origin + '/verificar/' + encodeURIComponent(cert.verification_token)) : location.origin + '/verificar';
  }

  function displayCourseTitle(code, name) {
    var cleanCode = String(code || '').trim();
    var cleanName = String(name || '').trim();
    if (!cleanCode) return cleanName || 'Treinamento operacional';
    if (!cleanName) return cleanCode;
    var normalizedCode = cleanCode.toLowerCase().replace(/\s+/g, '');
    var normalizedName = cleanName.toLowerCase().replace(/\s+/g, '');
    if (normalizedName.indexOf(normalizedCode) === 0) return cleanName;
    return cleanCode + ' - ' + cleanName;
  }

  function cardSet(employee) {
    var db = getDB();
    var settings = db.settings || {};
    var cert = primaryCertificate(employee);
    var certs = certsFor(employee.id);
    var trainingCode = cert ? (cert.training_code || 'NR') : 'NR';
    var trainingName = cert ? (cert.training_name || 'Treinamento operacional') : 'Treinamento nao cadastrado';
    var codeLabel = cert ? (cert.certificate_code || cert.verification_token || 'Pendente') : 'Sem certificado';
    var qr = verificationUrl(cert);
    var token = cert && cert.verification_token ? cert.verification_token : '';
    var employeeInitials = initials(employee.full_name);
    var photo = employee.photo_url ? '<img class="nr-photo" src="' + employee.photo_url + '" alt="Foto de ' + esc(employee.full_name) + '" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'nr-photo-empty\',textContent:\'' + employeeInitials + '\'}))">' : '<div class="nr-photo-empty">' + employeeInitials + '</div>';
    var content = trainingContent(trainingName).map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('');
    var issue = cert ? cleanDate(cert.issue_date) : cleanDate(new Date().toISOString().slice(0, 10));
    var expiration = cert ? cleanDate(cert.expiration_date) : '-';
    var workload = cert && (cert.workload || cert.workload_hours) ? (cert.workload || cert.workload_hours) + ' horas' : 'Conforme certificado';
    var instructor = cert && cert.instructor_name ? cert.instructor_name : (settings.technical_responsible || 'Responsavel tecnico');
    var crea = cert && cert.crea_number ? cert.crea_number : (settings.crea_number || '-');
    var company = cert && cert.issuer_company ? cert.issuer_company : (settings.company_name || 'IMEC Compliance Industrial');
    var role = employee.role_position || 'Colaborador autorizado';
    var statusText = cert ? 'APTO' : 'PENDENTE';
    var statusClass = cert ? 'is-ready' : 'is-pending';
    var cardCode = String(codeLabel || 'Sem certificado').slice(0, 18);
    var courseTitle = displayCourseTitle(trainingCode, trainingName);
    var logoSrc = window.IMEC_LOGO_SRC || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22520%22%20height%3D%22190%22%20viewBox%3D%220%200%20520%20190%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22s%22%20x%3D%22-20%25%22%20y%3D%22-20%25%22%20width%3D%22140%25%22%20height%3D%22140%25%22%3E%3CfeDropShadow%20dx%3D%223%22%20dy%3D%225%22%20stdDeviation%3D%223%22%20flood-color%3D%22%23001a58%22%20flood-opacity%3D%22.35%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cpath%20d%3D%22M150%2028C215-8%20312%204%20364%2048%22%20fill%3D%22none%22%20stroke%3D%22%23ef1f28%22%20stroke-width%3D%2226%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M356%20142C286%20190%20171%20178%20110%20116%22%20fill%3D%22none%22%20stroke%3D%22%23ef1f28%22%20stroke-width%3D%2224%22%20stroke-linecap%3D%22round%22%2F%3E%3Ctext%20x%3D%2232%22%20y%3D%22112%22%20font-family%3D%22Arial%20Black%2CArial%2Csans-serif%22%20font-size%3D%22102%22%20font-style%3D%22italic%22%20font-weight%3D%22900%22%20fill%3D%22%23153fd1%22%20filter%3D%22url(%23s)%22%3EI%3C%2Ftext%3E%3Ctext%20x%3D%2288%22%20y%3D%22112%22%20font-family%3D%22Arial%20Black%2CArial%2Csans-serif%22%20font-size%3D%22112%22%20font-style%3D%22italic%22%20font-weight%3D%22900%22%20fill%3D%22%23ee1730%22%20filter%3D%22url(%23s)%22%3EM%3C%2Ftext%3E%3Ctext%20x%3D%22212%22%20y%3D%22112%22%20font-family%3D%22Arial%20Black%2CArial%2Csans-serif%22%20font-size%3D%22102%22%20font-style%3D%22italic%22%20font-weight%3D%22900%22%20fill%3D%22%23153fd1%22%20filter%3D%22url(%23s)%22%3EEC%3C%2Ftext%3E%3Ctext%20x%3D%2274%22%20y%3D%22172%22%20font-family%3D%22Arial%20Black%2CArial%2Csans-serif%22%20font-size%3D%2248%22%20font-style%3D%22italic%22%20font-weight%3D%22900%22%20letter-spacing%3D%224%22%20fill%3D%22%231746e8%22%3EMETALURGICA%3C%2Ftext%3E%3C%2Fsvg%3E';
    logoSrc = window.IMEC_LOGO_SRC || '/assets/imec-metalurgica-logo-transparent.png';

    return '<section class="nr-wallet-set" id="nr-set-' + employee.id + '">' +
      '<div class="nr-id-wrap">' +
        '<article class="nr-id-card nr-front-card">' +
          '<div class="nr-card-watermark">NR</div>' +
          '<div class="nr-card-serial">' + esc(trainingCode) + ' - ' + esc(cardCode) + '</div>' +
          '<div class="nr-brand"><img class="nr-brand-logo" src="' + logoSrc + '" alt="IMEC Metalurgica"></div>' +
          '<div class="nr-title-ribbon"><h3>Carteirinha ' + esc(trainingCode) + '</h3><p>' + esc(role) + '</p></div>' +
          '<div class="nr-front-main">' +
            '<div class="nr-left-column">' + photo + '<div class="nr-qr" data-nr-qr="' + esc(qr) + '"><span>QR</span></div><div class="nr-verify-caption"><b>Verifique a autenticidade</b><small>escaneando o QR Code</small></div></div>' +
            '<div class="nr-info-list">' +
              '<div class="nr-row"><span>Nome:</span><strong>' + esc(employee.full_name) + '</strong></div>' +
              '<div class="nr-row"><span>CPF:</span><strong>' + esc(safeCPF(employee.cpf)) + '</strong></div>' +
              '<div class="nr-row"><span>Funcao:</span><strong>' + esc(role) + '</strong></div>' +
              '<div class="nr-row"><span>Empresa:</span><strong>' + esc(company) + '</strong></div>' +
              '<div class="nr-row"><span>Matricula:</span><strong>' + String(employee.id).padStart(6, '0') + '</strong></div>' +
              '<div class="nr-row"><span>Emissao:</span><strong>' + issue + '</strong></div>' +
              '<div class="nr-row"><span>Validade:</span><strong>' + expiration + '</strong></div>' +
            '</div>' +
          '</div>' +
          '<div class="nr-code-strip"><span>Codigo de verificacao</span><strong>' + esc(codeLabel) + '</strong></div>' +
          '<div class="nr-apto ' + statusClass + '"><span></span><strong>' + statusText + '</strong></div>' +
          '<div class="nr-equipment-band"><div><h4>Treinamentos autorizados:</h4><ul class="nr-auth-list">' + authorizedList(certs) + '</ul></div><div class="nr-crane-mark">NR</div></div>' +
          '<div class="nr-red-foot"></div>' +
        '</article>' +
        '<div class="nr-side-label">Frente</div>' +
        '<div class="nr-actions">' +
          '<label class="btn btn-outline btn-sm"><input class="nr-photo-input" type="file" accept="image/*" onchange="saveEmployeeCardPhoto(\'' + employee.id + '\', this)">Adicionar foto</label>' +
          '<button class="btn btn-outline btn-sm" onclick="openCardVerification(\'' + token + '\')">Ver autenticidade</button>' +
          '<button class="btn btn-primary btn-sm" onclick="printEmployeeCard(\'' + employee.id + '\')">Baixar imagem</button>' +
        '</div>' +
      '</div>' +
      '<div class="nr-id-wrap">' +
        '<article class="nr-id-card nr-back-card">' +
          '<div class="nr-card-watermark back">IMEC</div>' +
          '<div class="nr-back-head"><div class="nr-head-icon"></div><h3>Informacoes do Treinamento</h3><div class="nr-status-pill ' + statusClass + '">' + statusText + '</div></div>' +
          '<img class="nr-back-logo" src="' + logoSrc + '" alt="IMEC Metalurgica">' +
          '<div class="nr-back-redline"></div>' +
          '<div class="nr-back-body">' +
            '<div class="nr-training-line has-icon book"><span>Curso:</span><strong>' + esc(courseTitle) + '</strong></div>' +
            '<div class="nr-training-line has-icon clock"><span>Carga horaria:</span><strong>' + esc(workload) + '</strong></div>' +
            '<div class="nr-content-box"><div class="nr-red-circle">NR</div><div><div class="nr-content-title">Conteudo / competencias:</div><ul class="nr-content-list">' + content + '</ul></div></div>' +
            '<div class="nr-instructor"><div class="nr-blue-circle"></div><div><div class="nr-training-line compact"><span>Instrutor responsavel:</span><strong>' + esc(instructor) + '</strong></div><div class="nr-training-line compact"><span>CREA:</span><strong>' + esc(crea) + '</strong></div></div></div>' +
            '<div class="nr-note"><span></span>Este cartao deve ser apresentado junto ao certificado de treinamento quando solicitado.</div>' +
            '<div class="nr-signatures"><div>Assinatura do responsavel</div><div>Assinatura do colaborador</div></div>' +
          '</div>' +
          '<div class="nr-back-foot"><span>NR | EPI | ASO | QR</span><strong class="nr-model-tag">Controle interno</strong></div>' +
        '</article>' +
        '<div class="nr-side-label">Verso</div>' +
      '</div>' +
    '</section>';
  }

  window.renderIdCardsPage = function () {
    var employees = (getDB().employees || []).filter(function (employee) { return employee.status === 'ativo'; });
    var body = employees.length ? employees.map(cardSet).join('') : '<div class="pro-empty"><div><strong>Nenhum funcionario ativo</strong><p class="mt-1 text-sm">Cadastre um funcionario ativo para gerar a carteirinha.</p></div></div>';
    setTimeout(renderQrCodes, 80);
    return '<div class="nr-card-toolbar"><div><h3 class="font-display text-xl font-extrabold text-slate-900">Carteirinhas NR frente e verso</h3><p class="text-sm text-slate-500">Modelo em imagem com foto, QR Code e codigo de verificacao. A leitura do QR abre a consulta publica de autenticidade.</p></div><button class="btn btn-outline btn-sm" onclick="window.print()">Baixar lote em PDF</button></div><div class="nr-card-grid print-area">' + body + '</div>';
  };

  function install() {
    if (typeof renderers === 'undefined') return false;
    renderers.idcards = async function () {
      return window.renderIdCardsPage();
    };
    return true;
  }

  function boot() {
    if (!install()) setTimeout(boot, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
