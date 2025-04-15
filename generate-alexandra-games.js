const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Verbindung
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dart-stats', {
    useNewUrlParser: true,
    useUnifiedTopology: true
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

const Game = mongoose.model('Game', gameSchema);

async function generateAlexandraGames() {
    try {
        // Liste der möglichen Gegner (ohne Alexandra)
        const opponents = [
            'Michael Haas',
            'Stefan Heppenheimer',
            'Christian Juner',
            'Maurice Calmano',
            'Martina Mrkonjic',
            'Johannes Rübsam',
            'Erik Forss',
            'Cedric Engler',
            'Hannibal Wissing',
            'Julia Matz'
        ];

        const games = [];
        const alexandraName = 'Alexandra Schäfer';
        
        // Generiere 10 Spiele
        for (let i = 0; i < 10; i++) {
            const opponent = opponents[i];
            const isWinner = Math.random() < 0.6; // 60% Gewinnchance für Alexandra
            
            const game = {
                winner: isWinner ? alexandraName : opponent,
                loser: isWinner ? opponent : alexandraName,
                date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Ein Spiel pro Tag rückwärts
                format: {
                    type: '501',
                    legs: 3
                }
            };
            
            games.push(game);
        }

        // Speichere die Spiele in der Datenbank
        await Game.insertMany(games);
        
        console.log('10 Spiele für Alexandra wurden generiert:');
        games.forEach(game => {
            console.log(`${game.winner} vs ${game.loser} (${new Date(game.date).toLocaleDateString()})`);
        });

        mongoose.connection.close();
    } catch (error) {
        console.error('Fehler beim Generieren der Spiele:', error);
        mongoose.connection.close();
    }
}

generateAlexandraGames(); 