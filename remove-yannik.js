const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Verbindung
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dart-stats', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Player Schema
const playerSchema = new mongoose.Schema({
    name: String,
    nickname: String
});

const Player = mongoose.model('Player', playerSchema);

// Game Schema
const gameSchema = new mongoose.Schema({
    winner: String,
    loser: String,
    date: Date,
    format: {
        type: String,
        legs: Number
    }
});

const Game = mongoose.model('Game', gameSchema);

async function removeYannik() {
    try {
        // Lösche Yannik aus der Players Collection
        await Player.deleteOne({ name: 'Yannik Erhardt' });
        
        // Lösche alle Spiele, in denen Yannik beteiligt war
        await Game.deleteMany({
            $or: [
                { winner: 'Yannik Erhardt' },
                { loser: 'Yannik Erhardt' }
            ]
        });
        
        console.log('Yannik Erhardt wurde erfolgreich aus der Datenbank entfernt.');
        mongoose.connection.close();
    } catch (error) {
        console.error('Fehler beim Entfernen von Yannik Erhardt:', error);
        mongoose.connection.close();
    }
}

removeYannik(); 