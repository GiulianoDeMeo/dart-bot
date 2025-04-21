const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: '*', // Erlaube alle Ursprünge im Entwicklungsmodus
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
}));
app.use(express.json());
app.use(express.static('public'));

// MongoDB Verbindung
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dart-bot-app:xhfbGnfII6WhJKEA@pickware.biz4mzw.mongodb.net/dart-stats';

console.log('Versuche Verbindung zur MongoDB herzustellen...');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Vorhanden' : 'Fehlt');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Verbindung erfolgreich hergestellt');
    const db = mongoose.connection.db;
    console.log('Datenbank:', db.databaseName);
    console.log('Host:', mongoose.connection.host);
    console.log('Verbundene Datenbank:', db.databaseName);
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
    
    const expectedWinner = calculateExpectedScore(winner.eloRating, loser.eloRating);
    const expectedLoser = calculateExpectedScore(loser.eloRating, winner.eloRating);
    
    // Speichere alte Elo-Werte
    const oldWinnerElo = winner.eloRating;
    const oldLoserElo = loser.eloRating;
    
    // Update Ratings
    winner.eloRating = Math.round(winner.eloRating + kWinner * (1 - expectedWinner));
    loser.eloRating = Math.round(loser.eloRating + kLoser * (0 - expectedLoser));
    
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
        // 1. Spieler mit Spielen kommen zuerst
        // 2. Elo-Rating (absteigend)
        // 3. Anzahl der Siege (absteigend)
        // 4. Siegesquote (absteigend)
        const sortedPlayers = playerStats.sort((a, b) => {
            // Zuerst nach Spielerfahrung
            const aHasGames = a.totalGames > 0;
            const bHasGames = b.totalGames > 0;
            
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
        const game = new Game({
            winner,
            loser,
            format,
            date: gameDate
        });

        // Sende Slack-Nachricht
        try {
            // Berechne die alten Rankings
            const oldRankings = await calculateRankings();
            const winnerOldRank = oldRankings[winner];
            const loserOldRank = oldRankings[loser];
            
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
            
            await slack.chat.postMessage({
                channel: process.env.SLACK_CHANNEL,
                text: message
            });
        } catch (slackError) {
            console.error('Fehler beim Senden der Slack-Nachricht:', slackError);
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

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
}); 