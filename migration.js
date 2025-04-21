const mongoose = require('mongoose');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PROD_URI = 'mongodb+srv://dart-bot-app:xhfbGnfII6WhJKEA@pickware.biz4mzw.mongodb.net/dart-stats';

async function createBackup() {
    console.log('Erstelle Backup...');
    try {
        const { stdout } = await execAsync(`mongodump --uri="${PROD_URI}"`);
        console.log('Backup erfolgreich erstellt:', stdout);
        return true;
    } catch (error) {
        console.error('Fehler beim Backup:', error);
        return false;
    }
}

async function migratePlayers() {
    console.log('Starte Player-Migration...');
    const conn = await mongoose.createConnection(PROD_URI);
    await conn.asPromise();

    try {
        // Füge neue Felder zu allen existierenden Spielern hinzu
        const result = await conn.db.collection('players').updateMany(
            {}, 
            { 
                $set: { 
                    eloRating: 1000,
                    gamesPlayed: 0 
                }
            }
        );

        console.log(`${result.modifiedCount} Spieler aktualisiert`);
        return true;
    } catch (error) {
        console.error('Fehler bei der Migration:', error);
        return false;
    } finally {
        await conn.close();
    }
}

async function validateMigration() {
    console.log('Validiere Migration...');
    const conn = await mongoose.createConnection(PROD_URI);
    await conn.asPromise();

    try {
        // Prüfe, ob alle Spieler die neuen Felder haben
        const players = await conn.db.collection('players').find({
            $or: [
                { eloRating: { $exists: false } },
                { gamesPlayed: { $exists: false } }
            ]
        }).toArray();

        if (players.length > 0) {
            console.error('Fehler: Es gibt noch Spieler ohne die neuen Felder:');
            console.log(players);
            return false;
        }

        console.log('Validierung erfolgreich!');
        return true;
    } catch (error) {
        console.error('Fehler bei der Validierung:', error);
        return false;
    } finally {
        await conn.close();
    }
}

async function rollback() {
    console.log('Starte Rollback...');
    const conn = await mongoose.createConnection(PROD_URI);
    await conn.asPromise();

    try {
        // Entferne die neuen Felder von allen Spielern
        const result = await conn.db.collection('players').updateMany(
            {}, 
            { 
                $unset: { 
                    eloRating: "",
                    gamesPlayed: "" 
                }
            }
        );

        console.log(`${result.modifiedCount} Spieler zurückgesetzt`);
        return true;
    } catch (error) {
        console.error('Fehler beim Rollback:', error);
        return false;
    } finally {
        await conn.close();
    }
}

async function runMigration() {
    console.log('Starte Migrationsprozess...');

    // 1. Backup erstellen
    const backupSuccess = await createBackup();
    if (!backupSuccess) {
        console.error('Migration abgebrochen: Backup fehlgeschlagen');
        return;
    }

    // 2. Migration durchführen
    const migrationSuccess = await migratePlayers();
    if (!migrationSuccess) {
        console.error('Migration fehlgeschlagen. Starte Rollback...');
        await rollback();
        return;
    }

    // 3. Validierung
    const validationSuccess = await validateMigration();
    if (!validationSuccess) {
        console.error('Validierung fehlgeschlagen. Starte Rollback...');
        await rollback();
        return;
    }

    console.log('Migration erfolgreich abgeschlossen!');
}

// Starte die Migration
runMigration().catch(console.error); 