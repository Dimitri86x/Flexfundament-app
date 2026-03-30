# Flexfundament App – Projektanweisung

## Projekt
Interne WebApp für Liederflex GmbH (FlexFundament) zur Baustellen-Dokumentation und Projektsteuerung.

## Technischer Stack
- **Frontend:** Vanilla HTML/CSS/JS (kein Framework, kein Build-Tool)
- **Backend:** Firebase Realtime Database (europe-west1) + Firebase Auth + Firebase Storage
- **Firebase SDK:** compat v10.12.0 via CDN
- **Hosting:** GitHub Pages
- **PDF:** jsPDF oder html2pdf (client-seitig)
- **PWA:** manifest.json + Service Worker

## Architektur
Multi-File SPA-ähnlich: Jedes Modul ist eine eigene HTML-Datei, gemeinsamer Code in shared.js und shared.css.

```
flexfundament-app/
├── index.html          # Login (Google Sign-In) + Redirect zu Dashboard
├── dashboard.html      # Startseite mit Widgets + Schnellbuttons
├── projects.html       # Projektliste + Projekt-Formular
├── reports.html        # Einsatzberichte (Liste + Formular + PDF)
├── documents.html      # Dokument-Upload + Liste
├── drives.html         # Fahrtenbuch (Liste + Formular)
├── costs.html          # Kosten (Liste + Formular)
├── calendar.html       # Kalenderansicht (Woche/Monat/Tag)
├── shared.js           # Firebase-Config, Auth-Guard, Sync, Helpers
├── shared.css          # Navigation, Layout, Formulare, Responsive
├── manifest.json       # PWA-Manifest
└── sw.js               # Service Worker
```

## Firebase-Konfiguration
- **Auth:** Google Sign-In (signInWithRedirect für Mobile-Kompatibilität)
- **Database:** Realtime Database, Region europe-west1
- **Database-Pfade (flach):** projects/, reports/, documents/, drives/, costs/
- **Storage-Pfade:** files/{projectId}/{pushId}
- **IDs:** Firebase Push-IDs (automatisch)

## Globale Felder auf JEDEM Datensatz
```json
{
  "savedAt": 1711700000000,    // Unix-Timestamp ms
  "savedBy": "firebase-uid",   // Auth UID
  "deleted": false              // Soft-Delete
}
```

## Offline-Sync-Strategie
1. Daten werden IMMER zuerst in localStorage geschrieben
2. Bei Netzwerk: automatisch zu Firebase synchronisieren
3. Beim Laden: Firebase-Daten mit localStorage mergen (Last-Write-Wins via savedAt)
4. Konflikt: Höherer savedAt-Wert gewinnt
5. Listen zeigen nur Datensätze mit deleted !== true

## Statusfelder
- **Projekte:** status = "aktiv" | "abgeschlossen" (Default: "aktiv")
- **Einsatzberichte:** status = "entwurf" | "abgeschlossen" (Default: "entwurf")
- **Kosten:** status = "offen" | "bezahlt" (Default: "offen")

## Validierungsregeln
- Kilometerstand Ende > Start (Fahrtenbuch)
- Arbeit Ende > Arbeit Beginn (Einsatzberichte)
- Betrag > 0 (Kosten)
- Datum nicht in der Zukunft (alle Module)
- Pflichtfelder: nur Warnung (gelb), kein Blockieren — Entwürfe dürfen unvollständig sein
- Fehleranzeige: Inline unter dem Feld, rot

## Navigation
- Tab-Leiste oben: Dashboard | Projekte | Kalender | Mehr…
- "Mehr…"-Dropdown: Fahrtenbuch, Kosten, Dokumente
- Unterseiten: Zurück-Button oben links
- Aktiver Tab wird visuell hervorgehoben

## UX-Regeln
- **Mobile-first:** min-width Eingabefelder, große Touch-Targets (min 44px)
- **Einklappbare Bereiche:** standardmäßig eingeklappt (Unterlagenstatus, Bauverhinderung, Fotos, Gesprächsnotizen)
- **Bedingte Logik:** Bauverhinderung = Ja → Grund + Beschreibung einblenden
- **Autocomplete:** Mitarbeiter-, Fahrer-, Fahrzeug-Felder sammeln bisherige Einträge aus der DB und schlagen sie vor
- **Soft-Delete:** Bestätigungsdialog, deleted=true setzen, in Listen ausblenden
- **Kamera-Upload:** accept="image/*" capture="environment" für Fotos
- **Datei-Upload:** Max 5 MB, alle Dateitypen, Bilder auf max 1920px komprimieren

## Code-Stil
- Deutsch für UI-Texte, Englisch für Variablen/Funktionen/Kommentare
- CSS-Variablen für Farben und Abstände
- Kein !important
- Event-Delegation wo sinnvoll
- Console.log nur für Debugging, nicht in Produktion

## Wichtige Erfahrungen aus früheren Apps
- signInWithPopup funktioniert NICHT zuverlässig in PWA/iOS → IMMER signInWithRedirect verwenden
- Firebase compat SDK v10.12.0, NICHT modular SDK (zu komplex für Single-File)
- localStorage kann bis 5MB speichern — bei vielen Fotos werden nur URLs gespeichert, nicht die Bilder selbst
- PDF-Erzeugung: iOS Safari hat Einschränkungen mit Blob-URLs → window.open mit Data-URL als Fallback
- Service Worker: Cache nur App-Shell (HTML, CSS, JS), NICHT Firebase-API-Calls
