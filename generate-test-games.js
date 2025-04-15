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
        const gamesPerMatchup = 10;
        
        // Weise jedem Spieler einen Skill-Level zu (0.5-1.0)
        const playerSkills = {};
        players.forEach(player => {
            playerSkills[player.name] = 0.5 + Math.random() * 0.5;
        });

        for (let i = 0; i < players.length; i++) {
            for (let j = 0; j < players.length; j++) {
                if (i !== j) {
                    const player1 = players[i];
                    const player2 = players[j];
                    const skill1 = playerSkills[player1.name];
                    const skill2 = playerSkills[player2.name];

                    for (let k = 0; k < gamesPerMatchup; k++) {
                        const randomMinutes = Math.floor(Math.random() * 30) + 1;
                        const gameDate = new Date();
                        gameDate.setMinutes(gameDate.getMinutes() - randomMinutes);

                        // Bestimme Gewinner basierend auf Skill
                        const isPlayer1Winner = Math.random() < (skill1 / (skill1 + skill2));
                        const winner = isPlayer1Winner ? player1 : player2;
                        const loser = isPlayer1Winner ? player2 : player1;

                        // Generiere zufällige Anzahl von Legs (3-5)
                        const numLegs = Math.floor(Math.random() * 3) + 3;

                        // Generiere zufälligen Checkout (20-170)
                        const highestCheckout = Math.floor(Math.random() * 151) + 20;

                        games.push({
                            winner: winner.name,
                            loser: loser.name,
                            date: gameDate,
                            format: {
                                type: '501',
                                legs: numLegs
                            },
                            highestCheckout
                        });
                    }
                }
            }
        }

        await Game.insertMany(games);

        console.log(`${games.length} Testspiele wurden erfolgreich generiert!`);
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