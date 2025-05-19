const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updatePlayerName() {
    // Verbindung zur Produktionsdatenbank (dart-stats)
    const prodUri = process.env.MONGODB_URI.replace('test-database', 'dart-stats');
    const prodClient = new MongoClient(prodUri);
    
    // Verbindung zur Testdatenbank
    const testUri = process.env.MONGODB_URI;
    const testClient = new MongoClient(testUri);

    try {
        // Verbindung zur Produktionsdatenbank herstellen
        await prodClient.connect();
        console.log('Verbunden mit Produktionsdatenbank');
        
        // Verbindung zur Testdatenbank herstellen
        await testClient.connect();
        console.log('Verbunden mit Testdatenbank');

        // Update in Produktionsdatenbank
        const prodResult = await prodClient.db().collection('players').updateMany(
            { name: 'Elias Espositos' },
            { $set: { name: 'Elias Esposito' } }
        );
        console.log('Produktionsdatenbank Update:', prodResult);

        // Update in Testdatenbank
        const testResult = await testClient.db().collection('players').updateMany(
            { name: 'Elias Espositos' },
            { $set: { name: 'Elias Esposito' } }
        );
        console.log('Testdatenbank Update:', testResult);

    } catch (error) {
        console.error('Fehler:', error);
    } finally {
        await prodClient.close();
        await testClient.close();
        console.log('Verbindungen geschlossen');
    }
}

updatePlayerName(); 