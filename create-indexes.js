require('dotenv').config();
const mongoose = require('mongoose');

// Verbindung zur MongoDB herstellen
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Verbindung hergestellt'))
    .catch(err => console.error('MongoDB Verbindungsfehler:', err));

// Player Schema
const playerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    eloRating: { type: Number, default: 1000 },
    gamesPlayed: { type: Number, default: 0 },
    eloHistory: [{
        elo: { type: Number, required: true },
        date: { type: Date, required: true }
    }]
});

// Game Schema
const gameSchema = new mongoose.Schema({
    winner: { type: String },
    loser: { type: String },
    players: { type: [String] },
    isMultiplayer: { type: Boolean, default: false },
    date: { type: Date, default: Date.now },
    format: {
        type: { type: String, enum: ['501', '301'], default: '501' },
        legs: { type: Number, required: true, default: 3 }
    },
    highestCheckout: { type: Number }
});

const Player = mongoose.model('Player', playerSchema);
const Game = mongoose.model('Game', gameSchema);

async function createIndexes() {
    try {
        console.log('Erstelle Indizes...');

        // Player Indizes
        await Player.collection.createIndex({ name: 1 }, { unique: true });
        console.log('✓ Player Index: name (unique)');

        await Player.collection.createIndex({ eloRating: -1 });
        console.log('✓ Player Index: eloRating');

        await Player.collection.createIndex({ gamesPlayed: 1 });
        console.log('✓ Player Index: gamesPlayed');

        // Game Indizes
        await Game.collection.createIndex({ date: -1 });
        console.log('✓ Game Index: date');

        await Game.collection.createIndex({ winner: 1 });
        console.log('✓ Game Index: winner');

        await Game.collection.createIndex({ loser: 1 });
        console.log('✓ Game Index: loser');

        await Game.collection.createIndex({ winner: 1, loser: 1 });
        console.log('✓ Game Index: winner + loser (compound)');

        console.log('\nAlle Indizes wurden erfolgreich erstellt!');
    } catch (error) {
        console.error('Fehler beim Erstellen der Indizes:', error);
    } finally {
        mongoose.connection.close();
    }
}

createIndexes(); 