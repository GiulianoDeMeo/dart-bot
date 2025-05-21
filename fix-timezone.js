const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Verbindung
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dart-bot-app:xhfbGnfII6WhJKEA@pickware.biz4mzw.mongodb.net/dart-stats';

// Spiel Schema
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

const Game = mongoose.model('Game', gameSchema);

async function fixLastTwoGames() {
    try {
        console.log('Verbinde mit MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Verbindung erfolgreich');

        // Finde die letzten drei Spiele
        const lastThreeGames = await Game.find()
            .sort({ date: -1 })
            .limit(3);

        console.log('Gefundene Spiele:', lastThreeGames.length);

        // Aktualisiere jedes Spiel
        for (const game of lastThreeGames) {
            const oldDate = game.date;
            // Konvertiere das Datum in die deutsche Zeitzone
            const berlinDate = new Date(oldDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
            // Erstelle ein neues Date-Objekt mit der korrekten Zeitzone
            const newDate = new Date(berlinDate.getTime() - berlinDate.getTimezoneOffset() * 60000);
            
            console.log(`Aktualisiere Spiel ${game._id}:`);
            console.log(`Altes Datum: ${oldDate}`);
            console.log(`Neues Datum: ${newDate}`);

            // Aktualisiere das Spiel
            await Game.updateOne(
                { _id: game._id },
                { $set: { date: newDate } }
            );
        }

        console.log('Zeitzonenkorrektur abgeschlossen');
    } catch (error) {
        console.error('Fehler:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB Verbindung geschlossen');
    }
}

fixLastTwoGames(); 