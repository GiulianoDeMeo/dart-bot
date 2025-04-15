const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Verbindung
console.log('Versuche Verbindung zur MongoDB herzustellen...');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Vorhanden' : 'Fehlt');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Verbindung erfolgreich hergestellt');
    console.log('Datenbank:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
}).catch(err => {
    console.error('MongoDB Verbindungsfehler:', err);
    console.error('Details:', {
        name: err.name,
        message: err.message,
        code: err.code
    });
    process.exit(1); // Beende den Server bei Verbindungsfehler
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
    name: { type: String, required: true, unique: true }
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

// API Routes
// Spieler abrufen
app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find({ name: { $ne: 'Yannik Erhardt' } });
        res.json(players);
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
    const players = await Player.find();
    const games = await Game.find();
    
    // Berechne Statistiken für jeden Spieler
    const playerStats = players.map(player => {
        const playerGames = games.filter(game => 
            !game.isMultiplayer && (game.winner === player.name || game.loser === player.name)
        );
        
        const wins = playerGames.filter(game => game.winner === player.name).length;
        const totalGames = playerGames.length;
        const winRate = totalGames > 0 ? (wins / totalGames) : 0;
        
        return {
            name: player.name,
            wins,
            totalGames,
            winRate
        };
    });
    
    // Sortiere nach Gewinnrate und dann nach Anzahl der Spiele
    const sortedPlayers = playerStats.sort((a, b) => {
        if (b.winRate !== a.winRate) {
            return b.winRate - a.winRate;
        }
        return b.totalGames - a.totalGames;
    });
    
    // Erstelle ein Mapping von Spielername zu Rang
    const rankings = {};
    sortedPlayers.forEach((player, index) => {
        rankings[player.name] = index + 1;
    });
    
    return rankings;
}

// Neues Spiel hinzufügen
app.post('/api/games', async (req, res) => {
    try {
        // Hole aktuelle Rangliste vor dem Spiel
        const oldRankings = await calculateRankings();
        
        // Validiere das Spiel
        if (req.body.isMultiplayer) {
            if (!req.body.players || req.body.players.length < 2 || req.body.players.length > 4) {
                return res.status(400).json({ message: 'Multiplayer-Spiele müssen zwischen 2 und 4 Spielern stattfinden.' });
            }
        } else {
            if (!req.body.winner || !req.body.loser) {
                return res.status(400).json({ message: '1:1 Spiele benötigen einen Gewinner und einen Verlierer.' });
            }
        }
        
        const game = new Game(req.body);
        await game.save();

        // Berechne neue Rangliste nach dem Spiel
        const newRankings = await calculateRankings();
        
        // Berechne Rangveränderungen
        const winnerOldRank = oldRankings[game.winner];
        const winnerNewRank = newRankings[game.winner];
        const winnerChange = winnerOldRank - winnerNewRank;
        
        const loserOldRank = oldRankings[game.loser];
        const loserNewRank = newRankings[game.loser];
        const loserChange = loserOldRank - loserNewRank;
        
        // Formatiere Rangveränderungen für Slack
        const formatRankChange = (change) => {
            if (change > 0) {
                return `+${change}`;
            } else if (change < 0) {
                return `${change}`;
            }
            return '±0';
        };

        console.log('Spiel wurde gespeichert:', game);
        console.log('Versuche Slack-Nachricht zu senden...');
        console.log('Slack Token:', process.env.SLACK_TOKEN ? 'Vorhanden' : 'Fehlt');
        console.log('Slack Channel:', process.env.SLACK_CHANNEL);

        // Slack-Nachricht senden
        try {
            const result = await slack.chat.postMessage({
                channel: '#' + process.env.SLACK_CHANNEL,
                text: `${game.winner} (Rang ${winnerNewRank} | ${formatRankChange(winnerChange)}) hat gegen ${game.loser} (Rang ${loserNewRank} | ${formatRankChange(loserChange)}) das Dartspiel gewonnen! 🎯`
            });
            console.log('Slack-Nachricht erfolgreich gesendet:', result);
        } catch (slackError) {
            console.error('Fehler beim Senden der Slack-Nachricht:', slackError);
            console.error('Slack Error Details:', {
                error: slackError.message,
                data: slackError.data,
                code: slackError.code
            });
        }

        res.status(201).json(game);
    } catch (error) {
        console.error('Fehler beim Speichern des Spiels:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Statistik abrufen
app.get('/api/stats', async (req, res) => {
    try {
        const players = await Player.find();
        const games = await Game.find();
        
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
                headToHead
            };
        });
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
}); 