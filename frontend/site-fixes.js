(function () {
  'use strict';

  var ID_FIELDS = [
    'id',
    'employee_id',
    'training_id',
    'client_id',
    'project_id',
    'equipment_id',
    'equipment_document_id',
    'medical_exam_id',
    'epi_record_id',
    'technical_document_id',
    'certificate_id',
    'competency_requirement_id',
    'user_id',
    'created_by',
    'entity_id'
  ];

  var DATE_FIELDS = [
    'birth_date',
    'admission_date',
    'issue_date',
    'expiration_date',
    'delivery_date',
    'replacement_date',
    'start_date',
    'end_date',
    'created_at',
    'updated_at'
  ];

  var textObserverInstalled = false;
  var normalizingText = false;
  var TEXT_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP_TEXT_TAGS = {
    SCRIPT: true,
    STYLE: true,
    CODE: true,
    PRE: true,
    TEXTAREA: true,
    INPUT: true,
    SELECT: true
  };

  window.sameId = function sameId(a, b) {
    return String(a) === String(b);
  };

  function toDateInput(value) {
    return value ? String(value).split('T')[0].slice(0, 10) : value;
  }

  function decodeHtmlEntities(value) {
    if (!value || String(value).indexOf('&') === -1) return value;
    var box = document.createElement('textarea');
    box.innerHTML = String(value);
    return box.value;
  }

  function repairMojibake(value) {
    value = value == null ? '' : String(value);
    if (!/[ÃÂâ]/.test(value) || typeof TextDecoder === 'undefined') return value;

    try {
      var bytes = new Uint8Array(value.length);
      for (var i = 0; i < value.length; i += 1) {
        bytes[i] = value.charCodeAt(i) & 255;
      }
      var fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (fixed && fixed.indexOf('\uFFFD') === -1) return fixed;
    } catch (error) {
      // Fallback abaixo cobre os casos mais comuns sem depender do decoder.
    }

    return value
      .replace(/Ã¡/g, 'á').replace(/Ã /g, 'à').replace(/Ã¢/g, 'â').replace(/Ã£/g, 'ã')
      .replace(/Ã©/g, 'é').replace(/Ãª/g, 'ê').replace(/Ã­/g, 'í')
      .replace(/Ã³/g, 'ó').replace(/Ã´/g, 'ô').replace(/Ãµ/g, 'õ')
      .replace(/Ãº/g, 'ú').replace(/Ã§/g, 'ç')
      .replace(/Ã/g, 'Á').replace(/Ã€/g, 'À').replace(/Ã‚/g, 'Â').replace(/Ãƒ/g, 'Ã')
      .replace(/Ã‰/g, 'É').replace(/ÃŠ/g, 'Ê').replace(/Ã/g, 'Í')
      .replace(/Ã“/g, 'Ó').replace(/Ã”/g, 'Ô').replace(/Ã•/g, 'Õ')
      .replace(/Ãš/g, 'Ú').replace(/Ã‡/g, 'Ç')
      .replace(/Âº/g, 'º').replace(/Âª/g, 'ª').replace(/Â·/g, '·').replace(/Â/g, '')
      .replace(/â€“/g, '-').replace(/â€”/g, '-').replace(/â€™/g, "'").replace(/â€œ|â€/g, '"');
  }

  function normalizeTextValue(value) {
    if (value == null) return value;
    return repairMojibake(decodeHtmlEntities(value));
  }

  function shouldSkipTextNode(node) {
    var parent = node && node.parentElement;
    while (parent) {
      if (SKIP_TEXT_TAGS[parent.tagName] || parent.hasAttribute('data-no-text-normalize')) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function normalizeTextNode(node) {
    if (!node || shouldSkipTextNode(node)) return;
    var next = normalizeTextValue(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function normalizeElementAttrs(element) {
    if (!element || element.nodeType !== 1 || element.hasAttribute('data-no-text-normalize')) return;
    TEXT_ATTRS.forEach(function (attr) {
      if (!element.hasAttribute(attr)) return;
      var current = element.getAttribute(attr);
      var next = normalizeTextValue(current);
      if (next !== current) element.setAttribute(attr, next);
    });
  }

  function normalizeAppText(root) {
    if (normalizingText || !root) return;
    normalizingText = true;
    try {
      if (root.nodeType === Node.TEXT_NODE) {
        normalizeTextNode(root);
        return;
      }

      if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
      if (root.nodeType === Node.ELEMENT_NODE) normalizeElementAttrs(root);

      var textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var textNode = textWalker.nextNode();
      while (textNode) {
        normalizeTextNode(textNode);
        textNode = textWalker.nextNode();
      }

      var elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      var element = elementWalker.nextNode();
      while (element) {
        normalizeElementAttrs(element);
        element = elementWalker.nextNode();
      }
    } finally {
      normalizingText = false;
    }
  }

  function installTextObserver() {
    if (textObserverInstalled || !document.body || typeof MutationObserver === 'undefined') return;
    textObserverInstalled = true;
    var observer = new MutationObserver(function (mutations) {
      if (normalizingText) return;
      mutations.forEach(function (mutation) {
        if (mutation.type === 'characterData') {
          normalizeAppText(mutation.target);
          return;
        }
        Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
          normalizeAppText(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function normalizeRecord(record) {
    if (!record || typeof record !== 'object') return record;

    ID_FIELDS.forEach(function (field) {
      if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
        record[field] = String(record[field]);
      }
    });

    DATE_FIELDS.forEach(function (field) {
      if (record[field]) record[field] = toDateInput(record[field]);
    });

    if (Array.isArray(record.required_training_ids)) {
      record.required_training_ids = record.required_training_ids.map(String);
    }

    return record;
  }

  function getLiveDB() {
    try {
      if (typeof window.getDB === 'function') return window.getDB();
    } catch (err) {}

    if (window.db && typeof window.db === 'object') return window.db;
    return null;
  }

  function normalizeCollections(db) {
    if (!db || typeof db !== 'object') return db;

    Object.keys(db).forEach(function (key) {
      if (Array.isArray(db[key])) db[key].forEach(normalizeRecord);
    });

    if (db.dashboard) normalizeDashboard(db.dashboard);
    return db;
  }

  function setBoth(target, camelKey, snakeKey) {
    if (!target || typeof target !== 'object') return;
    var value = target[camelKey];
    if (value === undefined) value = target[snakeKey];
    if (value === undefined || value === null) value = 0;
    target[camelKey] = value;
    target[snakeKey] = value;
  }

  function normalizeDashboard(dashboard) {
    if (!dashboard || typeof dashboard !== 'object') return dashboard;

    [
      ['activeEmployees', 'active_employees'],
      ['validNRs', 'valid_nrs'],
      ['expiringNRs', 'expiring_nrs'],
      ['expiredNRs', 'expired_nrs'],
      ['validCertificates', 'valid_certificates'],
      ['expiringCertificates', 'expiring_certificates'],
      ['expiredCertificates', 'expired_certificates'],
      ['expiredASO', 'expired_aso'],
      ['equipment', 'equipment_count'],
      ['totalEquipment', 'total_equipment'],
      ['guindastes', 'guindastes_count'],
      ['totalCranes', 'total_cranes'],
      ['expiredReports', 'expired_reports'],
      ['expiredLaudos', 'expired_laudos'],
      ['activeProjects', 'active_projects'],
      ['issuedCertificates', 'issued_certificates'],
      ['totalCertificates', 'total_certificates'],
      ['cancelledCertificates', 'cancelled_certificates'],
      ['clients', 'clients_count'],
      ['totalClients', 'total_clients']
    ].forEach(function (pair) {
      setBoth(dashboard, pair[0], pair[1]);
    });

    return dashboard;
  }

  function normalizeLiveData() {
    normalizeCollections(getLiveDB());
  }

  function patchRefreshData() {
    if (typeof window.refreshData !== 'function' || window.refreshData.__imecPatched) return false;

    var originalRefreshData = window.refreshData;
    window.refreshData = async function () {
      var result = await originalRefreshData.apply(this, arguments);
      normalizeLiveData();
      return result;
    };
    window.refreshData.__imecPatched = true;

    normalizeLiveData();
    return true;
  }

  function patchEditFunctions() {
    [
      'editEmployee',
      'viewEmployee',
      'editTraining',
      'editCertificate',
      'editASO',
      'editEPI',
      'editEquipment',
      'editClient',
      'editProject',
      'editDocument',
      'editRequirement'
    ].forEach(function (name) {
      var fn = window[name];
      if (typeof fn !== 'function' || fn.__imecPatched) return;

      window[name] = function () {
        normalizeLiveData();
        return fn.apply(this, arguments);
      };
      window[name].__imecPatched = true;
    });
  }

  function boot(attempt) {
    normalizeAppText(document.body);
    installTextObserver();
    patchRefreshData();
    patchEditFunctions();
    normalizeLiveData();

    if (attempt < 30) {
      setTimeout(function () { boot(attempt + 1); }, 250);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(0); });
  } else {
    boot(0);
  }

  window.normalizeAppText = normalizeAppText;
})();
