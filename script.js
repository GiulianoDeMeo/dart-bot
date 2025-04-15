// Spielerdaten
let players = [];
let games = [];
let db;

// DOM Elemente
const winnerSelect = document.getElementById('winner');
const loserSelect = document.getElementById('loser');
const submitButton = document.getElementById('submit-game');
const statsContainer = document.getElementById('stats-container');

// IndexedDB initialisieren
const initDB = () => {
    const request = indexedDB.open('DartStatsDB', 1);

    request.onerror = (event) => {
        console.error('Datenbankfehler:', event.target.error);
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store für Spiele
        if (!db.objectStoreNames.contains('games')) {
            const gamesStore = db.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
            gamesStore.createIndex('date', 'date', { unique: false });
        }
        
        // Store für Spieler
        if (!db.objectStoreNames.contains('players')) {
            db.createObjectStore('players', { keyPath: 'name' });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        loadInitialData();
    };
};

// Lade initiale Daten
const loadInitialData = async () => {
    await loadPlayers();
    await loadGames();
    updateStats();
};

// Lade gespeicherte Spiele
const loadGames = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['games'], 'readonly');
        const store = transaction.objectStore('games');
        const request = store.getAll();

        request.onsuccess = () => {
            games = request.result;
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

// Speichere ein neues Spiel
const saveGame = (game) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['games'], 'readwrite');
        const store = transaction.objectStore('games');
        const request = store.add(game);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

// Lade die Spielerdaten beim Start
async function loadPlayers() {
    try {
        const response = await fetch('players.json');
        players = await response.json();
        
        // Speichere Spieler in der Datenbank
        const transaction = db.transaction(['players'], 'readwrite');
        const store = transaction.objectStore('players');
        
        players.forEach(player => {
            store.put(player);
        });
        
        populatePlayerSelects();
    } catch (error) {
        console.error('Fehler beim Laden der Spielerdaten:', error);
    }
}

// Sortiere Spieler nach Anzahl der Spiele
function getSortedPlayers() {
    const playerStats = players.map(player => {
        const stats = calculatePlayerStats(player.name);
        return {
            ...player,
            games: stats.games
        };
    });
    
    return playerStats.sort((a, b) => b.games - a.games);
}

// Fülle die Select-Elemente mit Spielern
function populatePlayerSelects() {
    const sortedPlayers = getSortedPlayers();
    const options = sortedPlayers.map(player => 
        `<option value="${player.name}">${player.name} (${player.nickname})</option>`
    ).join('');
    
    winnerSelect.innerHTML = '<option value="">Spieler auswählen...</option>' + options;
    loserSelect.innerHTML = '<option value="">Spieler auswählen...</option>' + options;
}

// Berechne Statistiken für einen Spieler
function calculatePlayerStats(playerName) {
    const playerGames = games.filter(game => 
        game.winner === playerName || game.loser === playerName
    );
    
    const wins = playerGames.filter(game => game.winner === playerName).length;
    const losses = playerGames.filter(game => game.loser === playerName).length;
    const totalGames = wins + losses;
    const winRate = totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : 0;
    
    return {
        name: playerName,
        games: totalGames,
        wins,
        losses,
        winRate
    };
}

// Aktualisiere die Statistik-Anzeige
function updateStats() {
    const sortedPlayers = getSortedPlayers();
    const stats = sortedPlayers.map(player => {
        const playerStats = calculatePlayerStats(player.name);
        return {
            ...player,
            ...playerStats
        };
    });
    
    statsContainer.innerHTML = stats.map(player => `
        <div class="player-stats">
            <h3>${player.name} (${player.nickname})</h3>
            <p>Spiele: ${player.games}</p>
            <p>Siege: ${player.wins}</p>
            <p>Niederlagen: ${player.losses}</p>
            <p>Siegesquote: ${player.winRate}%</p>
        </div>
    `).join('');
}

// Event Listener für das Formular
submitButton.addEventListener('click', async () => {
    const winner = winnerSelect.value;
    const loser = loserSelect.value;
    
    if (!winner || !loser) {
        alert('Bitte wähle beide Spieler aus!');
        return;
    }
    
    if (winner === loser) {
        alert('Gewinner und Verlierer müssen unterschiedlich sein!');
        return;
    }
    
    // Erstelle neues Spiel
    const newGame = { 
        winner, 
        loser, 
        date: new Date().toISOString() 
    };
    
    try {
        // Speichere das Spiel in der Datenbank
        await saveGame(newGame);
        
        // Füge das Spiel zur lokalen Liste hinzu
        games.push(newGame);
        
        // Aktualisiere die Statistiken und die Dropdown-Menüs
        updateStats();
        populatePlayerSelects();
        
        // Setze die Auswahl zurück
        winnerSelect.value = '';
        loserSelect.value = '';
    } catch (error) {
        console.error('Fehler beim Speichern des Spiels:', error);
        alert('Fehler beim Speichern des Spiels. Bitte versuche es noch einmal.');
    }
});

// Initialisiere die Datenbank beim Start
initDB(); 