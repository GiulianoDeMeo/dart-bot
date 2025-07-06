# Pickware Dart Statistiken

Eine Web-App für Dart-Spielstatistiken mit Elo-Rating-System und Slack-Integration.

## 🚀 Schnellstart

### Entwicklung (Test-Datenbank)
```bash
npm run dev
```
- Verwendet `test-database` in MongoDB Atlas
- Automatischer Neustart bei Code-Änderungen
- Lokaler Server auf Port 3001
- Sichere Entwicklung ohne Live-Daten zu beeinträchtigen

### Produktion (Live-Datenbank)
```bash
npm run prod
```
- Verwendet `dart-stats` in MongoDB Atlas
- Für Live-Deployment auf Heroku

## 🔧 Umgebung einrichten

### 1. Dependencies installieren
```bash
npm install
```

### 2. .env Datei konfigurieren
```env
# MongoDB Verbindungen
# Produktions-Datenbank (Live-System) - wird von Heroku bereitgestellt
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dart-stats

# Test-Datenbank (Entwicklung)
MONGODB_URI_TEST=mongodb+srv://dart-bot-app:xhfbGnfII6WhJKEA@pickware.biz4mzw.mongodb.net/test-database

# Slack Integration
SLACK_TOKEN=your_slack_token_here
SLACK_CHANNEL=#your_channel_name

# Server Port
PORT=3001

# Umgebung
NODE_ENV=development
```

## 📊 Datenbankstruktur

### Collections:
- **players**: Spielerdaten mit Elo-Rating und Historie
- **games**: Spielergebnisse und Statistiken

### Umgebungen:
- **Entwicklung**: `test-database` (für Tests und Entwicklung)
- **Produktion**: `dart-stats` (Live-System auf Heroku)

## 🛠️ Entwicklungsworkflow

1. **Entwicklung starten:**
   ```bash
   npm run dev
   ```

2. **Tests in Test-Datenbank:**
   - Alle Änderungen gehen in `test-database`
   - Sichere Entwicklung ohne Live-Daten zu beeinträchtigen
   - API verfügbar unter `http://localhost:3001/api/players`

3. **Deployment:**
   ```bash
   git add .
   git commit -m "Update: Beschreibung der Änderungen"
   git push heroku main
   ```
   - Heroku verwendet automatisch Produktions-Datenbank
   - Live-App verfügbar unter: https://dart-bot-stats.herokuapp.com

## 📝 Verfügbare Scripts

- `npm run dev` - Entwicklung mit Test-DB (NODE_ENV=development)
- `npm run test` - Test-Umgebung (NODE_ENV=development)
- `npm run prod` - Produktions-Umgebung (NODE_ENV=production)
- `npm start` - Standard-Produktionsstart (NODE_ENV=production)

## 🔌 API Endpunkte

### Spieler
- `GET /api/players` - Alle Spieler mit Statistiken
- `POST /api/players` - Neuen Spieler hinzufügen

### Spiele
- `GET /api/games` - Alle Spiele (chronologisch sortiert)
- `POST /api/games` - Neues Spiel hinzufügen

### Statistiken
- `GET /api/stats` - Detaillierte Statistiken für alle Spieler
- `POST /api/recalculate-elo` - Elo-Ratings neu berechnen

### Slack Commands
- `/dart-last` - Letzte 3 Spiele anzeigen
- `/dart-player [Name]` - Spielerstatistiken
- `/dart-week` - Spieler der Woche

## 🔒 Sicherheit

- `.env` Datei ist in `.gitignore`
- Keine Secrets im Code
- Separate Datenbanken für Test und Produktion
- Heroku Config Vars für Produktions-Secrets

## 🚀 Deployment Status

- **Test-Datenbank:** ✅ Funktioniert (test-database)
- **Produktions-Datenbank:** ✅ Funktioniert (dart-stats auf Heroku)
- **Automatische Umgebungsauswahl:** ✅ Implementiert
- **Slack-Integration:** ✅ Aktiv

## 📈 Aktuelle Statistiken

Die App verwaltet aktuell:
- **Spieler:** 50+ Dart-Spieler
- **Spiele:** 200+ gespielte Matches
- **Elo-System:** Dynamische Rating-Berechnung
- **Slack-Integration:** Automatische Benachrichtigungen 