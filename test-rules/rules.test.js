/**
 * Firebase RTDB Rules – Emulator Tests
 * Run: node rules.test.js   (emulator must be running on port 9000)
 *
 * Hinweis: numChildren() existiert nicht in RTDB Rules (nur Firestore).
 * Foto-Entfernen ist daher UI-only geschützt (kein X-Button für Worker).
 */

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { ref, get, set, remove } = require('firebase/database');
const fs = require('fs');
const path = require('path');

const PROJECT_ID  = 'flexfundament-app';
const RULES_FILE  = path.resolve(__dirname, '..', 'database.rules.json');

const ADMIN_UID    = 'admin1';
const WORKER_UID   = 'worker1';    // zugewiesen zu proj-A
const STRANGER_UID = 'worker2';    // NICHT zugewiesen zu proj-A
const PROJ_A = 'proj-A';
const PROJ_B = 'proj-B';

let passed = 0;
let failed = 0;

async function test(label, fn) {
  try {
    await fn();
    console.log('  PASS  ' + label);
    passed++;
  } catch (e) {
    console.error('  FAIL  ' + label);
    console.error('        ' + (e.message || String(e)).split('\n')[0]);
    failed++;
  }
}

async function main() {
  console.log('\n=== Flexfundament Firebase Rules Tests ===\n');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {
      host: 'localhost',
      port: 9000,
      rules: fs.readFileSync(RULES_FILE, 'utf8')
    }
  });

  // ── Seed: Testdaten ohne Rules einspielen ─────────────────────────────────
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await set(ref(db, 'users/' + ADMIN_UID),    { role: 'admin',  active: true });
    await set(ref(db, 'users/' + WORKER_UID),   { role: 'worker', active: true });
    await set(ref(db, 'users/' + STRANGER_UID), { role: 'worker', active: true });

    await set(ref(db, 'projectAssignments/' + PROJ_A + '/assignedTo/' + WORKER_UID), true);

    await set(ref(db, 'projects/' + PROJ_A), { name: 'Projekt A', status: 'aktiv', savedAt: 1 });
    await set(ref(db, 'projects/' + PROJ_B), { name: 'Projekt B', status: 'aktiv', savedAt: 1 });

    await set(ref(db, 'reports/rep-1'), {
      projectId: PROJ_A, date: '2025-01-01',
      photos: { 0: { name: 'foto1.jpg', type: 'image' } },
      obstaclePhotos: {}, deleted: false, savedAt: 1
    });
    await set(ref(db, 'costs/cost-1'), {
      projectId: PROJ_A, amount: 50,
      photos: { 0: { name: 'beleg.jpg', type: 'image' } },
      deleted: false, savedAt: 1
    });
    await set(ref(db, 'drives/drive-1'), {
      projectId: PROJ_A, date: '2025-01-01',
      photos: { 0: { name: 'km.jpg', type: 'image' } },
      deleted: false, savedAt: 1
    });
    await set(ref(db, 'documents/doc-1'), {
      projectId: PROJ_A, fileName: 'plan.pdf',
      downloadUrl: 'https://example.com/plan.pdf',
      deleted: false, savedAt: 1
    });
  });

  // ── Database-Instanzen einmalig anlegen (useEmulator() nur 1× pro App) ────
  const adminDb   = testEnv.authenticatedContext(ADMIN_UID,    {}).database();
  const workerDb  = testEnv.authenticatedContext(WORKER_UID,   {}).database();
  const strangerDb = testEnv.authenticatedContext(STRANGER_UID, {}).database();
  const nobodyDb  = testEnv.unauthenticatedContext().database();

  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- projects ---');

  await test('Worker liest zugewiesenes Projekt', () =>
    assertSucceeds(get(ref(workerDb, 'projects/' + PROJ_A)))
  );
  await test('Worker darf fremdes Projekt NICHT lesen', () =>
    assertFails(get(ref(workerDb, 'projects/' + PROJ_B)))
  );
  await test('Worker darf Projekt NICHT schreiben', () =>
    assertFails(set(ref(workerDb, 'projects/' + PROJ_A), { name: 'Hack', savedAt: 99 }))
  );
  await test('Admin liest alle Projekte', () =>
    assertSucceeds(get(ref(adminDb, 'projects')))
  );
  await test('Admin schreibt Projekt', () =>
    assertSucceeds(set(ref(adminDb, 'projects/proj-new'), { name: 'Neu', status: 'aktiv', savedAt: 1 }))
  );

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- reports ---');

  await test('Worker liest eigenen Report', () =>
    assertSucceeds(get(ref(workerDb, 'reports/rep-1')))
  );
  await test('Fremder Worker darf Report NICHT lesen', () =>
    assertFails(get(ref(strangerDb, 'reports/rep-1')))
  );
  await test('Worker bearbeitet eigenen Report (erlaubt)', () =>
    assertSucceeds(set(ref(workerDb, 'reports/rep-1'), {
      projectId: PROJ_A, date: '2025-01-02',
      photos: { 0: { name: 'foto1.jpg', type: 'image' }, 1: { name: 'foto2.jpg', type: 'image' } },
      obstaclePhotos: {}, deleted: false, savedAt: 2
    }))
  );
  await test('Worker darf Soft-Delete (deleted:true) NICHT setzen', () =>
    assertFails(set(ref(workerDb, 'reports/rep-1'), {
      projectId: PROJ_A, date: '2025-01-01',
      photos: { 0: { name: 'foto1.jpg', type: 'image' } },
      obstaclePhotos: {}, deleted: true, savedAt: 3
    }))
  );
  await test('Worker darf Hard-Delete (remove) NICHT ausführen', () =>
    assertFails(remove(ref(workerDb, 'reports/rep-1')))
  );
  await test('Admin löscht Report per Soft-Delete (erlaubt)', () =>
    assertSucceeds(set(ref(adminDb, 'reports/rep-1'), {
      projectId: PROJ_A, deleted: true, savedAt: 99
    }))
  );

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- costs ---');

  await test('Worker liest eigene Kosten', () =>
    assertSucceeds(get(ref(workerDb, 'costs/cost-1')))
  );
  await test('Worker bearbeitet Kosten im eigenen Projekt (erlaubt)', () =>
    assertSucceeds(set(ref(workerDb, 'costs/cost-1'), {
      projectId: PROJ_A, amount: 75,
      photos: { 0: { name: 'beleg.jpg', type: 'image' } },
      deleted: false, savedAt: 2
    }))
  );
  await test('Worker darf Soft-Delete bei Kosten NICHT setzen', () =>
    assertFails(set(ref(workerDb, 'costs/cost-1'), {
      projectId: PROJ_A, amount: 50, photos: {}, deleted: true, savedAt: 3
    }))
  );
  await test('Worker legt neue Kosten an (erlaubt)', () =>
    assertSucceeds(set(ref(workerDb, 'costs/cost-new'), {
      projectId: PROJ_A, amount: 25, photos: {}, deleted: false, savedAt: 1
    }))
  );
  await test('Worker darf Kosten in fremdem Projekt NICHT anlegen', () =>
    assertFails(set(ref(workerDb, 'costs/cost-fremdes-proj'), {
      projectId: PROJ_B, amount: 10, photos: {}, deleted: false, savedAt: 1
    }))
  );

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- drives ---');

  await test('Worker liest eigene Fahrt', () =>
    assertSucceeds(get(ref(workerDb, 'drives/drive-1')))
  );
  await test('Worker bearbeitet Fahrt im eigenen Projekt (erlaubt)', () =>
    assertSucceeds(set(ref(workerDb, 'drives/drive-1'), {
      projectId: PROJ_A, date: '2025-01-02',
      photos: { 0: { name: 'km.jpg', type: 'image' } },
      deleted: false, savedAt: 2
    }))
  );
  await test('Worker darf Soft-Delete bei Fahrten NICHT setzen', () =>
    assertFails(set(ref(workerDb, 'drives/drive-1'), {
      projectId: PROJ_A, photos: {}, deleted: true, savedAt: 3
    }))
  );
  await test('Worker darf Hard-Delete bei Fahrt NICHT ausführen', () =>
    assertFails(remove(ref(workerDb, 'drives/drive-1')))
  );

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- documents ---');

  await test('Worker liest eigenes Dokument', () =>
    assertSucceeds(get(ref(workerDb, 'documents/doc-1')))
  );
  await test('Worker darf bestehendes Dokument NICHT bearbeiten', () =>
    assertFails(set(ref(workerDb, 'documents/doc-1'), {
      projectId: PROJ_A, fileName: 'geaendert.pdf',
      downloadUrl: 'https://example.com/neu.pdf', deleted: false, savedAt: 2
    }))
  );
  await test('Worker darf Soft-Delete bei Dokument NICHT setzen', () =>
    assertFails(set(ref(workerDb, 'documents/doc-1'), {
      projectId: PROJ_A, fileName: 'plan.pdf',
      downloadUrl: 'https://example.com/plan.pdf', deleted: true, savedAt: 2
    }))
  );
  await test('Worker darf Hard-Delete bei Dokument NICHT ausführen', () =>
    assertFails(remove(ref(workerDb, 'documents/doc-1')))
  );
  await test('Worker legt neues Dokument im eigenen Projekt an (erlaubt)', () =>
    assertSucceeds(set(ref(workerDb, 'documents/doc-new'), {
      projectId: PROJ_A, fileName: 'neu.pdf',
      downloadUrl: 'https://example.com/neu.pdf', deleted: false, savedAt: 1
    }))
  );
  await test('Worker darf Dokument in fremdem Projekt NICHT anlegen', () =>
    assertFails(set(ref(workerDb, 'documents/doc-fremdes'), {
      projectId: PROJ_B, fileName: 'hack.pdf',
      downloadUrl: 'x', deleted: false, savedAt: 1
    }))
  );
  await test('Admin bearbeitet bestehendes Dokument (erlaubt)', () =>
    assertSucceeds(set(ref(adminDb, 'documents/doc-1'), {
      projectId: PROJ_A, fileName: 'plan-v2.pdf',
      downloadUrl: 'https://example.com/plan-v2.pdf', deleted: false, savedAt: 5
    }))
  );
  await test('Admin löscht Dokument per Soft-Delete (erlaubt)', () =>
    assertSucceeds(set(ref(adminDb, 'documents/doc-1'), {
      projectId: PROJ_A, deleted: true, savedAt: 99
    }))
  );

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- unauthenticated ---');

  await test('Unauthenticated darf nichts lesen', () =>
    assertFails(get(ref(nobodyDb, 'projects/' + PROJ_A)))
  );

  // ──────────────────────────────────────────────────────────────────────────
  await testEnv.cleanup();

  console.log('\n==========================================');
  console.log('  Ergebnis: ' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
  console.log('==========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
