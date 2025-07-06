const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { WebClient } = require('@slack/web-api');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: '*', // Erlaube alle Ursprünge im Entwicklungsmodus
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// MongoDB Verbindung
const MONGODB_URI = process.env.NODE_ENV === 'development' 
    ? process.env.MONGODB_URI_TEST 
    : process.env.MONGODB_URI;

console.log('Versuche Verbindung zur MongoDB herzustellen...');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Vorhanden' : 'Fehlt');
console.log('MongoDB URI Test:', process.env.MONGODB_URI_TEST ? 'Vorhanden' : 'Fehlt');
console.log('Umgebung:', process.env.NODE_ENV || 'production');
console.log('Verwende Datenbank:', process.env.NODE_ENV === 'development' ? 'TEST' : 'PRODUKTION');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Verbindung erfolgreich hergestellt');
    const db = mongoose.connection.db;
    console.log('Datenbank:', db.databaseName);
    console.log('Host:', mongoose.connection.host);
    console.log('Verbundene Datenbank:', db.databaseName);
    console.log('Umgebung:', process.env.NODE_ENV === 'development' ? 'ENTWICKLUNG' : 'PRODUKTION');
}).catch(err => {
    console.error('Fehler bei der MongoDB Verbindung:', err);
    console.error('Details:', {
        name: err.name,
        message: err.message,
        code: err.code
    });
    process.exit(1);
});

// Weitere Verbindungs-Event-Handler
mongoose.connection.on('error', err => {
    console.error('MongoDB Fehler nach Verbindung:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB Verbindung getrennt');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB Verbindung wiederhergestellt');
});

// Spieler Schema
const playerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    eloRating: { type: Number, default: 1000 }, // Startwert auf 1000 geändert
    gamesPlayed: { type: Number, default: 0 },   // Für K-Faktor Berechnung
    eloHistory: [{
        elo: { type: Number, required: true },
        date: { type: Date, required: true }
    }]
});

// Spiel Schema
const gameSchema = new mongoose.Schema({
    // Für 1:1 Spiele
    winner: { type: String },
    loser: { type: String },
    
    // Für Multiplayer-Spiele
    players: { type: [String] },
    isMultiplayer: { type: Boolean, default: false },
    
    // Gemeinsame Felder
    date: { type: Date, default: Date.now },
    format: {
        type: { type: String, enum: ['501', '301'], default: '501' },
        legs: { type: Number, required: true, default: 3 }
    },
    highestCheckout: { type: Number }
});

const Player = mongoose.model('Player', playerSchema);
const Game = mongoose.model('Game', gameSchema);

// Slack Client initialisieren
const slack = new WebClient(process.env.SLACK_TOKEN);

// Automatische Channel-Auswahl basierend auf Umgebung
const SLACK_CHANNEL = process.env.NODE_ENV === 'development' 
    ? 'C08KHRA79S8'  // Entwicklung: Öffentlicher Test-Channel (ID)
    : process.env.SLACK_CHANNEL || '#dart-stats';  // Produktion: aus Umgebungsvariable oder Standard

console.log('Slack-Konfiguration:');
console.log('Umgebung:', process.env.NODE_ENV);
console.log('Verwende Channel:', SLACK_CHANNEL);
console.log('Token vorhanden:', !!process.env.SLACK_TOKEN);

// Slash-Command Endpunkte
app.post('/api/slack/commands', async (req, res) => {
    try {
        console.log('Slack Command empfangen:', JSON.stringify(req.body, null, 2));
        const { command, text, user_id, response_url } = req.body;
        
        if (!command || !response_url) {
            console.error('Fehlende Parameter:', { command, response_url });
            return res.status(400).send('Fehlende Parameter');
        }
        
        // Sofortige Antwort senden (Slack erwartet dies innerhalb von 3 Sekunden)
        res.status(200).send('Verarbeite Anfrage...');
        
        let response = '';
        
        switch (command) {
            case '/dart-last':
                console.log('Verarbeite /dart-last Command');
                // Hole die letzten 3 Spiele
                const lastGames = await Game.find()
                    .sort({ date: -1 })
                    .limit(3);
                
                console.log('Gefundene Spiele:', lastGames.length);
                
                response = '*Letzte 3 Spiele:*\n';
                for (const game of lastGames) {
                    const winner = await Player.findOne({ name: game.winner });
                    const loser = await Player.findOne({ name: game.loser });
                    
                    if (!winner || !loser) {
                        console.log('Spieler nicht gefunden:', { winner: game.winner, loser: game.loser });
                        continue;
                    }
                    
                    // Finde die Elo-Werte vor und nach dem Spiel
                    const winnerEloHistory = winner.eloHistory
                        .filter(entry => new Date(entry.date) <= game.date)
                        .sort((a, b) => new Date(b.date) - new Date(a.date));
                    const loserEloHistory = loser.eloHistory
                        .filter(entry => new Date(entry.date) <= game.date)
                        .sort((a, b) => new Date(b.date) - new Date(a.date));
                    
                    const winnerEloBefore = winnerEloHistory[1]?.elo || 1000; // Wert vor dem Spiel
                    const winnerEloAfter = winnerEloHistory[0]?.elo || 1000;  // Wert nach dem Spiel
                    const loserEloBefore = loserEloHistory[1]?.elo || 1000;   // Wert vor dem Spiel
                    const loserEloAfter = loserEloHistory[0]?.elo || 1000;    // Wert nach dem Spiel

                    // Hole alle Spieler und ihre Spiele
                    const allPlayers = await Player.find();
                    const allGames = await Game.find();
                    
                    // Berechne Rankings vor dem Spiel
                    const playersBeforeGame = allPlayers.map(p => {
                        const eloHistory = p.eloHistory
                            .filter(entry => new Date(entry.date) < game.date)
                            .sort((a, b) => new Date(b.date) - new Date(a.date));
                        
                        // Filtere Spiele vor dem aktuellen Spiel
                        const playerGames = allGames.filter(g => 
                            new Date(g.date) < game.date && 
                            (g.winner === p.name || g.loser === p.name)
                        );
                        
                        const wins = playerGames.filter(g => g.winner === p.name).length;
                        const totalGames = playerGames.length;
                        const winRate = totalGames > 0 ? (wins / totalGames) : 0;
                        
                        return {
                            name: p.name,
                            eloRating: eloHistory[0]?.elo || 1000,
                            gamesPlayed: totalGames,
                            wins,
                            winRate
                        };
                    });
                    
                    // Sortiere nach:
                    // 1. Spieler mit Spielen kommen zuerst
                    // 2. Elo-Rating (absteigend)
                    // 3. Anzahl der Siege (absteigend)
                    // 4. Siegesquote (absteigend)
                    playersBeforeGame.sort((a, b) => {
                        // Zuerst nach Spielerfahrung
                        const aHasGames = a.gamesPlayed > 0;
                        const bHasGames = b.gamesPlayed > 0;
                        
                        if (aHasGames !== bHasGames) {
                            return bHasGames - aHasGames; // Spieler mit Spielen kommen nach vorne
                        }
                        
                        // Wenn beide Spieler Spiele haben, nach Elo sortieren
                        if (aHasGames && bHasGames) {
                            if (b.eloRating !== a.eloRating) {
                                return b.eloRating - a.eloRating;
                            }
                            // Bei gleichem Elo nach Siegen
                            if (b.wins !== a.wins) {
                                return b.wins - a.wins;
                            }
                            // Bei gleichen Siegen nach Siegesquote
                            return b.winRate - a.winRate;
                        }
                        
                        // Wenn beide keine Spiele haben, nach Elo sortieren
                        return b.eloRating - a.eloRating;
                    });
                    
                    const oldRankings = {};
                    playersBeforeGame.forEach((player, index) => {
                        oldRankings[player.name] = index + 1;
                    });
                    
                    // Berechne Rankings nach dem Spiel
                    const playersAfterGame = allPlayers.map(p => {
                        const eloHistory = p.eloHistory
                            .filter(entry => new Date(entry.date) <= game.date)
                            .sort((a, b) => new Date(b.date) - new Date(a.date));
                        
                        // Filtere Spiele bis zum aktuellen Spiel
                        const playerGames = allGames.filter(g => 
                            new Date(g.date) <= game.date && 
                            (g.winner === p.name || g.loser === p.name)
                        );
                        
                        const wins = playerGames.filter(g => g.winner === p.name).length;
                        const totalGames = playerGames.length;
                        const winRate = totalGames > 0 ? (wins / totalGames) : 0;
                        
                        return {
                            name: p.name,
                            eloRating: eloHistory[0]?.elo || 1000,
                            gamesPlayed: totalGames,
                            wins,
                            winRate
                        };
                    });
                    
                    // Sortiere nach den gleichen Kriterien wie vorher
                    playersAfterGame.sort((a, b) => {
                        const aHasGames = a.gamesPlayed > 0;
                        const bHasGames = b.gamesPlayed > 0;
                        
                        if (aHasGames !== bHasGames) {
                            return bHasGames - aHasGames;
                        }
                        
                        if (aHasGames && bHasGames) {
                            if (b.eloRating !== a.eloRating) {
                                return b.eloRating - a.eloRating;
                            }
                            if (b.wins !== a.wins) {
                                return b.wins - a.wins;
                            }
                            return b.winRate - a.winRate;
                        }
                        
                        return b.eloRating - a.eloRating;
                    });
                    
                    const newRankings = {};
                    playersAfterGame.forEach((player, index) => {
                        newRankings[player.name] = index + 1;
                    });
                    
                    response += `• ${game.winner} hat gegen ${game.loser} gewonnen\n`;
                    response += `  ${game.winner}: ${winnerEloBefore} → ${winnerEloAfter} Elo (Rang ${oldRankings[winner.name]} → ${newRankings[winner.name]})\n`;
                    response += `  ${game.loser}: ${loserEloBefore} → ${loserEloAfter} Elo (Rang ${oldRankings[loser.name]} → ${newRankings[loser.name]})\n`;
                    response += `  Datum: ${game.date.toLocaleDateString('de-DE')} ${game.date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}\n\n`;
                }
                break;
                
            case '/dart-player':
                // Hole Statistiken für einen bestimmten Spieler
                const playerName = text.trim();
                if (!playerName) {
                    response = 'Bitte gib einen Spielernamen an: `/dart-player [Name]`';
                    break;
                }
                
                const player = await Player.findOne({ name: playerName });
                if (!player) {
                    response = `Spieler "${playerName}" nicht gefunden.`;
                    break;
                }
                
                // Berechne aktuelle Rankings
                const rankings = await calculateRankings();
                const currentRank = rankings[playerName];
                
                // Berechne die aktuelle Arbeitswoche (Montag-Freitag)
                const playerCurrentDate = new Date();
                const playerStartOfWeek = new Date(playerCurrentDate);
                
                // Setze auf Montag 00:00:00
                playerStartOfWeek.setDate(playerCurrentDate.getDate() - ((playerCurrentDate.getDay() + 6) % 7));
                playerStartOfWeek.setHours(0, 0, 0, 0);
                
                // Finde den letzten Elo-Wert vor dem Wochenstart
                const lastEloBeforeWeek = player.eloHistory
                    .filter(entry => new Date(entry.date) < playerStartOfWeek)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                
                const startElo = lastEloBeforeWeek ? lastEloBeforeWeek.elo : 1000;
                const eloImprovement = player.eloRating - startElo;
                
                response = `*Statistiken für ${playerName}:*\n`;
                response += `• Aktuelles Elo-Rating: ${player.eloRating} (${eloImprovement > 0 ? '+' : ''}${eloImprovement} diese Woche)\n`;
                response += `• Aktueller Rang: ${currentRank}\n\n`;
                
                // Hole die letzten 3 Spiele
                const playerGames = await Game.find({
                    $or: [{ winner: playerName }, { loser: playerName }]
                }).sort({ date: -1 }).limit(3);
                
                if (playerGames.length > 0) {
                    response += '*Letzte 3 Spiele:*\n';
                    for (const game of playerGames) {
                        const result = game.winner === playerName ? 'gewonnen' : 'verloren';
                        const opponent = game.winner === playerName ? game.loser : game.winner;
                        response += `• ${game.date.toLocaleDateString('de-DE')} ${game.date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}: ${result} gegen ${opponent}\n`;
                    }
                }
                break;

            case '/dart-week':
                // Berechne die aktuelle Arbeitswoche (Montag-Freitag)
                const currentDate = new Date();
                const startOfWeek = new Date(currentDate);
                
                // Setze auf Montag 00:00:00
                startOfWeek.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7));
                startOfWeek.setHours(0, 0, 0, 0);
                
                // Setze auf Sonntag 23:59:59
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);

                // Hole alle Spieler und ihre Elo-Historie
                const allPlayers = await Player.find();
                const weeklyGames = await Game.find({
                    date: {
                        $gte: startOfWeek,
                        $lte: endOfWeek
                    }
                });

                // Erstelle ein Mapping von Spielernamen zu ihren Elo-Werten am Wochenanfang
                const startOfWeekElo = {};
                allPlayers.forEach(player => {
                    // Finde den letzten Elo-Wert vor dem Wochenstart
                    const lastEloBeforeWeek = player.eloHistory
                        .filter(entry => new Date(entry.date) < startOfWeek)
                        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                    
                    startOfWeekElo[player.name] = lastEloBeforeWeek ? lastEloBeforeWeek.elo : 1000;
                });

                // Berechne die Elo-Verbesserung für jeden Spieler
                const weeklyEloImprovements = {};
                const playersInWeeklyGames = new Set();
                
                // Sammle alle Spieler, die diese Woche gespielt haben
                weeklyGames.forEach(game => {
                    playersInWeeklyGames.add(game.winner);
                    playersInWeeklyGames.add(game.loser);
                });
                
                console.log('Spieler in dieser Woche:', Array.from(playersInWeeklyGames));
                console.log('Anzahl Spiele diese Woche:', weeklyGames.length);
                
                // Berechne die Elo-Verbesserung für jeden Spieler
                playersInWeeklyGames.forEach(playerName => {
                    const player = allPlayers.find(p => p.name === playerName);
                    if (!player) {
                        console.log(`Spieler ${playerName} nicht gefunden`);
                        return;
                    }
                    
                    // Finde den aktuellen Elo-Wert
                    const currentElo = player.eloRating;
                    
                    // Finde den Start-Elo dieser Woche
                    const startElo = startOfWeekElo[playerName] || 1000;
                    
                    // Berechne die Verbesserung
                    weeklyEloImprovements[playerName] = currentElo - startElo;
                    console.log(`${playerName}: ${startElo} -> ${currentElo} (${weeklyEloImprovements[playerName]})`);
                });

                // Sortiere Spieler nach Elo-Verbesserung (absteigend)
                const sortedPlayers = Object.entries(weeklyEloImprovements)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, improvement]) => ({
                        name,
                        improvement
                    }));

                console.log('Sortierte Spieler:', sortedPlayers);

                // Erstelle die Antwort
                response = `*Spieler der Woche (${startOfWeek.toLocaleDateString('de-DE')} - ${endOfWeek.toLocaleDateString('de-DE')}):*\n\n`;
                
                if (sortedPlayers.length === 0) {
                    response += "Keine Spiele in dieser Woche.";
                } else {
                    sortedPlayers.forEach((player, index) => {
                        const sign = player.improvement >= 0 ? '+' : '';
                        response += `${index + 1}. ${player.name}: ${sign}${Math.round(player.improvement)} Elo\n`;
                    });
                }
                break;

            default:
                response = 'Unbekannter Befehl. Verfügbare Befehle:\n• `/dart-last` - Zeigt die letzten 3 Spiele\n• `/dart-player [Name]` - Zeigt Statistiken für einen Spieler\n• `/dart-week` - Zeigt die Spieler der Woche';
        }
        
        // Sende die Antwort an Slack über response_url
        console.log('Sende Antwort an Slack über response_url:', response_url);
        console.log('Antwort-Text:', response);
        
        if (!response_url) {
            console.error('Keine response_url vorhanden');
            return;
        }

        if (!response || response.trim() === '') {
            console.error('Leere Antwort generiert');
            response = 'Keine Daten verfügbar.';
        }

        try {
            const responseData = {
                response_type: 'in_channel',
                text: response,
                mrkdwn: true
            };
            
            console.log('Sende folgende Daten an Slack:', JSON.stringify(responseData, null, 2));
            
            const responseResult = await fetch(response_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(responseData)
            });
            
            const responseText = await responseResult.text();
            console.log('Slack Antwort-Text:', responseText);
            
            if (!responseResult.ok) {
                console.error('Fehler beim Senden der Slack-Antwort:', {
                    status: responseResult.status,
                    statusText: responseResult.statusText,
                    url: response_url,
                    responseText: responseText
                });
            } else {
                console.log('Antwort erfolgreich gesendet');
            }
        } catch (error) {
            console.error('Fehler beim Senden der Slack-Antwort:', error);
            console.error('Error Details:', {
                message: error.message,
                stack: error.stack
            });
        }
        
    } catch (error) {
        console.error('Fehler bei Slash-Command:', error);
        try {
            const errorResponse = {
                response_type: 'ephemeral',
                text: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.'
            };
            
            await fetch(response_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(errorResponse)
            });
        } catch (slackError) {
            console.error('Fehler beim Senden der Fehlermeldung:', slackError);
        }
    }
});

// Elo Rating Berechnungsfunktionen
function calculateExpectedScore(playerRating, opponentRating) {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function calculateKFactor(gamesPlayed) {
    // K-Faktor basierend auf Spielerfahrung
    if (gamesPlayed < 30) return 32;  // Anfänger
    if (gamesPlayed < 100) return 24; // Fortgeschrittene
    return 16;                        // Experten
}

function updateEloRatings(winner, loser, gameDate) {
    const kWinner = calculateKFactor(winner.gamesPlayed);
    const kLoser = calculateKFactor(loser.gamesPlayed);
    
    // Verwende die aktuellen Ratings statt der historischen
    const winnerElo = winner.eloRating;
    const loserElo = loser.eloRating;
    
    const expectedWinner = calculateExpectedScore(winnerElo, loserElo);
    const expectedLoser = calculateExpectedScore(loserElo, winnerElo);
    
    // Update Ratings
    winner.eloRating = Math.round(winnerElo + kWinner * (1 - expectedWinner));
    loser.eloRating = Math.round(loserElo + kLoser * (0 - expectedLoser));
    
    // Update Spieleanzahl
    winner.gamesPlayed += 1;
    loser.gamesPlayed += 1;
    
    // Füge neue Elo-Werte zur Historie hinzu
    winner.eloHistory.push({ elo: winner.eloRating, date: gameDate });
    loser.eloHistory.push({ elo: loser.eloRating, date: gameDate });
}

// Funktion zum Zurücksetzen und Neuberechnen der Elo-Ratings
async function recalculateEloRatings() {
    try {
        // Setze alle Spieler auf Startwert zurück
        await Player.updateMany({}, { 
            eloRating: 1000,
            gamesPlayed: 0,
            eloHistory: [{ elo: 1000, date: new Date(0) }] // Initialer Eintrag
        });
        
        // Hole alle Spiele chronologisch sortiert
        const games = await Game.find().sort({ date: 1 });
        
        // Berechne Elo für jedes Spiel neu
        for (const game of games) {
            const winner = await Player.findOne({ name: game.winner });
            const loser = await Player.findOne({ name: game.loser });
            
            if (winner && loser) {
                // Update Elo Ratings mit dem tatsächlichen Spiel-Datum
                updateEloRatings(winner, loser, game.date);
                await winner.save();
                await loser.save();
            }
        }
        
        console.log('Elo-Ratings und Historie wurden neu berechnet');
    } catch (error) {
        console.error('Fehler beim Neuberechnen der Elo-Ratings:', error);
    }
}

// API Routes
// Spieler abrufen
app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find();
        const games = await Game.find();
        
        // Berechne Statistiken für jeden Spieler
        const playerStats = players.map(player => {
            const playerGames = games.filter(game => 
                game.winner === player.name || game.loser === player.name
            );
            
            const wins = playerGames.filter(game => game.winner === player.name).length;
            const losses = playerGames.filter(game => game.loser === player.name).length;
            const totalGames = wins + losses;
            const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0';
            
            return {
                ...player.toObject(),
                wins,
                losses,
                winRate
            };
        }); // Entferne den Filter für Spieler mit mindestens einem Spiel
        
        res.json(playerStats);
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden der Spieler' });
    }
});

// Neuen Spieler hinzufügen
app.post('/api/players', async (req, res) => {
    try {
        const player = new Player(req.body);
        await player.save();
        res.status(201).json(player);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Spiele abrufen
app.get('/api/games', async (req, res) => {
    try {
        const games = await Game.find().sort({ date: -1 });
        res.json(games);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Hilfsfunktion zur Berechnung der Rangliste
async function calculateRankings() {
    try {
        const players = await Player.find();
        const games = await Game.find();
        
        // Berechne Statistiken für jeden Spieler
        const playerStats = players.map(player => {
            const playerGames = games.filter(game => {
                if (game.isMultiplayer) {
                    return game.players.includes(player.name);
                } else {
                    return game.winner === player.name || game.loser === player.name;
                }
            });
            
            let wins = 0;
            let losses = 0;
            
            playerGames.forEach(game => {
                if (game.isMultiplayer) {
                    // Bei Multiplayer-Spielen zählen wir nur die Teilnahme
                    wins += 0;
                    losses += 1;
                } else {
                    // Bei 1:1 Spielen
                    if (game.winner === player.name) {
                        wins += 1;
                    } else if (game.loser === player.name) {
                        losses += 1;
                    }
                }
            });
            
            const totalGames = playerGames.length;
            const winRate = totalGames > 0 ? (wins / totalGames) : 0;
            
            return {
                name: player.name,
                wins,
                totalGames,
                winRate,
                eloRating: player.eloRating || 1000, // Fallback auf 1000 wenn nicht gesetzt
                gamesPlayed: player.gamesPlayed || 0  // Fallback auf 0 wenn nicht gesetzt
            };
        });
        
        // Sortiere nach:
        // 1. Erst alle Spieler mit ≥10 Spielen (nach Elo sortiert)
        // 2. Dann alle Spieler mit <10 Spielen (nach Elo sortiert)
        const qualifiedPlayers = playerStats
            .filter(player => player.totalGames >= 10)
            .sort((a, b) => {
                if (b.eloRating !== a.eloRating) {
                    return b.eloRating - a.eloRating;
                }
                return b.winRate - a.winRate;
            });
        
        const unqualifiedPlayers = playerStats
            .filter(player => player.totalGames < 10)
            .sort((a, b) => {
                if (b.eloRating !== a.eloRating) {
                    return b.eloRating - a.eloRating;
                }
                return b.winRate - a.winRate;
            });
        
        // Kombiniere beide Listen: Erst qualifizierte, dann unqualifizierte
        const sortedPlayers = [...qualifiedPlayers, ...unqualifiedPlayers];
        
        // Erstelle ein Mapping von Spielername zu Rang
        const rankings = {};
        sortedPlayers.forEach((player, index) => {
            rankings[player.name] = index + 1;
        });
        
        return rankings;
    } catch (error) {
        console.error('Fehler bei der Berechnung der Rangliste:', error);
        return {};
    }
}

// Spiel speichern
app.post('/api/games', async (req, res) => {
    try {
        const { winner, loser, format } = req.body;
        
        // Finde die Spieler
        const winnerPlayer = await Player.findOne({ name: winner });
        const loserPlayer = await Player.findOne({ name: loser });
        
        if (!winnerPlayer || !loserPlayer) {
            return res.status(404).json({ error: 'Spieler nicht gefunden' });
        }
        
        // Erstelle das Spiel mit aktuellem Datum
        const gameDate = new Date();
        // Konvertiere UTC zu deutscher Zeit (UTC+2)
        const germanDate = new Date(gameDate.getTime() + (2 * 60 * 60 * 1000));
        console.log('Neues Spiel wird gespeichert:');
        console.log('UTC-Zeit:', gameDate.toISOString());
        console.log('Deutsche Zeit (UTC+2):', germanDate.toISOString());
        const game = new Game({
            winner,
            loser,
            format,
            date: germanDate
        });

        // Sende Slack-Nachricht
        try {
            console.log('=== Slack-Nachricht wird vorbereitet ===');
            console.log('Channel ID:', SLACK_CHANNEL);
            console.log('Token vorhanden:', !!process.env.SLACK_TOKEN);
            
            // Berechne die alten Rankings
            const oldRankings = await calculateRankings();
            const winnerOldRank = oldRankings[winner];
            const loserOldRank = oldRankings[loser];
            
            console.log('Alte Rankings:', { winner: winnerOldRank, loser: loserOldRank });
            
            // Update Elo Ratings mit Spiel-Datum
            updateEloRatings(winnerPlayer, loserPlayer, gameDate);
            
            // Speichere die aktualisierten Spieler
            await winnerPlayer.save();
            await loserPlayer.save();
            
            // Speichere das Spiel
            await game.save();
            
            // Berechne die neuen Rankings
            const newRankings = await calculateRankings();
            const winnerNewRank = newRankings[winner];
            const loserNewRank = newRankings[loser];
            
            console.log('Neue Rankings:', { winner: winnerNewRank, loser: loserNewRank });
            
            // Berechne die Rangänderungen
            const winnerRankChange = winnerOldRank - winnerNewRank; // Positiv = Verbesserung
            const loserRankChange = loserOldRank - loserNewRank; // Negativ = Verschlechterung
            
            // Formatiere die Rangänderungen
            const formatRankChange = (change) => {
                if (change === 0) return '±0';
                const sign = change > 0 ? '+' : '-';
                return `${sign}${Math.abs(change)}`;
            };
            
            const message = `${winner} (Rang: ${winnerNewRank} | ${formatRankChange(winnerRankChange)}) hat gegen ${loser} (Rang: ${loserNewRank} | ${formatRankChange(loserRankChange)}) gewonnen! :dart:`;
            console.log('Sende Slack-Nachricht:', message);
            
            const slackResponse = await slack.chat.postMessage({
                channel: SLACK_CHANNEL,
                text: message
            });
            
            console.log('Slack-Antwort erhalten:', slackResponse);
            console.log('=== Slack-Nachricht erfolgreich gesendet ===');
        } catch (slackError) {
            console.error('=== Fehler beim Senden der Slack-Nachricht ===');
            console.error('Fehler-Details:', {
                message: slackError.message,
                code: slackError.code,
                status: slackError.status,
                data: slackError.data
            });
            console.error('Vollständiger Fehler:', slackError);
        }

        res.status(201).json(game);
    } catch (error) {
        console.error('Fehler beim Speichern des Spiels:', error);
        res.status(500).json({ error: 'Fehler beim Speichern des Spiels' });
    }
});

// Statistik abrufen
app.get('/api/stats', async (req, res) => {
    try {
        const players = await Player.find();
        const games = await Game.find();
        
        // Berechne die Rangliste für alle Spieler
        const rankings = await calculateRankings();
        
        const stats = players.map(player => {
            // Filtere Spiele, an denen der Spieler beteiligt war
            const playerGames = games.filter(game => {
                if (game.isMultiplayer) {
                    return game.players.includes(player.name);
                } else {
                    return game.winner === player.name || game.loser === player.name;
                }
            });
            
            // Berechne Siege und Niederlagen
            let wins = 0;
            let losses = 0;
            
            playerGames.forEach(game => {
                if (game.isMultiplayer) {
                    // Bei Multiplayer-Spielen zählen wir nur die Teilnahme
                    wins += 0;
                    losses += 1;
                } else {
                    // Bei 1:1 Spielen
                    if (game.winner === player.name) {
                        wins += 1;
                    } else if (game.loser === player.name) {
                        losses += 1;
                    }
                }
            });
            
            // Berechne einfache Statistiken
            const totalGames = playerGames.length;
            const winRate = totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : 0;
            
            // Head-to-Head Statistiken (nur für Spieler mit gemeinsamen Spielen)
            const headToHead = {};
            players.forEach(opponent => {
                if (opponent.name !== player.name) {
                    // Nur 1:1 Spiele für Head-to-Head
                    const matches = games.filter(game => 
                        !game.isMultiplayer && 
                        ((game.winner === player.name && game.loser === opponent.name) ||
                         (game.winner === opponent.name && game.loser === player.name))
                    );
                    
                    // Nur Gegner hinzufügen, gegen die auch gespielt wurde
                    if (matches.length > 0) {
                        const winsVsOpponent = matches.filter(game => game.winner === player.name).length;
                        const totalGamesVsOpponent = matches.length;
                        
                        headToHead[opponent.name] = {
                            wins: winsVsOpponent,
                            losses: totalGamesVsOpponent - winsVsOpponent,
                            winRate: (winsVsOpponent / totalGamesVsOpponent * 100).toFixed(1)
                        };
                    }
                }
            });

            return {
                ...player.toObject(),
                games: totalGames,
                wins,
                losses,
                winRate,
                headToHead,
                rank: rankings[player.name] || 0 // Füge den Rang hinzu
            };
        });
        
        // Sortiere die Statistiken nach:
        // 1. Anzahl der Siege (absteigend)
        // 2. Anzahl der Spiele (aufsteigend)
        // 3. Siegesquote (absteigend)
        stats.sort((a, b) => {
            // Zuerst nach Siegen
            if (b.wins !== a.wins) {
                return b.wins - a.wins;
            }
            // Dann nach Anzahl der Spiele (weniger ist besser)
            if (a.games !== b.games) {
                return a.games - b.games;
            }
            // Zuletzt nach Siegesquote
            return parseFloat(b.winRate) - parseFloat(a.winRate);
        });
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Route zum Neuberechnen der Elo-Ratings
app.post('/api/recalculate-elo', async (req, res) => {
    try {
        await recalculateEloRatings();
        res.json({ message: 'Elo-Ratings wurden neu berechnet' });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Neuberechnen der Elo-Ratings' });
    }
});

// Exportiere die Funktion für die Testumgebung
module.exports = {
    recalculateEloRatings
};

// Server nur starten, wenn das Modul direkt ausgeführt wird
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server läuft auf Port ${PORT}`);
        console.log(`http://localhost:${PORT}`);
    });
} 