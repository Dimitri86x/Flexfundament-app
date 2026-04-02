// =============================================
//  Einsatzberichte – Logic
// =============================================

// State
var currentId = null;
var workers = [];
var obstaclePhotos = [];
var reportPhotos = []; // { dataUrl, name, type, description }
var gpsLat = null;
var gpsLng = null;

// --- Init ---
initApp(function(user) {
  renderNav('reports');
  initCollapsibles();
  setupTags();
  setupActivityToggles();
  setupObstacleToggle();
  setupAllUploads();
  setupGps();
  populateProjectDropdowns();

  var editId = getUrlParam('id');
  var isNew = getUrlParam('new');
  if (editId) { openForm(editId); }
  else if (isNew) { openForm(null); }
  else { showList(); }

  if (isOnline) {
    syncWithFirebase('reports').then(function() {
      if (!currentId && !isNew) renderList();
    });
  }
});

// =============================================
//  PROJECT DROPDOWNS
// =============================================

function populateProjectDropdowns() {
  var projects = getActiveItems('projects');
  var opts = projects.map(function(p) {
    return '<option value="' + p.id + '">' + esc(p.name || 'Ohne Bezeichnung') + '</option>';
  }).join('');

  document.getElementById('fProject').innerHTML = '<option value="">Bitte waehlen</option>' + opts;
  document.getElementById('filterProject').innerHTML = '<option value="">Alle Projekte</option>' + opts;
}

// =============================================
//  LIST VIEW
// =============================================

function showList() {
  document.getElementById('listView').style.display = '';
  document.getElementById('formView').style.display = 'none';
  currentId = null;
  history.replaceState(null, '', 'reports.html');
  renderList();
}

function renderList() {
  var reports = getActiveItems('reports');
  var projFilter = document.getElementById('filterProject').value;
  var statusFilter = document.getElementById('filterStatus').value;

  var filtered = reports.filter(function(r) {
    if (projFilter && r.projectId !== projFilter) return false;
    if (statusFilter && (r.status || 'entwurf') !== statusFilter) return false;
    return true;
  });

  filtered.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

  var container = document.getElementById('reportList');
  if (filtered.length === 0) {
    container.innerHTML = '<p class="list-empty">Keine Einsatzberichte gefunden</p>';
    return;
  }

  container.innerHTML = filtered.map(function(r) {
    var status = r.status || 'entwurf';
    var badgeClass = status === 'abgeschlossen' ? 'badge-abgeschlossen' : 'badge-entwurf';
    var proj = r.projectId ? getItemById('projects', r.projectId) : null;
    var projName = proj ? proj.name : (r.projectName || 'Kein Projekt');
    var workerStr = (r.workers || []).join(', ');

    return '<div class="card card-clickable" data-id="' + r.id + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
        '<div style="min-width:0;flex:1;">' +
          '<div class="card-title">' + esc(projName) + '</div>' +
          '<div class="card-subtitle">' + (r.date ? formatDate(r.date) : '') +
            (workerStr ? ' &middot; ' + esc(workerStr) : '') + '</div>' +
        '</div>' +
        '<span class="badge ' + badgeClass + '" style="margin-left:8px;flex-shrink:0;">' + esc(status) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  container.querySelectorAll('[data-id]').forEach(function(card) {
    card.addEventListener('click', function() {
      openForm(card.getAttribute('data-id'));
    });
  });
}

document.getElementById('filterProject').addEventListener('change', renderList);
document.getElementById('filterStatus').addEventListener('change', renderList);
document.getElementById('btnNew').addEventListener('click', function() { openForm(null); });

// =============================================
//  FORM VIEW
// =============================================

function openForm(id) {
  document.getElementById('listView').style.display = 'none';
  document.getElementById('formView').style.display = '';
  workers = [];
  obstaclePhotos = [];
  reportPhotos = [];
  gpsLat = null;
  gpsLng = null;
  clearWarnings();

  if (id) {
    currentId = id;
    var r = getItemById('reports', id);
    if (!r) { showToast('Bericht nicht gefunden', 'error'); showList(); return; }
    document.getElementById('formTitle').textContent = 'Einsatzbericht bearbeiten';
    history.replaceState(null, '', 'reports.html?id=' + id);
    fillForm(r);
    document.getElementById('btnDelete').style.display = '';
    document.getElementById('btnPdf').style.display = '';
  } else {
    currentId = null;
    document.getElementById('formTitle').textContent = 'Neuer Einsatzbericht';
    history.replaceState(null, '', 'reports.html?new=1');
    resetForm();
    document.getElementById('btnDelete').style.display = 'none';
    document.getElementById('btnPdf').style.display = 'none';
  }
  window.scrollTo(0, 0);
}

function fillForm(r) {
  document.getElementById('fProject').value = r.projectId || '';
  document.getElementById('fDate').value = r.date || '';
  document.getElementById('fStatus').value = r.status || 'entwurf';
  document.getElementById('fTimeStart').value = r.timeStart || '';
  document.getElementById('fTimeEnd').value = r.timeEnd || '';

  workers = (r.workers || []).slice();
  renderTags();

  // Activities
  document.getElementById('actPull').checked = !!r.actPull;
  document.getElementById('actPullCount').value = r.actPullCount || '';
  toggleCountField('actPull', 'actPullCount');
  document.getElementById('actScrew').checked = !!r.actScrew;
  document.getElementById('actScrewCount').value = r.actScrewCount || '';
  toggleCountField('actScrew', 'actScrewCount');
  document.getElementById('actMontage').checked = !!r.actMontage;
  document.getElementById('actMontageCount').value = r.actMontageCount || '';
  toggleCountField('actMontage', 'actMontageCount');
  document.getElementById('actSurvey').checked = !!r.actSurvey;
  document.getElementById('actExtra').value = r.actExtra || '';

  // Obstacle
  document.getElementById('fObstacle').checked = !!r.obstacle;
  document.getElementById('obstacleFields').style.display = r.obstacle ? '' : 'none';
  document.getElementById('fObstacleReason').value = r.obstacleReason || '';
  document.getElementById('fObstacleDesc').value = r.obstacleDesc || '';
  obstaclePhotos = (r.obstaclePhotos || []).slice();
  renderObstacleGrid();

  // Notes
  document.getElementById('fNotes').value = r.notes || '';
  document.getElementById('fClientNotes').value = r.clientNotes || '';

  // Photos
  reportPhotos = (r.photos || []).map(function(p) {
    return { dataUrl: p.dataUrl, name: p.name, type: p.type, description: p.description || '' };
  });
  renderPhotosList();

  // GPS
  gpsLat = r.latitude || null;
  gpsLng = r.longitude || null;
  updateGpsUI();
}

function resetForm() {
  document.getElementById('reportForm').reset();
  workers = [];
  obstaclePhotos = [];
  reportPhotos = [];
  renderTags();
  renderObstacleGrid();
  renderPhotosList();
  document.getElementById('obstacleFields').style.display = 'none';
  ['actPullCount','actScrewCount','actMontageCount'].forEach(function(id) {
    document.getElementById(id).style.display = 'none';
  });
  var projId = getUrlParam('projectId');
  if (projId) {
    document.getElementById('fProject').value = projId;
    document.getElementById('fProject').setAttribute('disabled', 'disabled');
  }
  gpsLat = null;
  gpsLng = null;
  updateGpsUI();
}

function clearWarnings() {
  document.querySelectorAll('.form-warning,.form-error').forEach(function(w) {
    w.classList.remove('visible');
  });
}

// =============================================
//  TAGS INPUT (Mitarbeiter)
// =============================================

function setupTags() {
  var input = document.getElementById('fWorkerInput');
  var container = document.getElementById('tagsContainer');
  var acList = document.getElementById('workerAutocomplete');

  container.addEventListener('click', function() { input.focus(); });

  input.addEventListener('input', function() {
    var val = input.value.trim();
    if (val.length < 1) { acList.style.display = 'none'; return; }
    var suggestions = getAutocompleteSuggestions('reports', 'workers')
      .filter(function(s) { return s.toLowerCase().indexOf(val.toLowerCase()) !== -1 && workers.indexOf(s) === -1; });
    if (suggestions.length === 0) { acList.style.display = 'none'; return; }
    acList.innerHTML = suggestions.map(function(s) {
      return '<div class="autocomplete-item">' + esc(s) + '</div>';
    }).join('');
    acList.style.display = '';
    acList.querySelectorAll('.autocomplete-item').forEach(function(item) {
      item.addEventListener('click', function() {
        addWorker(item.textContent);
        input.value = '';
        acList.style.display = 'none';
      });
    });
  });

  input.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      addWorker(input.value.trim().replace(/,$/,''));
      input.value = '';
      acList.style.display = 'none';
    }
    if (e.key === 'Backspace' && !input.value && workers.length > 0) {
      workers.pop();
      renderTags();
    }
  });

  document.addEventListener('click', function(e) {
    if (!container.contains(e.target) && !acList.contains(e.target)) {
      acList.style.display = 'none';
    }
  });
}

function addWorker(name) {
  name = name.trim();
  if (name && workers.indexOf(name) === -1) {
    workers.push(name);
    renderTags();
  }
}

function renderTags() {
  var container = document.getElementById('tagsContainer');
  var input = document.getElementById('fWorkerInput');
  container.querySelectorAll('.tag').forEach(function(t) { t.remove(); });
  workers.forEach(function(w, i) {
    var tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = esc(w) + '<button type="button" class="tag-remove" data-i="' + i + '">&times;</button>';
    container.insertBefore(tag, input);
  });
  container.querySelectorAll('.tag-remove').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      workers.splice(parseInt(btn.getAttribute('data-i')), 1);
      renderTags();
    });
  });
}

// =============================================
//  ACTIVITY TOGGLES
// =============================================

function setupActivityToggles() {
  setupCountToggle('actPull', 'actPullCount');
  setupCountToggle('actScrew', 'actScrewCount');
  setupCountToggle('actMontage', 'actMontageCount');
}

function setupCountToggle(cbId, countId) {
  document.getElementById(cbId).addEventListener('change', function() {
    toggleCountField(cbId, countId);
  });
}

function toggleCountField(cbId, countId) {
  document.getElementById(countId).style.display = document.getElementById(cbId).checked ? '' : 'none';
}

// =============================================
//  OBSTACLE TOGGLE
// =============================================

function setupObstacleToggle() {
  document.getElementById('fObstacle').addEventListener('change', function() {
    document.getElementById('obstacleFields').style.display = this.checked ? '' : 'none';
  });
}

// =============================================
//  FILE UPLOADS (generic)
// =============================================

function setupAllUploads() {
  document.querySelectorAll('.btn-upload').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.getElementById(btn.getAttribute('data-target')).click();
    });
  });

  // Obstacle photos
  ['inputObsCam','inputObsGal','inputObsFile'].forEach(function(id) {
    document.getElementById(id).addEventListener('change', function(e) {
      handleFiles(e, function(file) {
        obstaclePhotos.push(file);
        renderObstacleGrid();
      });
    });
  });

  // Report photos
  ['inputPhotoCam','inputPhotoGal','inputPhotoFile'].forEach(function(id) {
    document.getElementById(id).addEventListener('change', function(e) {
      handleFiles(e, function(file) {
        file.description = '';
        reportPhotos.push(file);
        renderPhotosList();
      });
    });
  });
}

function handleFiles(e, onEach) {
  var files = Array.from(e.target.files);
  files.forEach(function(file) {
    var isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      var reader = new FileReader();
      reader.onload = function() { onEach({ dataUrl: reader.result, name: file.name, type: 'pdf' }); };
      reader.readAsDataURL(file);
    } else {
      compressImage(file, 1920, 5).then(function(blob) {
        var reader = new FileReader();
        reader.onload = function() { onEach({ dataUrl: reader.result, name: file.name, type: 'image' }); };
        reader.readAsDataURL(blob);
      });
    }
  });
  e.target.value = '';
}

function renderObstacleGrid() {
  var grid = document.getElementById('obstaclePhotoGrid');
  if (obstaclePhotos.length === 0) { grid.innerHTML = ''; return; }
  grid.innerHTML = obstaclePhotos.map(function(f, i) {
    var inner = f.type === 'pdf'
      ? '<div class="photo-thumb-pdf">&#128196;<br>' + esc(f.name) + '</div>'
      : '<img src="' + f.dataUrl + '" alt="Foto">';
    return '<div class="photo-thumb">' + inner +
      '<button type="button" class="photo-remove" data-i="' + i + '">&times;</button></div>';
  }).join('');
  grid.querySelectorAll('.photo-remove').forEach(function(btn) {
    btn.addEventListener('click', function() {
      obstaclePhotos.splice(parseInt(btn.getAttribute('data-i')), 1);
      renderObstacleGrid();
    });
  });
}

function renderPhotosList() {
  var container = document.getElementById('photosList');
  if (reportPhotos.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = reportPhotos.map(function(p, i) {
    var preview = p.type === 'pdf'
      ? '<div class="photo-thumb-pdf">&#128196; ' + esc(p.name) + '</div>'
      : '<img src="' + p.dataUrl + '" alt="Foto" style="max-width:100%;max-height:200px;border-radius:4px;">';
    return '<div class="photo-item">' + preview +
      '<input type="text" class="form-input mt-sm" placeholder="Beschreibung..." value="' + esc(p.description || '') + '" data-photo-i="' + i + '">' +
      '<button type="button" class="btn btn-danger mt-sm" data-rm-photo="' + i + '" style="font-size:.8rem;padding:4px 8px;">Entfernen</button>' +
    '</div>';
  }).join('');

  container.querySelectorAll('[data-photo-i]').forEach(function(input) {
    input.addEventListener('input', function() {
      reportPhotos[parseInt(input.getAttribute('data-photo-i'))].description = input.value;
    });
  });
  container.querySelectorAll('[data-rm-photo]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      reportPhotos.splice(parseInt(btn.getAttribute('data-rm-photo')), 1);
      renderPhotosList();
    });
  });
}

// =============================================
//  SAVE
// =============================================

document.getElementById('reportForm').addEventListener('submit', function(e) {
  e.preventDefault();
  console.log('[Reports] Save triggered');

  try {
    clearWarnings();

    var data = {
      projectId: document.getElementById('fProject').value,
      date: document.getElementById('fDate').value,
      workers: workers.slice(),
      status: document.getElementById('fStatus').value,
      timeStart: document.getElementById('fTimeStart').value,
      timeEnd: document.getElementById('fTimeEnd').value,
      actPull: document.getElementById('actPull').checked,
      actPullCount: document.getElementById('actPullCount').value,
      actScrew: document.getElementById('actScrew').checked,
      actScrewCount: document.getElementById('actScrewCount').value,
      actMontage: document.getElementById('actMontage').checked,
      actMontageCount: document.getElementById('actMontageCount').value,
      actSurvey: document.getElementById('actSurvey').checked,
      actExtra: document.getElementById('actExtra').value.trim(),
      obstacle: document.getElementById('fObstacle').checked,
      obstacleReason: document.getElementById('fObstacleReason').value,
      obstacleDesc: document.getElementById('fObstacleDesc').value.trim(),
      obstaclePhotos: obstaclePhotos,
      notes: document.getElementById('fNotes').value.trim(),
      clientNotes: document.getElementById('fClientNotes').value.trim(),
      photos: reportPhotos,
      latitude: gpsLat || '',
      longitude: gpsLng || ''
    };

    // Store project name for display
    var proj = data.projectId ? getItemById('projects', data.projectId) : null;
    data.projectName = proj ? proj.name : '';

    console.log('[Reports] Data collected, projectId=' + data.projectId);

    // Validate (warnings only, never block save)
    var hasWarning = false;
    function warn(id, cond) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('visible', cond);
      if (cond) hasWarning = true;
    }

    warn('wProject', !data.projectId);
    warn('wDate', !data.date);
    warn('wWorkers', workers.length === 0);
    warn('wTimeStart', !data.timeStart);
    warn('wTimeEnd', !data.timeEnd);
    warn('wNotes', !data.notes);

    if (data.timeStart && data.timeEnd && data.timeEnd <= data.timeStart) {
      var eEl = document.getElementById('eTimeEnd');
      if (eEl) eEl.classList.add('visible');
      hasWarning = true;
    }

    var hasActivity = data.actPull || data.actScrew || data.actMontage || data.actSurvey || data.actExtra;
    warn('wActivity', !hasActivity);

    if (data.obstacle) warn('wObstacleDesc', !data.obstacleDesc);

    // Save
    var id = currentId || generateId();
    console.log('[Reports] Saving id=' + id);

    try {
      saveToLocal('reports', id, data);
    } catch (storageErr) {
      console.error('[Reports] localStorage error:', storageErr);
      showToast('Speicherfehler: ' + storageErr.message, 'error');
      return;
    }

    console.log('[Reports] Saved successfully');
    showToast(hasWarning ? 'Gespeichert (fehlende Pflichtfelder)' : 'Einsatzbericht gespeichert', hasWarning ? 'warning' : 'success');

    currentId = id;
    history.replaceState(null, '', 'reports.html?id=' + id);
    document.getElementById('formTitle').textContent = 'Einsatzbericht bearbeiten';
    document.getElementById('btnDelete').style.display = '';
    document.getElementById('btnPdf').style.display = '';

    // Auto-transfer GPS to project if project has no coordinates
    if (gpsLat && gpsLng && data.projectId) {
      var proj = getItemById('projects', data.projectId);
      if (proj && !proj.lat && !proj.lng) {
        proj.lat = String(gpsLat);
        proj.lng = String(gpsLng);
        saveToLocal('projects', data.projectId, proj);
        showToast('Koordinaten wurden ins Projekt uebernommen', 'success');
      }
    }
  } catch (err) {
    console.error('[Reports] Unexpected save error:', err);
    showToast('Fehler beim Speichern: ' + err.message, 'error');
  }
});

// =============================================
//  DELETE / BACK
// =============================================

document.getElementById('btnDelete').addEventListener('click', function() {
  if (!currentId) return;
  var r = getItemById('reports', currentId);
  if (softDelete('reports', currentId, r ? (r.projectName || 'Einsatzbericht') : '')) {
    showToast('Einsatzbericht geloescht', 'success');
    showList();
  }
});

document.getElementById('btnBack').addEventListener('click', function() {
  var projId = getUrlParam('projectId');
  if (projId) {
    window.location.href = 'projects.html?id=' + projId;
  } else if (currentId) {
    showList();
  } else {
    showList();
  }
});

// =============================================
//  PDF EXPORT
// =============================================

document.getElementById('btnPdf').addEventListener('click', function() {
  console.log('[PDF] Export triggered, currentId=' + currentId);

  if (!currentId) {
    showToast('Bitte zuerst speichern', 'error');
    return;
  }

  // Check jsPDF availability
  var jsPDFClass = null;
  if (window.jspdf && window.jspdf.jsPDF) {
    jsPDFClass = window.jspdf.jsPDF;
    console.log('[PDF] jsPDF found via window.jspdf.jsPDF');
  } else if (window.jsPDF) {
    jsPDFClass = window.jsPDF;
    console.log('[PDF] jsPDF found via window.jsPDF');
  } else {
    console.error('[PDF] jsPDF not available. window.jspdf=', window.jspdf, 'window.jsPDF=', window.jsPDF);
    showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error');
    return;
  }

  var r = getItemById('reports', currentId);
  if (!r) {
    showToast('Bericht nicht gefunden', 'error');
    return;
  }

  try {
    console.log('[PDF] Creating document...');
    var doc = new jsPDFClass({ unit: 'mm', format: 'a4' });
    var y = 20;
    var lm = 15;
    var pw = 180;
    var lh = 7;

    function checkPage(needed) {
      if (y + needed > 275) { doc.addPage(); y = 20; }
    }

    function heading(text) {
      checkPage(14);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(text, lm, y);
      y += 9;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
    }

    function line(label, value) {
      if (!value && value !== 0) return;
      checkPage(lh);
      doc.setFont(undefined, 'bold');
      var labelStr = label + ': ';
      doc.text(labelStr, lm, y);
      var labelW = doc.getTextWidth(labelStr);
      doc.setFont(undefined, 'normal');
      var lines = doc.splitTextToSize(String(value), pw - labelW);
      doc.text(lines, lm + labelW, y);
      y += lh * Math.max(1, lines.length);
    }

    function multiline(value) {
      if (!value) return;
      checkPage(lh);
      doc.setFont(undefined, 'normal');
      var lines = doc.splitTextToSize(String(value), pw);
      checkPage(lh * lines.length);
      doc.text(lines, lm, y);
      y += lh * lines.length + 2;
    }

    // Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Einsatzbericht', lm, y);
    y += 12;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    // Project
    var proj = r.projectId ? getItemById('projects', r.projectId) : null;
    heading('Projektdaten');
    line('Projekt', proj ? proj.name : (r.projectName || '-'));
    if (proj) {
      var addr = [proj.street, proj.zip, proj.city].filter(Boolean).join(', ');
      if (addr) line('Adresse', addr);
    }
    line('Datum', r.date ? formatDate(r.date) : '-');
    line('Mitarbeiter', (r.workers || []).join(', ') || '-');
    line('Status', r.status || 'entwurf');

    // Time
    heading('Zeiterfassung');
    line('Beginn', r.timeStart || '-');
    line('Ende', r.timeEnd || '-');

    // Activities
    heading('Taetigkeiten');
    if (r.actPull) line('Auszugversuch', r.actPullCount || 'Ja');
    if (r.actScrew) line('Eindrehversuch', r.actScrewCount || 'Ja');
    if (r.actMontage) line('Montage', r.actMontageCount || 'Ja');
    if (r.actSurvey) line('Einmessen', 'Ja');
    if (r.actExtra) line('Zusatzleistung', r.actExtra);
    if (!r.actPull && !r.actScrew && !r.actMontage && !r.actSurvey && !r.actExtra) {
      multiline('Keine Taetigkeiten angegeben');
    }

    // Obstacle
    if (r.obstacle) {
      heading('Bauverhinderung');
      line('Grund', r.obstacleReason || '-');
      if (r.obstacleDesc) {
        line('Beschreibung', '');
        multiline(r.obstacleDesc);
      }
    }

    // Notes
    if (r.notes) {
      heading('Notizen / Baufortschritt');
      multiline(r.notes);
    }

    if (r.clientNotes) {
      heading('Gespraechsnotizen mit AG');
      multiline(r.clientNotes);
    }

    // Photos
    var imagePhotos = (r.photos || []).filter(function(p) { return p.type === 'image' && p.dataUrl; });
    if (imagePhotos.length > 0) {
      heading('Fotos');
      imagePhotos.forEach(function(p, idx) {
        try {
          checkPage(70);
          doc.addImage(p.dataUrl, 'JPEG', lm, y, 80, 60);
          y += 62;
          if (p.description) {
            checkPage(lh);
            doc.setFontSize(9);
            doc.text(p.description, lm, y);
            doc.setFontSize(10);
            y += lh;
          }
          y += 4;
        } catch (imgErr) {
          console.warn('[PDF] Foto ' + idx + ' konnte nicht eingefuegt werden:', imgErr);
        }
      });
    }

    // Save PDF
    var filename = 'Einsatzbericht_' + (r.date || 'ohne-datum') + '.pdf';
    console.log('[PDF] Saving as ' + filename);
    doc.save(filename);
    showToast('PDF erstellt: ' + filename, 'success');

  } catch (pdfErr) {
    console.error('[PDF] Error creating PDF:', pdfErr);
    showToast('PDF-Fehler: ' + pdfErr.message, 'error');
  }
});

// =============================================
//  GPS
// =============================================

function setupGps() {
  document.getElementById('btnGps').addEventListener('click', function() {
    if (!navigator.geolocation) {
      showToast('GPS wird von diesem Geraet nicht unterstuetzt', 'error');
      return;
    }
    var btn = document.getElementById('btnGps');
    btn.disabled = true;
    btn.textContent = 'Standort wird ermittelt...';

    navigator.geolocation.getCurrentPosition(function(pos) {
      gpsLat = parseFloat(pos.coords.latitude.toFixed(6));
      gpsLng = parseFloat(pos.coords.longitude.toFixed(6));
      updateGpsUI();
      btn.disabled = false;
      showToast('Standort erfasst', 'success');
    }, function(err) {
      console.error('[GPS] Error:', err);
      btn.disabled = false;
      btn.textContent = '\uD83D\uDCCD Standort erfassen';
      var msg = 'Standortermittlung fehlgeschlagen';
      if (err.code === 1) msg = 'Standortzugriff verweigert. Bitte in den Einstellungen erlauben.';
      if (err.code === 2) msg = 'Standort nicht verfuegbar';
      if (err.code === 3) msg = 'Zeitueberschreitung bei Standortermittlung';
      showToast(msg, 'error');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

function updateGpsUI() {
  var result = document.getElementById('gpsResult');
  var btn = document.getElementById('btnGps');
  if (gpsLat && gpsLng) {
    result.style.display = '';
    document.getElementById('gpsCoords').textContent = gpsLat + ', ' + gpsLng;
    document.getElementById('gpsMapLink').href = 'https://www.google.com/maps?q=' + gpsLat + ',' + gpsLng;
    btn.textContent = '\uD83D\uDCCD Standort aktualisieren';
  } else {
    result.style.display = 'none';
    btn.textContent = '\uD83D\uDCCD Standort erfassen';
  }
}

// =============================================
//  HELPERS
// =============================================

function esc(str) {
  var d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
