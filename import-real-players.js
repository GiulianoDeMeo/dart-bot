const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Verbindung
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dart-stats', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Spieler Schema
const playerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    nickname: { type: String, required: true }
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

const Player = mongoose.model('Player', playerSchema);
const Game = mongoose.model('Game', gameSchema);

// Funktion zum Generieren eines Gen-Z Spitznamens
function generateNickname(fullName) {
    // Entferne führende/nachfolgende Leerzeichen
    fullName = fullName.trim();
    
    // Spezielle Spitznamen für bestimmte Namen
    const specialNicknames = {
        'Christine the Goat': 'GOAT',
        'Alexandra Schäfer': 'Xandra.exe',
        'Michael Haas': 'Mikey.dev',
        'Stefan Heppenheimer': 'Stefanator',
        'Tristan Eckart': 'Trizzy',
        'Tristan Tisch': 'T-Money',
        'Jan-Philipp Rogge': 'JP.pog',
        'Sebastian Volker Nieraad': 'Seb.exe',
        'Maurice Calmano': 'Mau_100',
        'Luca kleine Hillmann': 'Lil_Hill',
        'Hannibal Wissing': 'Han_Solo',
        'Johannes Rübsam': 'Jo.sys',
        'Maximilian Oster': 'MaxiMood',
        'Pascal Niklas Paul': 'Triple_P',
        'Paul von Allwörden': 'King_Paul',
        'Giuliano De Meo': 'G.Force',
        'Cedric Engler': 'C.Error',
        'Erik Forss': 'E.404',
        'Jannik Schaper': 'Shapey',
        'Jonathan Schad': 'Johnny.js',
        'Julia Matz': 'Jules_uwu',
        'Kai Adrian Münzberg': 'Kai.overflow',
        'Laurin Lehr': 'Teach_L',
        'Marco Weßel': 'Marc.io',
        'Martina Mrkonjic': 'Tina.dev',
        'Mirka Henckes': 'Miri_UwU',
        'Norman Schirg': 'Norm.al',
        'Pascal Buhr': 'Pas.cal',
        'Till Grimminger': 'Tilly',
        'Yannik Ehrhardt': 'Yanny_xD',
        'Anika Schroth': 'Ani.ko',
        'Ann-Kristin Martin': 'AK-47',
        'Antonio Kupresak': 'Tony.pro',
        'Benedikt Brunner': 'Benny.bash',
        'Christian Juner': 'Chris.ping',
        'Clemens Brockschmidt': 'Clem.sh',
        'Dennis Holzamer': 'Dennis.root',
        'Elias Espositos': 'Eli.go',
        'Fabian Berres': 'Fabi.py',
        'Felix Meiser': 'Felix.sh',
        'Florian Faatz': 'Flo.zip',
        'Hannes Wernery': 'Han.solo',
        'Ingo Walther': 'Ingo.io',
        'Jan Grzegorz Rolka': 'JGR.exe',
        'Jan Petto': 'JP.null',
        'Jan Scholtes': 'Jan.query',
        'Jannik Jochem': 'JJ.loop',
        'Jessica Pleier': 'Jess.css',
        'John Sorial': 'John.json',
        'Julia Schütz': 'Juli.byte',
        'Julian Drauz': 'Jules.dart',
        'Lara Fadjasch': 'Lara.sql',
        'Lars Emig': 'Lars.yaml',
        'Lea Finke': 'Lea.link',
        'Lena El-Khouri': 'Lena.log',
        'Liane Becker': 'Li.shell',
        'Madlen Springer': 'Mad.len',
        'Manuel Kress': 'Manu.kernel',
        'Mario Nowak': 'Mario.net',
        'Mark Viertel': 'Mark.down',
        'Marvin Schneemann': 'Marv.in',
        'Mia Porteous': 'Mia.cloud',
        'Miriam Faßbender': 'Miri.ram',
        'Nicolas Zander': 'Nico.zip',
        'Philipp Seemann': 'Phil.hub',
        'Rebecca Falkenburg': 'Becca.bug',
        'Samuel Vogel': 'Sam.sudo',
        'Simge Karaduman': 'Sim.git',
        'Sven Münnich': 'Sven.stack',
        'Tim Theisinger': 'Tim.debug',
        'Youness Marzouki': 'You.next'
    };

    // Wenn ein spezieller Spitzname existiert, verwende diesen
    if (specialNicknames[fullName]) {
        return specialNicknames[fullName];
    }
    
    // Für alle anderen Namen: Generiere einen zufälligen Tech/Gaming-Spitznamen
    const firstName = fullName.split(' ')[0];
    const techSuffixes = ['.js', '.py', '.rb', '.go', '.rs', '.ts', '.cpp'];
    const gamingSuffixes = ['_pro', '_gg', '_pwn', '_win', '_ace', '_mvp', '_op'];
    const memeSuffixes = ['_uwu', '_owo', '_lol', '_kek', '_pog', '_sus', '_sheesh'];
    
    const suffixTypes = [techSuffixes, gamingSuffixes, memeSuffixes];
    const selectedType = suffixTypes[Math.floor(Math.random() * suffixTypes.length)];
    const randomSuffix = selectedType[Math.floor(Math.random() * selectedType.length)];
    
    return firstName + randomSuffix;
}

async function importPlayers() {
    try {
        // Lösche alle existierenden Spieler
        await Player.deleteMany({});
        console.log('Bestehende Spieler wurden gelöscht');

        // Lösche alle existierenden Spiele
        await Game.deleteMany({});
        console.log('Bestehende Spiele wurden gelöscht');

        // Lese die CSV-Datei
        const fileContent = fs.readFileSync('Pickware Dart Teilnehmer.csv', 'utf-8');
        const lines = fileContent.split('\n');

        // Verarbeite jede Zeile
        const players = [];
        for (let line of lines) {
            // Entferne Semikolons und Leerzeichen
            const name = line.split(';')[0].trim();
            
            // Überspringe leere Zeilen und Daniel Huth
            if (!name || name === 'Daniel Huth') continue;
            
            const nickname = generateNickname(name);
            players.push({
                name: name,
                nickname: nickname
            });
        }

        // Speichere die Spieler in der Datenbank
        await Player.insertMany(players);
        
        console.log(`${players.length} Spieler wurden erfolgreich importiert:`);
        players.forEach(player => {
            console.log(`- ${player.name} (${player.nickname})`);
        });

        mongoose.connection.close();
    } catch (error) {
        console.error('Fehler beim Importieren:', error);
        mongoose.connection.close();
    }
}

importPlayers(); 