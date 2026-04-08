/**
 * Flexfundament-app – Testdaten-Seeder
 * =====================================
 * In der Browser-Konsole ausführen (als Admin eingeloggt, auf einer App-Seite wie dashboard.html).
 *
 * Was dieser Seeder anlegt:
 *   – 10 Projekte (verschiedene Typen, Orte, Status)
 *   – je 3 Kosten pro Projekt (Mischung offen/bezahlt)
 *   – je 2 Fahrten pro Projekt
 *   – je 2 Einsatzberichte pro Projekt
 *
 * Benutzer und Projektzuweisungen müssen über admin.html angelegt werden
 * (pendingUsers-Flow, dann Aktivierung) – siehe Testplan unten.
 *
 * Nach Ausführung: Seite neu laden oder syncWithFirebase() aufrufen.
 */

(function() {

  // --- Voraussetzungen prüfen ---
  if (typeof saveToLocal !== 'function' || typeof generateId !== 'function') {
    console.error('[Seeder] App-Funktionen nicht gefunden. Seite mit eingeloggtem Admin öffnen.');
    return;
  }
  var user = firebase && firebase.auth && firebase.auth().currentUser;
  if (!user) {
    console.error('[Seeder] Kein eingeloggter Benutzer gefunden.');
    return;
  }
  var uid  = user.uid;
  var name = user.displayName || user.email || 'Seeder';
  console.log('[Seeder] Starte als:', name);

  function ts(offsetDays) {
    return Date.now() - offsetDays * 86400000;
  }
  function isoDate(offsetDays) {
    var d = new Date(Date.now() - offsetDays * 86400000);
    return d.toISOString().split('T')[0];
  }

  // ---------------------------------------------------------------
  // PROJEKTE
  // ---------------------------------------------------------------
  var projects = [
    {
      name: 'Steganlage Firstbase Bremen',
      type: 'Belastungsversuch',
      client: 'Firstbase Immobilien GmbH',
      contact: 'Thomas Ritter',
      phone: '+49 421 123456',
      street: 'Industriestrasse 12',
      zip: '28199',
      city: 'Bremen',
      executionDate: isoDate(-5),
      executionTime: '08:00',
      status: 'aktiv',
      material: 'Schraubanker Typ SPA-R 200',
      machinery: 'Eindrehgerät EG-350'
    },
    {
      name: 'Wohnanlage Gartenstrasse Hamburg',
      type: 'Montage',
      client: 'Nordbau AG',
      contact: 'Sandra Meier',
      phone: '+49 40 987654',
      street: 'Gartenstrasse 44',
      zip: '20255',
      city: 'Hamburg',
      executionDate: isoDate(3),
      executionTime: '07:30',
      status: 'aktiv',
      material: 'Schraubanker SPA-D 150, SPA-D 200',
      machinery: 'Hydraulischer Drehmomentverstärker'
    },
    {
      name: 'Gewerbepark Mühlendorf',
      type: 'Montage',
      client: 'Mühlendorf Projektentwicklung KG',
      contact: 'Klaus Brandt',
      phone: '+49 531 445566',
      street: 'Gewerbepark 8',
      zip: '38112',
      city: 'Braunschweig',
      executionDate: isoDate(10),
      executionTime: '09:00',
      status: 'aktiv',
      material: 'Fertigfundamente FF-400 Serie',
      machinery: 'Kran 50t, Bagger CAT 320'
    },
    {
      name: 'Pflegeheim Sonnenhang Freiburg',
      type: 'Belastungsversuch',
      client: 'Caritas Freiburg e.V.',
      contact: 'Ingrid Holz',
      phone: '+49 761 334455',
      street: 'Sonnenhang 3',
      zip: '79100',
      city: 'Freiburg',
      executionDate: isoDate(-12),
      executionTime: '08:30',
      status: 'abgeschlossen',
      material: 'Mikropfahl MP-200',
      machinery: 'Bohrgerät Klemm KR 806'
    },
    {
      name: 'Sporthalle Westpark München',
      type: 'Baubesprechung',
      client: 'Landeshauptstadt München',
      contact: 'Peter Gruber',
      phone: '+49 89 22334455',
      street: 'Westparkstrasse 10',
      zip: '81377',
      city: 'München',
      executionDate: isoDate(1),
      executionTime: '10:00',
      status: 'aktiv',
      material: 'keine (Besprechungstermin)',
      machinery: 'keine'
    },
    {
      name: 'Bürogebäude Kaiserslautern',
      type: 'Montage',
      client: 'KL Invest GmbH',
      contact: 'Frank Weber',
      phone: '+49 631 556677',
      street: 'Barbarossastrasse 55',
      zip: '67657',
      city: 'Kaiserslautern',
      executionDate: isoDate(-20),
      executionTime: '07:00',
      status: 'abgeschlossen',
      material: 'Schraubanker SPA-R 300, SPA-R 400',
      machinery: 'Eindrehgerät EG-500, Kran 35t'
    },
    {
      name: 'Logistikzentrum Hannover-Nord',
      type: 'Montage',
      client: 'LogiTrans Hannover GmbH',
      contact: 'Monika Schäfer',
      phone: '+49 511 778899',
      street: 'Nordring 77',
      zip: '30419',
      city: 'Hannover',
      executionDate: isoDate(14),
      executionTime: '06:00',
      status: 'aktiv',
      material: 'Flexfundament 6-Element Serie 7',
      machinery: 'Rüttelplatte, Kompressor Atlas Copco'
    },
    {
      name: 'Kita Regenbogen Köln',
      type: 'Belastungsversuch',
      client: 'Stadt Köln, Amt für Stadtentwicklung',
      contact: 'Renate Fischer',
      phone: '+49 221 334422',
      street: 'Regenbogenweg 12',
      zip: '50737',
      city: 'Köln',
      executionDate: isoDate(-2),
      executionTime: '08:00',
      status: 'aktiv',
      material: 'Zugpfahl ZP-160, Druckpfahl DP-200',
      machinery: 'Hydraulische Presse HYD-200'
    },
    {
      name: 'Industriehalle Dortmund-Ost',
      type: 'Montage',
      client: 'RuhrSteel AG',
      contact: 'Heinrich Bauer',
      phone: '+49 231 990011',
      street: 'Stahlstrasse 1',
      zip: '44357',
      city: 'Dortmund',
      executionDate: isoDate(7),
      executionTime: '07:00',
      status: 'aktiv',
      material: 'Flexfundament FG-800 Industrie',
      machinery: 'Gabelstapler, Bagger JCB 3CX'
    },
    {
      name: 'Neubau Mehrfamilienhaus Erfurt',
      type: 'Baubesprechung',
      client: 'Thüringer Wohnbau eG',
      contact: 'Ursula König',
      phone: '+49 361 667788',
      street: 'Gründerzeitstrasse 27',
      zip: '99089',
      city: 'Erfurt',
      executionDate: isoDate(-30),
      executionTime: '13:00',
      status: 'abgeschlossen',
      material: 'noch offen',
      machinery: 'noch offen'
    }
  ];

  var projectIds = [];
  projects.forEach(function(p, i) {
    var id = generateId();
    projectIds.push(id);
    var now = ts(30 - i * 3);
    saveToLocal('projects', id, Object.assign({}, p, {
      roughStaking: i % 3 === 0,
      heightRef: i % 2 === 0,
      conditionsSigned: i % 4 !== 0,
      accessDescription: 'Zufahrt über Nebeneingang, Parkplatz vorhanden.',
      lat: '',
      lng: '',
      accessFiles: [],
      docStatuses: ['vorhanden', '', 'fehlt', '', '', '', '', ''],
      createdAt: now,
      createdByUid: uid,
      createdByName: name
    }));
  });
  console.log('[Seeder] 10 Projekte angelegt:', projectIds);

  // ---------------------------------------------------------------
  // KOSTEN
  // ---------------------------------------------------------------
  var costCategories = ['Sprit', 'Hotel', 'Maut', 'Material', 'Parken', 'Verpflegung', 'Werkzeug', 'Sonstiges'];
  var costData = [
    { category: 'Sprit',       amount: 87.40,  status: 'offen',   daysAgo: 6 },
    { category: 'Hotel',       amount: 145.00, status: 'bezahlt', daysAgo: 7 },
    { category: 'Maut',        amount: 24.80,  status: 'offen',   daysAgo: 8 }
  ];

  projectIds.forEach(function(projectId, pi) {
    var proj = projects[pi];
    costData.forEach(function(c, ci) {
      var id = generateId();
      var now = ts(c.daysAgo + pi);
      saveToLocal('costs', id, {
        projectId: projectId,
        projectName: proj.name,
        date: isoDate(c.daysAgo + pi),
        employee: pi % 2 === 0 ? 'Max Mustermann' : 'Lena Hoffmann',
        category: c.category,
        amount: c.amount + pi * 2,
        notes: 'Testkosten Projekt ' + (pi + 1) + ' / Posten ' + (ci + 1),
        status: c.status,
        photos: [],
        createdAt: now,
        createdByUid: uid,
        createdByName: name
      });
    });
  });
  console.log('[Seeder] 30 Kostenpositionen angelegt (3 je Projekt)');

  // ---------------------------------------------------------------
  // FAHRTEN
  // ---------------------------------------------------------------
  var driveData = [
    { from: 'Büro Flexfundament',  daysAgo: 4,  km1: 14230, km2: 14312, purpose: 'Baustellenfahrt' },
    { from: 'Lager Nord',          daysAgo: 5,  km1: 98440, km2: 98501, purpose: 'Materialtransport' }
  ];

  var cities = projects.map(function(p) { return p.city; });
  projectIds.forEach(function(projectId, pi) {
    var proj = projects[pi];
    driveData.forEach(function(d, di) {
      var id = generateId();
      var now = ts(d.daysAgo + pi);
      saveToLocal('drives', id, {
        projectId: projectId,
        projectName: proj.name,
        date: isoDate(d.daysAgo + pi),
        driver: pi % 2 === 0 ? 'Max Mustermann' : 'Lena Hoffmann',
        vehicle: di % 2 === 0 ? 'VW Transporter T6 – HB-FF 101' : 'Mercedes Sprinter – HB-FF 202',
        startLocation: d.from,
        endLocation: proj.city + ' Baustelle',
        kmStart: d.km1 + pi * 100,
        kmEnd: d.km2 + pi * 100,
        purpose: d.purpose,
        notes: 'Testfahrt zu ' + proj.name,
        photos: [],
        createdAt: now,
        createdByUid: uid,
        createdByName: name
      });
    });
  });
  console.log('[Seeder] 20 Fahrten angelegt (2 je Projekt)');

  // ---------------------------------------------------------------
  // EINSATZBERICHTE
  // ---------------------------------------------------------------
  var reportData = [
    { daysAgo: 6, status: 'entwurf',      workers: ['Max Mustermann', 'Lena Hoffmann'] },
    { daysAgo: 13, status: 'abgeschlossen', workers: ['Max Mustermann'] }
  ];

  projectIds.forEach(function(projectId, pi) {
    var proj = projects[pi];
    reportData.forEach(function(r, ri) {
      var id = generateId();
      var now = ts(r.daysAgo + pi);
      saveToLocal('reports', id, {
        projectId: projectId,
        projectName: proj.name,
        date: isoDate(r.daysAgo + pi),
        status: r.status,
        workers: r.workers.slice(),
        timeStart: '07:30',
        timeEnd: '16:00',
        actPull: ri % 2 === 0,
        actPullCount: ri % 2 === 0 ? 3 : 0,
        actScrew: ri % 2 !== 0,
        actScrewCount: ri % 2 !== 0 ? 5 : 0,
        actMontage: pi % 3 === 0,
        actMontageCount: pi % 3 === 0 ? 2 : 0,
        actSurvey: false,
        actExtra: '',
        obstacle: pi === 2 && ri === 0,
        obstacleReason: pi === 2 && ri === 0 ? 'Zufahrt gesperrt' : '',
        obstacleDesc: pi === 2 && ri === 0 ? 'Bahnschranke defekt, 2h Wartezeit.' : '',
        obstaclePhotos: [],
        notes: 'Arbeiten planmäßig verlaufen. Boden trocken.',
        clientNotes: '',
        photos: [],
        latitude: '',
        longitude: '',
        createdAt: now,
        createdByUid: uid,
        createdByName: name
      });
    });
  });
  console.log('[Seeder] 20 Einsatzberichte angelegt (2 je Projekt)');

  // ---------------------------------------------------------------
  // ZUSAMMENFASSUNG
  // ---------------------------------------------------------------
  console.log('\n=== SEEDER ABGESCHLOSSEN ===');
  console.log('Projekte:        10');
  console.log('Kosten:          30 (3 je Projekt, Mix offen/bezahlt)');
  console.log('Fahrten:         20 (2 je Projekt)');
  console.log('Einsatzberichte: 20 (2 je Projekt, entwurf + abgeschlossen)');
  console.log('\nNächster Schritt: Seite neu laden (F5) um Daten anzuzeigen.');
  console.log('Firebase-Sync läuft automatisch nach Reload beim nächsten isOnline-Check.');
  console.log('\nProjekt-IDs für Zuweisungen im Admin-Bereich:');
  projectIds.forEach(function(id, i) {
    console.log('  [' + (i+1) + '] ' + projects[i].name + '  →  ' + id);
  });

})();
