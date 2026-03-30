# Flexfundament App – Claude Code Prompts

Führe diese Prompts nacheinander in Claude Code aus.
Nach jedem Schritt: Testen → Feedback → nächster Schritt.

---

## SCHRITT 1: Grundgerüst (Auth + Navigation + Sync)

```
Erstelle das Grundgerüst der Flexfundament App. Lies zuerst CLAUDE.md für alle Projektdetails.

Erstelle folgende Dateien:

1. shared.css — Komplettes Styling:
   - CSS-Variablen für Farben (professionell, blau/grau)
   - Tab-Navigation oben (Dashboard, Projekte, Kalender, Mehr…)
   - "Mehr…" als Dropdown mit Fahrtenbuch, Kosten, Dokumente
   - Zurück-Button Styling
   - Formulare: große Eingabefelder, Touch-optimiert (min 44px Höhe)
   - Einklappbare Bereiche (collapsible)
   - Buttons, Cards, Listen
   - Inline-Validierungsfehler (rot unter Feld)
   - Toast/Snackbar für Erfolgsmeldungen
   - Responsive: mobile-first, max-width 600px zentriert auf Desktop
   - Floating Action Button (+ Button) für Schnellaktionen

2. shared.js — Gemeinsame Logik:
   - Firebase-Config (Platzhalter-Werte, ich ersetze sie später)
   - Firebase Auth mit Google signInWithRedirect
   - Auth-Guard: leitet zu index.html wenn nicht eingeloggt
   - initApp()-Funktion die Auth prüft und Callback aufruft
   - Sync-Modul: saveToLocal(collection, id, data), loadFromLocal(collection), syncWithFirebase(collection)
   - Last-Write-Wins Merge-Logik via savedAt
   - Online/Offline-Erkennung mit Status-Anzeige
   - Autocomplete-Helper: getAutocompleteSuggestions(collection, field)
   - Soft-Delete Helper: softDelete(collection, id) mit Bestätigungsdialog
   - Navigation-Renderer: renderNav(activeTab)
   - Utility: formatDate(), formatTime(), generateId(), showToast()
   - Bild-Komprimierung: compressImage(file, maxWidth=1920, maxSizeMB=5)

3. index.html — Login-Seite:
   - App-Name "Flexfundament App" prominent
   - Google Sign-In Button
   - Lädt shared.js, prüft Auth-Status
   - Wenn eingeloggt → redirect zu dashboard.html
   - Minimales, professionelles Design

4. dashboard.html — Dashboard (Grundstruktur):
   - Navigation oben (Dashboard aktiv)
   - Begrüßung mit User-Name
   - 5 Schnellbuttons: Projekt anlegen, Einsatzbericht anlegen, Fahrt erfassen, Kosten erfassen, Dokument hochladen
   - Platzhalter-Sections für: Heutige Termine, Letzte Projekte, Offene Einsatzberichte, Letzte Fahrten, Offene Kosten
   - Die Platzhalter zeigen "Noch keine Daten" — werden später befüllt
   - Online/Offline-Indikator

5. manifest.json — PWA-Manifest:
   - name: "Flexfundament App", short_name: "FF App"
   - display: standalone, orientation: portrait
   - theme_color und background_color passend zum Design
   - Icons: generiere ein einfaches SVG-basiertes Icon

6. sw.js — Service Worker:
   - Cache-first für App-Shell (alle .html, .css, .js Dateien)
   - Network-first für Firebase API Calls
   - Offline-Fallback

Achte auf:
- signInWithRedirect (NICHT Popup!)
- Firebase compat SDK v10.12.0 via CDN
- Alle UI-Texte auf Deutsch
- Mobile-first Design
- Die Navigation muss auf allen Seiten funktionieren
```

---

## SCHRITT 2: Modul Projekte

```
Erstelle projects.html — das Projekte-Modul. Lies CLAUDE.md für Details.

Die Seite hat zwei Ansichten:

LISTENANSICHT (Standard):
- Navigation oben (Projekte aktiv)
- Suchfeld oben: Echtzeit-Filter über Projektbezeichnung
- Filter-Leiste: Status (Alle/Aktiv/Abgeschlossen), Einsatzart (Alle/Montage/Belastungsversuch/Baubesprechung)
- Sortierung nach Ausführungstermin (neueste zuerst)
- Projekt-Cards zeigen: Bezeichnung, Auftraggeber, Einsatzart, Termin, Status-Badge
- Floating + Button → öffnet Formularansicht
- Klick auf Card → öffnet Detailansicht

FORMULARANSICHT:
- Zurück-Button oben
- Stammdaten: Projektbezeichnung*, Einsatzart* (Dropdown), Auftraggeber*, Ansprechpartner*, Telefon (click-to-call), BV/Baustellenadresse* (textarea), Einbaubedingungen unterschrieben (toggle), Status* (Dropdown: Aktiv/Abgeschlossen)
- Einklappbar "Unterlagenstatus": 6 Unterlagen, je mit Vorhanden/Fehlt/Nicht erforderlich (Radio oder Segmented Control)
- Termin: Ausführungstermin* (date), Uhrzeit (time)
- Einklappbar "Vorbereitung": Grobabsteckung (toggle), Höhenbezugspunkt (toggle), Zugänglichkeit Beschreibung (textarea), Zugänglichkeit Fotos (Bild-Upload mehrfach), Geplanter Materialeinsatz (textarea), Geplanter Maschineneinsatz (textarea)
- Einklappbar "Verknüpfte Datensätze": Platzhalter-Listen für Einsatzberichte, Dokumente, Fahrten, Kosten (werden später dynamisch befüllt)
- Speichern-Button: speichert via shared.js saveToLocal + syncWithFirebase
- Löschen-Button (nur bei bestehendem Projekt): Soft-Delete via shared.js

* = Pflichtfeld (Warnung wenn leer, aber Speichern nicht blockieren)

Nutze shared.js und shared.css. Alle Daten in localStorage collection "projects".
```

---

## SCHRITT 3: Modul Einsatzberichte

```
Erstelle reports.html — das Einsatzberichte-Modul. Lies CLAUDE.md für Details.

LISTENANSICHT:
- Navigation oben (über "Mehr…" erreichbar, kein eigener Tab)
- Filter nach Projekt und Status (Entwurf/Abgeschlossen)
- Report-Cards zeigen: Projekt, Datum, Mitarbeiter, Status-Badge
- Floating + Button → Formular

FORMULARANSICHT:
- Einsatzdaten: Projekt* (Dropdown aus Projektliste), Datum*, Mitarbeiter* (Tags-Input mit Autocomplete), Status (Entwurf/Abgeschlossen)
- Zeiterfassung: Beginn Arbeit*, Ende Arbeit* (Validierung: Ende > Beginn)
- Tätigkeit (min. eine): Auszugversuch (Checkbox + Anzahlfeld), Eindrehversuch (Checkbox + Anzahlfeld), Montage (Checkbox + Anzahlfeld), Einmessen (Checkbox), Zusatzleistung (Freitext)
- Einklappbar "Bauverhinderung": Hindernis vorhanden? (toggle) → wenn Ja: Grund (Dropdown mit 11 Werten aus Pflichtenheft), Problembeschreibung* (textarea), Foto (Upload)
- Notizen/Baufortschritt* (großes Textfeld)
- Einklappbar "Gesprächsnotizen mit AG" (Textfeld)
- Einklappbar "Fotos": Mehrfach-Upload, je Foto ein Beschreibungsfeld
- Speichern + Löschen wie bei Projekten

PDF-EXPORT:
- Button "PDF erstellen" im Formular
- Erzeugt A4-PDF im Formular-Stil mit jsPDF oder html2pdf
- Inhalt: Projektdaten, Mitarbeiter, Zeiten, Tätigkeiten, Hindernisse, Notizen, Fotos
- Kein Branding/Logo
- PDF wird zum Download angeboten

Verknüpfung: Einsatzberichte haben ein projectId-Feld. In projects.html den Bereich "Verknüpfte Einsatzberichte" jetzt dynamisch befüllen.
```

---

## SCHRITT 4: Modul Dokumente

```
Erstelle documents.html — das Dokumente-Modul. Lies CLAUDE.md für Details.

LISTENANSICHT:
- Filter nach Projekt und Dokumenttyp
- Dokument-Cards: Dateiname, Typ, Projekt, Datum
- Klick öffnet/downloaded die Datei

FORMULARANSICHT:
- Projekt* (Dropdown)
- Dokumenttyp* (Dropdown: Belastungsversuch PDF, Bodengutachten, Lageplan, Statik/Lastangaben, Fundamentplan, Baupläne, Richtpreisangebot, Foto, Sonstiges)
- Datei hochladen* (Datei-Upload, alle Typen, max 5 MB)
- Beschreibung (Textfeld)
- Datum (date)

Upload-Logik:
- Bilder vor Upload auf 1920px komprimieren (shared.js compressImage)
- Datei zu Firebase Storage: files/{projectId}/{pushId}
- Download-URL in Realtime Database speichern
- Offline: Datei in IndexedDB oder als Base64 in localStorage cachen, bei Netzwerk uploaden

Verknüpfung: In projects.html den Bereich "Verknüpfte Dokumente" dynamisch befüllen.
```

---

## SCHRITT 5: Modul Fahrtenbuch

```
Erstelle drives.html — das Fahrtenbuch-Modul. Lies CLAUDE.md für Details.

LISTENANSICHT:
- Fahrten-Cards: Datum, Start→Ziel, km, Fahrer, Projekt
- Sortierung nach Datum (neueste zuerst)

FORMULARANSICHT:
- Projekt (Dropdown, optional)
- Datum* (Validierung: nicht in Zukunft)
- Fahrer* (Freitext + Autocomplete)
- Fahrzeug* (Freitext + Autocomplete)
- Startort*, Zielort*
- Kilometerstand Start*, Kilometerstand Ende* (Validierung: Ende > Start)
- Gefahrene Kilometer (automatisch berechnet, live-Update bei Eingabe)
- Fahrtzweck* (Dropdown: Baustellenfahrt, Materialtransport, Sonstiges)
- Notizen (Freitext)

Verknüpfung: In projects.html den Bereich "Verknüpfte Fahrten" dynamisch befüllen.
```

---

## SCHRITT 6: Modul Kosten

```
Erstelle costs.html — das Kosten-Modul. Lies CLAUDE.md für Details.

LISTENANSICHT:
- Filter nach Status (Offen/Bezahlt) und Kategorie
- Kosten-Cards: Datum, Kategorie, Betrag (€), Mitarbeiter, Status-Badge
- Summe der angezeigten Kosten oben

FORMULARANSICHT:
- Projekt (Dropdown, optional)
- Datum* (Validierung: nicht in Zukunft)
- Mitarbeiter* (Freitext + Autocomplete)
- Kategorie* (Dropdown: Hotel, Sprit, Verpflegung, Parken, Maut, Material, Werkzeug, Sonstiges)
- Betrag* (€, Validierung: > 0)
- Belegfoto (Bild-Upload, Kamera-Direktaufnahme mit capture="environment")
- Notiz (Freitext)
- Status (Offen/Bezahlt, Default: Offen)

Verknüpfung: In projects.html den Bereich "Verknüpfte Kosten" dynamisch befüllen.
```

---

## SCHRITT 7: Kalender

```
Erstelle calendar.html — das Kalender-Modul. Lies CLAUDE.md für Details.

ANSICHTEN (umschaltbar):
- Wochenansicht (Standard beim Öffnen)
- Monatsansicht
- Tagesansicht

Datenquellen:
- Projekte → Ausführungstermin (Label: Projektbezeichnung)
- Einsatzberichte → Datum (Label: "EB: " + Projektbezeichnung)

Funktionen:
- Klick auf Termin → navigiert zum Quellobjekt (project oder report)
- + Button → Auswahl: Neues Projekt oder Neuer Einsatzbericht (mit vorausgewähltem Datum)
- Farbkodierung: Projekte und Einsatzberichte visuell unterscheidbar
- Navigation: Vor/Zurück, Heute-Button
- Mobile-optimiert: Wochenansicht zeigt kompakte Tagesliste

Implementiere den Kalender ohne externe Bibliothek — reines HTML/CSS/JS.
```

---

## SCHRITT 8: Dashboard befüllen + Feinschliff

```
Befülle jetzt das Dashboard in dashboard.html mit echten Daten. Lies CLAUDE.md für Details.

Dashboard-Widgets (mit echten Daten aus localStorage/Firebase):
1. Heutige Termine — Projekte und Einsatzberichte mit heutigem Datum
2. Letzte Projekte — Die 5 neuesten aktiven Projekte (klickbar → projects.html?id=...)
3. Offene Einsatzberichte — Status = "entwurf" (klickbar → reports.html?id=...)
4. Letzte Fahrten — Die 5 neuesten Fahrten
5. Offene Kosten — Status = "offen", mit Gesamtsumme

Jedes Widget:
- Zeigt "Keine Einträge" wenn leer
- Card-Design, kompakt
- Klick navigiert zum Datensatz

Feinschliff:
- Prüfe alle Seiten auf konsistente Navigation
- Prüfe Offline-Modus: Daten erfassen ohne Netzwerk, dann sync testen
- Prüfe Mobile-Darstellung (iPhone-Breite 375px)
- Prüfe alle Validierungen
- Online/Offline-Indikator sichtbar auf allen Seiten
```

---

## HINWEISE ZUR NUTZUNG

- Führe EINEN Schritt pro Claude-Code-Session aus
- Nach jedem Schritt: auf iPhone testen, Feedback sammeln
- Feedback als Follow-up-Prompt an Claude Code geben
- Firebase-Config (API-Key, Project-ID etc.) nach Schritt 1 manuell in shared.js eintragen
- GitHub Repo erstellen, nach jedem Schritt committen
