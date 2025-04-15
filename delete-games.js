const mongoose = require('mongoose');
require('dotenv').config();

const gameSchema = new mongoose.Schema({
    winner: String,
    loser: String,
    date: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', gameSchema);

async function deleteLastGames() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Mit MongoDB verbunden');

        // Finde die letzten 8 Spiele
        const games = await Game.find().sort({ date: -1 }).limit(8);
        console.log(`Gefunden: ${games.length} Spiele`);

        // Lösche diese Spiele
        const result = await Game.deleteMany({ 
            _id: { $in: games.map(game => game._id) } 
        });

        console.log(`${result.deletedCount} Spiele wurden gelöscht`);
    } catch (error) {
        console.error('Fehler:', error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

deleteLastGames(); 