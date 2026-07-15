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

  window.sameId = function sameId(a, b) {
    return String(a) === String(b);
  };

  function toDateInput(value) {
    return value ? String(value).split('T')[0].slice(0, 10) : value;
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
})();
