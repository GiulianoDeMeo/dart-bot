const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dart-bot-app:xhfbGnfII6WhJKEA@pickware.biz4mzw.mongodb.net/dart-stats';

// Spieler Schema
const playerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    nickname: { type: String, required: true }
});

// Spiel Schema
const gameSchema = new mongoose.Schema({
    winner: { type: String },
    loser: { type: String },
    date: { type: Date, default: Date.now },
    format: {
        type: { type: String, enum: ['501', '301'], default: '501' },
        legs: { type: Number, required: true }
    }
});

const Player = mongoose.model('Player', playerSchema);
const Game = mongoose.model('Game', gameSchema);

async function checkMongoDBData() {
    try {
        console.log('Verbinde mit MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Verbindung hergestellt');

        // Überprüfe Spieler
        const players = await Player.find();
        console.log(`Gefundene Spieler: ${players.length}`);
        console.log('Spieler:');
        players.forEach(player => {
            console.log(`- ${player.name} (${player.nickname})`);
        });

        // Überprüfe Spiele
        const games = await Game.find();
        console.log(`\nGefundene Spiele: ${games.length}`);
        console.log('Letzte 5 Spiele:');
        const recentGames = games.slice(-5);
        recentGames.forEach(game => {
            console.log(`- ${game.winner} hat gegen ${game.loser} gewonnen am ${game.date}`);
        });

        await mongoose.disconnect();
        console.log('\nVerbindung getrennt');
    } catch (error) {
        console.error('Fehler:', error);
    }
}

checkMongoDBData(); 