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
- Slack-Integration: Test-Channel `#test`
- Sichere Entwicklung ohne Live-Daten zu beeinträchtigen

### Produktion (Live-Datenbank)
```bash
npm run prod
```
- Verwendet `dart-stats` in MongoDB Atlas
- Für Live-Deployment auf Heroku
- Slack-Integration: Produktions-Channel

## 🔧 Installation

### 1. Dependencies installieren
```bash
npm install
```

### 2. Umgebungsvariablen konfigurieren
Die `.env` Datei wird automatisch aus der `.env.example` erstellt. Für lokale Entwicklung:

```env
# MongoDB Test-Datenbank (Entwicklung)
MONGODB_URI_TEST=mongodb+srv://dart-bot-app:xhfbGnfII6WhJKEA@pickware.biz4mzw.mongodb.net/test-database

# Slack Integration (Entwicklung)
SLACK_TOKEN=your_slack_token_here

# Server Port
PORT=3001

# Umgebung
NODE_ENV=development
```

**Hinweis:** Produktions-Umgebungsvariablen werden über Heroku Config Vars verwaltet.

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

3. **Feature entwickeln:**
   - Lokal testen
   - Code committen: `git add . && git commit -m "Feature: Beschreibung"`
   - In beide GitHub Repos pushen: `git push origin main && git push pickware main`
   - Auf Heroku deployen: `git push heroku main`

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
- **Slack-Integration:** ✅ Aktiv (automatische Channel-Auswahl)

## 📈 Aktuelle Statistiken

Die App verwaltet aktuell:
- **Spieler:** 50+ Dart-Spieler
- **Spiele:** 200+ gespielte Matches
- **Elo-System:** Dynamische Rating-Berechnung
- **Slack-Integration:** Automatische Benachrichtigungen

## 🚀 Deployment Workflow

### **Entwicklungs-Workflow:**
1. **Feature entwickeln** → Lokal testen
2. **Code committen** → `git add . && git commit -m "Beschreibung"`
3. **In beide GitHub Repos pushen** → `git push origin main && git push pickware main`
4. **Auf Heroku deployen** → `git push heroku main`
5. **Produktion testen** → https://dart-bot-stats-40bf895a4f48.herokuapp.com/

### **Git Remote Konfiguration:**
```bash
# Persönliches Repository
origin    https://github.com/GiulianoDeMeo/dart-bot.git

# Pickware Repository  
pickware  https://github.com/pickware/dart-bot.git

# Heroku Production
heroku    https://git.heroku.com/dart-bot-stats.git
```

### **Deployment-Befehle:**
```bash
# 1. Änderungen stagen
git add .

# 2. Committen mit aussagekräftiger Nachricht
git commit -m "Feature: Beschreibung der Änderungen"

# 3. In beide GitHub Repositories pushen
git push origin main
git push pickware main

# 4. Auf Heroku deployen
git push heroku main
```

### **Umgebungen:**
- **Entwicklung**: `NODE_ENV=development` → Test-Datenbank + Test-Slack-Channel (`#test`)
- **Produktion**: `NODE_ENV=production` → Produktions-Datenbank + Produktions-Slack-Channel

### **Wichtige URLs:**
- **Lokale Entwicklung**: http://localhost:3001
- **Produktion**: https://dart-bot-stats-40bf895a4f48.herokuapp.com/
- **GitHub (persönlich)**: https://github.com/GiulianoDeMeo/dart-bot
- **GitHub (Pickware)**: https://github.com/pickware/dart-bot

### **Troubleshooting:**
- **Port belegt**: `lsof -ti:3001 | xargs kill -9`
- **Heroku Logs**: `heroku logs --tail`
- **Heroku Status**: `heroku ps` 