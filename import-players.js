const mongoose = require('mongoose');
require('dotenv').config();

const playerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    nickname: { type: String, required: true }
});

const Player = mongoose.model('Player', playerSchema);

const initialPlayers = [
    {
        name: "Michael",
        nickname: "Der Chef"
    },
    {
        name: "Thomas",
        nickname: "Der Profi"
    },
    {
        name: "Andreas",
        nickname: "Der Schütze"
    },
    {
        name: "Stefan",
        nickname: "Der Flieger"
    },
    {
        name: "Markus",
        nickname: "Der Treffer"
    },
    {
        name: "Daniel",
        nickname: "Der Scharfschütze"
    },
    {
        name: "Christian",
        nickname: "Der Meister"
    },
    {
        name: "Patrick",
        nickname: "Der Champion"
    }
];

async function importPlayers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dart-stats', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Lösche alle existierenden Spieler
        await Player.deleteMany({});

        // Füge die neuen Spieler hinzu
        await Player.insertMany(initialPlayers);

        console.log('Spieler erfolgreich importiert!');
        process.exit(0);
    } catch (error) {
        console.error('Fehler beim Importieren:', error);
        process.exit(1);
    }
}

importPlayers(); 