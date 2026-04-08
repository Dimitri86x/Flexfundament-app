# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Interne PWA für Liederflex GmbH zur Baustellen-Dokumentation und Projektsteuerung.
Gehostet auf GitHub Pages: kein Build-Schritt, kein Framework, kein Package-Manager.

## Entwicklung

Da es kein Build-Tool gibt, direkt die HTML-Dateien im Browser öffnen oder einen lokalen Webserver starten:

```bash
# Lokaler Dev-Server (Python)
python3 -m http.server 8080

# Oder mit npx (falls Node installiert)
npx serve .
```

Testen auf echtem Gerät: Nach jedem Commit ist die App auf GitHub Pages live.
Service Worker cacht aggressiv — zum Testen im Browser: DevTools → Application → Service Workers → „Update on reload" aktivieren.

## Architektur

Multi-File SPA: Jede Seite ist eine eigene HTML-Datei, gemeinsamer Code in `shared.js` / `shared.css`.

| Datei | Zweck |
|---|---|
| `index.html` | Login (Google Sign-In) |
| `dashboard.html` | Übersicht mit Widgets |
| `projects.html` | Projektliste + Formular |
| `reports.html` | Einsatzberichte (Liste + Formular + PDF-Export) |
| `documents.html` | Dokument-Upload + Liste |
| `drives.html` | Fahrtenbuch |
| `costs.html` | Kosten |
| `shared.js` | Firebase-Config, Auth-Guard, Sync, Helpers |
| `shared.css` | Navigation, Layout, Formulare, Responsive |
| `sw.js` | Service Worker (Cache-first für App-Shell) |

### Seitenstruktur (jede Seite)

```html
<!-- Firebase SDK compat v10.12.0 via CDN -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<!-- + auth, database, storage -->
<script src="shared.js"></script>
<script>
  initApp(function(user) { /* Seiten-Logik */ });
</script>
```

`initApp(callback)` übernimmt Auth-Guard und ruft den Callback mit dem eingeloggten User auf.

## Firebase

- **SDK:** compat v10.12.0 — NICHT das modulare SDK verwenden
- **Auth:** Popup mit Redirect-Fallback (`signInWithGoogle()` in shared.js)
- **Realtime Database:** `europe-west1`, flache Pfade: `projects/`, `reports/`, `documents/`, `drives/`, `costs/`
- **Storage:** `files/{projectId}/{pushId}`

## Offline-Sync-Strategie

1. Daten immer zuerst in `localStorage` schreiben (Prefix `ff_`)
2. Bei Online-Status: automatisch mit Firebase synchronisieren
3. Last-Write-Wins via `savedAt`-Timestamp
4. Base64-Bilddaten werden VOR dem localStorage-Schreiben gestrippt (5MB-Limit)

Jeder Datensatz hat diese Pflichtfelder:
```js
{ savedAt: Date.now(), savedBy: auth.currentUser.uid, deleted: false }
```

### Wichtige Hilfsfunktionen (shared.js)

| Funktion | Zweck |
|---|---|
| `saveToLocal(collection, id, data)` | Speichert lokal + synct zu Firebase |
| `loadFromLocal(collection)` | Lädt alle Items aus localStorage |
| `getActiveItems(collection)` | Gibt nicht-gelöschte Items zurück, sortiert nach savedAt |
| `getItemById(collection, id)` | Einzelnes Item per ID |
| `softDelete(collection, id, label)` | Setzt `deleted=true` mit Bestätigungsdialog |
| `syncWithFirebase(collection)` | Bidirektionaler Sync (Last-Write-Wins) |
| `getAutocompleteSuggestions(collection, field)` | Sammelt bisherige Eingaben für Autocomplete |
| `compressImage(file, maxWidth, maxSizeMB)` | Bildkomprimierung vor Upload (HEIC→JPEG) |
| `showToast(message, type)` | Snackbar-Meldung |
| `renderNav(activeTab)` | Navigation in Body einfügen |
| `getUrlParam(name)` | URL-Parameter lesen |
| `initCollapsibles()` | Einklappbare Bereiche aktivieren |

## Navigation

Tab-Leiste oben: Dashboard | Projekte | Kalender | Mehr…  
„Mehr…"-Dropdown: Einsatzberichte, Fahrtenbuch, Kosten, Dokumente

Jede Seite ruft `renderNav('seitenname')` auf. Aktive Tab-IDs:
`dashboard`, `projects`, `calendar`, `reports`, `drives`, `costs`, `documents`

## Statuswerte

- Projekte: `status = "aktiv" | "abgeschlossen"`
- Einsatzberichte: `status = "entwurf" | "abgeschlossen"`
- Kosten: `status = "offen" | "bezahlt"`

## Validierungsregeln

- Kilometerstand Ende > Start
- Arbeit Ende > Arbeit Beginn
- Betrag > 0
- Datum nicht in der Zukunft
- Pflichtfelder: nur gelbe Warnung, KEIN Blockieren — Entwürfe dürfen unvollständig sein
- Fehleranzeige: Inline unter dem Feld, rot

## Code-Stil

- UI-Texte auf **Deutsch**, Variablen/Funktionen/Kommentare auf **Englisch**
- CSS-Variablen für Farben und Abstände, kein `!important`
- Firebase compat API (z.B. `firebase.database()`, nicht `getDatabase(app)`)
- Event-Delegation wo sinnvoll

## Berechtigungsmatrix (Firebase Rules)

Geprüft und durch Emulator-Tests bestätigt (`test-rules/rules.test.js`, 29/29).

| Collection | Worker lesen | Worker schreiben | Worker löschen |
|---|---|---|---|
| `projects` | nur zugewiesene (record-level) | nein | nein |
| `reports` | nur zugewiesene Projekte | ja (kein `deleted:true`) | nein (hard + soft) |
| `costs` | nur zugewiesene Projekte | ja (kein `deleted:true`) | nein (hard + soft) |
| `drives` | nur zugewiesene Projekte | ja (kein `deleted:true`) | nein (hard + soft) |
| `documents` | nur zugewiesene Projekte | nur neue anlegen (`!data.exists()`) | nein (hard + soft) |

**Wichtige Einschränkung RTDB:** `numChildren()` existiert nicht in RTDB Security Rules (nur Firestore). Foto-Entfernen lässt sich serverseitig nicht erzwingen — Schutz läuft **UI-only** (kein ×-Button für Worker bei bestehenden Datensätzen in `costs.html`, `drives.html`, `reports-logic.js`, `documents.html`).

**Projektzuweisung:** `projectAssignments/{projectId}/assignedTo/{uid} = true` — gesetzt durch Admin. Worker lesen ihre Zuweisungen via `loadAllowedProjectIds()` in `shared.js`.

### Rules testen

```bash
cd test-rules
npm install --cache .npm-cache --no-audit --no-fund
node rules.test.js   # Emulator muss laufen (firebase emulators:start)
```

## Bekannte Fallstricke

- `signInWithPopup` ist auf iOS/PWA unzuverlässig → `signInWithGoogle()` in shared.js verwendet Popup mit automatischem Redirect-Fallback
- iOS Safari: Blob-URLs für PDFs funktionieren nicht → `window.open` mit Data-URL als Fallback
- Service Worker: Nur App-Shell cachen (HTML, CSS, JS), **keine** Firebase-API-Calls
- localStorage-Limit 5MB: Base64-Bilddaten werden per `stripBase64()` vor dem Schreiben entfernt, nur URLs werden gespeichert
