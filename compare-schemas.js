const mongoose = require('mongoose');
require('dotenv').config();

async function compareSchemas() {
    try {
        // Verbindung zur Test-Datenbank
        const testConnection = await mongoose.createConnection(process.env.MONGODB_URI);
        await testConnection.asPromise(); // Warte auf die Verbindung
        console.log('Verbunden mit Test-Datenbank');

        // Hole alle Collections aus der Test-Datenbank
        const testCollections = await testConnection.db.listCollections().toArray();
        console.log('\nCollections in Test-Datenbank:');
        for (const collection of testCollections) {
            console.log(`- ${collection.name}`);
            
            // Hole Schema-Informationen für jede Collection
            const docs = await testConnection.db.collection(collection.name).find().limit(1).toArray();
            if (docs.length > 0) {
                console.log('  Schema-Beispiel:');
                console.log(JSON.stringify(docs[0], null, 2));
            }
        }

        await testConnection.close();

        // Verbindung zur Produktions-Datenbank (dart-stats)
        const prodUri = 'mongodb+srv://dart-bot-app:xhfbGnfII6WhJKEA@pickware.biz4mzw.mongodb.net/dart-stats';
        const prodConnection = await mongoose.createConnection(prodUri);
        await prodConnection.asPromise(); // Warte auf die Verbindung
        console.log('\nVerbunden mit Produktions-Datenbank (dart-stats)');

        // Hole alle Collections aus der Produktions-Datenbank
        const prodCollections = await prodConnection.db.listCollections().toArray();
        console.log('\nCollections in Produktions-Datenbank:');
        for (const collection of prodCollections) {
            console.log(`- ${collection.name}`);
            
            // Hole Schema-Informationen für jede Collection
            const docs = await prodConnection.db.collection(collection.name).find().limit(1).toArray();
            if (docs.length > 0) {
                console.log('  Schema-Beispiel:');
                console.log(JSON.stringify(docs[0], null, 2));
            }
        }

        await prodConnection.close();
    } catch (error) {
        console.error('Fehler:', error);
    }
}

compareSchemas(); 