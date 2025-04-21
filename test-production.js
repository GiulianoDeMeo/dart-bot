const mongoose = require('mongoose');

const PROD_URI = 'mongodb+srv://dart-bot-app:xhfbGnfII6WhJKEA@pickware.biz4mzw.mongodb.net/dart-stats';

async function testProduction() {
    console.log('Verbinde mit Produktionsdatenbank...');
    const conn = await mongoose.createConnection(PROD_URI);
    await conn.asPromise();

    try {
        // 1. Überprüfe Spieler
        const players = await conn.db.collection('players').find().toArray();
        console.log(`\nAnzahl Spieler: ${players.length}`);
        
        // Zähle Spieler mit/ohne neue Felder
        const playersWithElo = players.filter(p => p.eloRating !== undefined).length;
        const playersWithGames = players.filter(p => p.gamesPlayed !== undefined).length;
        console.log(`Spieler mit eloRating: ${playersWithElo}`);
        console.log(`Spieler mit gamesPlayed: ${playersWithGames}`);

        // Zeige die ersten 5 Spieler als Beispiel
        console.log('\nBeispiel-Spieler:');
        players.slice(0, 5).forEach(player => {
            console.log(JSON.stringify(player, null, 2));
        });

        // 2. Überprüfe Spiele
        const games = await conn.db.collection('games').find().toArray();
        console.log(`\nAnzahl Spiele: ${games.length}`);

        // Zeige die letzten 5 Spiele als Beispiel
        console.log('\nLetzte 5 Spiele:');
        games.slice(-5).forEach(game => {
            console.log(JSON.stringify(game, null, 2));
        });

    } catch (error) {
        console.error('Fehler beim Test:', error);
    } finally {
        await conn.close();
    }
}

testProduction().catch(console.error); 