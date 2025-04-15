const mongoose = require('mongoose');
require('dotenv').config();

// Spieler Schema
const playerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    nickname: { type: String, required: true }
});

// Spiel Schema
const gameSchema = new mongoose.Schema({
    winner: { type: String, required: true },
    loser: { type: String, required: true },
    date: { type: Date, default: Date.now },
    format: {
        type: { type: String, enum: ['501', '301'], default: '501' },
        legs: { type: Number, required: true }
    },
    highestCheckout: { type: Number }
});

const Player = mongoose.model('Player', playerSchema);
const Game = mongoose.model('Game', gameSchema);

// Hilfsfunktionen für realistische Statistiken
function generateScore(playerSkill) {
    // Skill zwischen 0 und 1 beeinflusst die Wahrscheinlichkeit hoher Scores
    const rand = Math.random();
    if (rand < playerSkill * 0.1) return 180; // 180er
    if (rand < playerSkill * 0.3) return 140 + Math.floor(Math.random() * 40); // 140-179
    if (rand < playerSkill * 0.6) return 100 + Math.floor(Math.random() * 40); // 100-139
    return 40 + Math.floor(Math.random() * 60); // 40-99
}

function generateLeg(playerSkill, opponentSkill) {
    const scores = [];
    let remaining = 501;
    let darts = 0;
    let checkoutAttempts = 0;
    let highestScore = 0;
    let oneEighties = 0;

    while (remaining > 0 && darts < 100) { // Max 100 Darts pro Leg
        const score = generateScore(playerSkill);
        if (score === 180) oneEighties++;
        highestScore = Math.max(highestScore, score);
        
        if (remaining - score <= 1) {
            checkoutAttempts++;
            if (Math.random() < playerSkill * 0.4) { // Checkout-Chance basierend auf Skill
                remaining = 0;
            } else {
                scores.push(0); // Verpasster Checkout
            }
        } else {
            remaining -= score;
            scores.push(score);
        }
        darts += 3;
    }

    return {
        scores,
        darts,
        remaining,
        checkoutAttempts,
        highestScore,
        oneEighties
    };
}

async function generateTestGames() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dart-stats', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const players = await Player.find();
        await Game.deleteMany({});

        const games = [];
        const totalGames = 100; // Genau 100 Spiele
        
        // Weise jedem Spieler einen Skill-Level zu (0.5-1.0)
        const playerSkills = {};
        players.forEach(player => {
            playerSkills[player.name] = 0.5 + Math.random() * 0.5;
        });

        // Generiere genau 100 zufällige Spiele
        for (let i = 0; i < totalGames; i++) {
            const player1 = players[Math.floor(Math.random() * players.length)];
            let player2;
            do {
                player2 = players[Math.floor(Math.random() * players.length)];
            } while (player2.name === player1.name);

            const skill1 = playerSkills[player1.name];
            const skill2 = playerSkills[player2.name];
            
            const isPlayer1Winner = Math.random() < (skill1 / (skill1 + skill2));
            
            const game = {
                winner: isPlayer1Winner ? player1.name : player2.name,
                loser: isPlayer1Winner ? player2.name : player1.name,
                date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
                format: {
                    type: '501',
                    legs: 3
                }
            };
            
            games.push(game);
        }

        // Speichere die Spiele in der Datenbank
        await Game.insertMany(games);
        
        console.log(`${totalGames} Testspiele wurden erfolgreich generiert!`);
        console.log('\nSpieler Skill-Levels:');
        Object.entries(playerSkills).forEach(([name, skill]) => {
            console.log(`${name}: ${(skill * 100).toFixed(1)}%`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Fehler:', error);
        process.exit(1);
    }
}

generateTestGames(); 