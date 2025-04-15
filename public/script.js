// Spielerdaten
let players = [];
let games = [];
let stats = [];

// DOM Elemente
const submitButton = document.getElementById('submit-game');
const statsViewSelect = document.getElementById('stats-view-select');
const top10Container = document.getElementById('top10-container');
const playerStatsContainer = document.getElementById('player-stats-container');
const topPlayersContainer = document.getElementById('top-players-container');

// API URL - Nutze die aktuelle Host-Adresse
const API_URL = `${window.location.protocol}//${window.location.hostname}:3000/api`;

// Lade initiale Daten
async function loadInitialData() {
    try {
        await loadPlayers();
        await loadGames();
        await loadStats();
        updateTopPlayers();
        setupPlayerSelection();
        setupPlayerStatsSelection();
    } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
    }
}

// Lade Spieler
async function loadPlayers() {
    try {
        const response = await fetch(`${API_URL}/players`);
        players = await response.json();
    } catch (error) {
        console.error('Fehler beim Laden der Spieler:', error);
    }
}

// Lade Spiele
async function loadGames() {
    try {
        const response = await fetch(`${API_URL}/games`);
        games = await response.json();
    } catch (error) {
        console.error('Fehler beim Laden der Spiele:', error);
    }
}

// Lade Statistiken
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        stats = await response.json();
    } catch (error) {
        console.error('Fehler beim Laden der Statistiken:', error);
    }
}

// Sortiere Spieler nach Anzahl der Spiele
function getSortedPlayers() {
    return players.sort((a, b) => {
        const statsA = stats.find(s => s.name === a.name) || { games: 0 };
        const statsB = stats.find(s => s.name === b.name) || { games: 0 };
        return statsB.games - statsA.games;
    });
}

// Fülle die Select-Elemente mit Spielern
async function populatePlayerSelects() {
    try {
        const sortedPlayers = getSortedPlayers();
        const options = sortedPlayers.map(player => 
            `<option value="${player.name}">${player.name}</option>`
        ).join('');
        
        // Fülle das Spieler-Select für die Stats
        const playerSelect = document.getElementById('player-select');
        if (playerSelect) {
            playerSelect.innerHTML = '<option value="">Spieler auswählen...</option>' + options;
        }
    } catch (error) {
        console.error('Fehler beim Füllen der Spielerauswahl:', error);
    }
}

// Aktualisiere die Top 10 Spieler
function updateTopPlayers() {
    // Sortiere Spieler nach Siegesquote
    const sortedStats = [...stats].sort((a, b) => {
        // Zuerst nach Siegesquote
        const winRateDiff = parseFloat(b.winRate) - parseFloat(a.winRate);
        if (winRateDiff !== 0) return winRateDiff;
        
        // Bei gleicher Siegesquote nach Anzahl der Spiele
        return b.games - a.games;
    });
    
    // Nehme die Top 10
    const top10 = sortedStats.slice(0, 10);
    
    topPlayersContainer.innerHTML = `
        <table class="top-players-table">
            <thead>
                <tr>
                    <th>Rang</th>
                    <th>Spieler</th>
                    <th>Siegesquote</th>
                    <th>Spiele</th>
                </tr>
            </thead>
            <tbody>
                ${top10.map((player, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${player.name}</td>
                        <td>${player.winRate}%</td>
                        <td>${player.games} (${player.wins}S ${player.losses}N)</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Zeige Stats für einen Spieler an
function showPlayerStats(playerName) {
    if (!playerName) {
        document.getElementById('player-stats-details').innerHTML = '';
        return;
    }

    const playerStats = stats.find(s => s.name === playerName);
    if (!playerStats) return;

    let headToHeadHtml = '';
    const headToHeadStats = Object.entries(playerStats.headToHead);
    
    if (headToHeadStats.length > 0) {
        headToHeadHtml = `
            <h3>Head-to-Head Statistiken</h3>
            <table class="stats-table">
                <tr>
                    <th>Gegner</th>
                    <th>Siege</th>
                    <th>Niederlagen</th>
                    <th>Gewinnrate</th>
                </tr>
                ${headToHeadStats
                    .sort((a, b) => b[1].winRate - a[1].winRate)
                    .map(([opponent, stats]) => `
                        <tr>
                            <td>${opponent}</td>
                            <td>${stats.wins}</td>
                            <td>${stats.losses}</td>
                            <td>${stats.winRate}%</td>
                        </tr>
                    `).join('')}
            </table>
        `;
    } else {
        headToHeadHtml = '<p>Noch keine Spiele gegen andere Spieler.</p>';
    }

    document.getElementById('player-stats-details').innerHTML = `
        <h2>${playerStats.name}</h2>
        <div class="stats-section">
            <h3>Allgemeine Statistiken</h3>
            <div class="stats-cards">
                <div class="stat-card">
                    <div class="stat-value">${playerStats.games}</div>
                    <div class="stat-label">Spiele</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${playerStats.wins}</div>
                    <div class="stat-label">Siege</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${playerStats.losses}</div>
                    <div class="stat-label">Niederlagen</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${playerStats.winRate}%</div>
                    <div class="stat-label">Gewinnrate</div>
                </div>
            </div>
        </div>
        <div class="stats-section">
            ${headToHeadHtml}
        </div>
    `;
}

// Funktion zum Anzeigen der Vorschläge
function showSuggestions(searchInput, dropdown, players, onSelect) {
    const searchText = searchInput.value.toLowerCase();
    const matches = players.filter(player => 
        player.name.toLowerCase().includes(searchText)
    );

    if (matches.length > 0 && searchText.length > 0) {
        dropdown.innerHTML = matches
            .map(player => `
                <div class="search-item" data-name="${player.name}">
                    <span class="player-name">${player.name}</span>
                </div>
            `).join('');
        
        dropdown.classList.add('active');

        // Event Listener für Vorschläge
        dropdown.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', () => {
                const playerName = item.dataset.name;
                const player = players.find(p => p.name === playerName);
                searchInput.value = player.name;
                dropdown.classList.remove('active');
                onSelect(player);
            });
        });
    } else {
        dropdown.classList.remove('active');
    }
}

// Spielerauswahl-Funktionalität
function setupPlayerSelection() {
    const winnerSearch = document.getElementById('winner-search');
    const loserSearch = document.getElementById('loser-search');
    const winnerDropdown = document.getElementById('winner-dropdown');
    const loserDropdown = document.getElementById('loser-dropdown');
    
    let selectedWinner = null;
    let selectedLoser = null;

    // Event Listener für Sucheingaben
    winnerSearch.addEventListener('input', () => {
        showSuggestions(winnerSearch, winnerDropdown, players, (player) => {
            selectedWinner = player;
            winnerSearch.classList.add('has-selection');
        });
    });

    loserSearch.addEventListener('input', () => {
        showSuggestions(loserSearch, loserDropdown, players, (player) => {
            selectedLoser = player;
            loserSearch.classList.add('has-selection');
        });
    });

    // Schließe Dropdowns beim Klick außerhalb
    document.addEventListener('click', (e) => {
        if (!winnerSearch.contains(e.target) && !winnerDropdown.contains(e.target)) {
            winnerDropdown.classList.remove('active');
        }
        if (!loserSearch.contains(e.target) && !loserDropdown.contains(e.target)) {
            loserDropdown.classList.remove('active');
        }
    });

    // Event Listener für das Formular
    submitButton.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (!selectedWinner || !selectedLoser) {
            alert('Bitte wähle beide Spieler aus.');
            return;
        }
        
        if (selectedWinner.name === selectedLoser.name) {
            alert('Bitte wähle zwei verschiedene Spieler aus.');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.textContent = 'Speichere...';
        
        try {
            const response = await fetch(`${API_URL}/games`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    winner: selectedWinner.name,
                    loser: selectedLoser.name,
                    format: {
                        type: '501',
                        legs: 3
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Netzwerk-Antwort war nicht ok');
            }

            alert('Spiel wurde erfolgreich gespeichert!');
            
            // Setze Formular zurück
            winnerSearch.value = '';
            loserSearch.value = '';
            winnerSearch.classList.remove('has-selection');
            loserSearch.classList.remove('has-selection');
            selectedWinner = null;
            selectedLoser = null;
            
            // Aktualisiere die Statistiken
            await loadStats();
            updateTopPlayers();
            
        } catch (error) {
            console.error('Fehler beim Speichern des Spiels:', error);
            alert('Fehler beim Speichern des Spiels. Bitte versuche es erneut.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Spiel speichern';
        }
    });
}

// Spielerauswahl-Funktionalität für Statistiken
function setupPlayerStatsSelection() {
    const playerStatsSearch = document.getElementById('player-stats-search');
    const playerStatsDropdown = document.getElementById('player-stats-dropdown');
    
    let selectedPlayer = null;

    // Event Listener für Sucheingaben
    playerStatsSearch.addEventListener('input', () => {
        showSuggestions(playerStatsSearch, playerStatsDropdown, players, (player) => {
            selectedPlayer = player;
            playerStatsSearch.classList.add('has-selection');
            showPlayerStats(player.name);
        });
    });

    // Schließe Dropdown beim Klick außerhalb
    document.addEventListener('click', (e) => {
        if (!playerStatsSearch.contains(e.target) && !playerStatsDropdown.contains(e.target)) {
            playerStatsDropdown.classList.remove('active');
        }
    });
}

// Event Listener für Stats View Selector
statsViewSelect.addEventListener('change', () => {
    // Entferne active Klasse von allen Containern
    document.querySelectorAll('.stats-content').forEach(container => {
        container.style.display = 'none';
        container.classList.remove('active');
    });

    // Zeige den ausgewählten Container
    const selectedValue = statsViewSelect.value;
    if (selectedValue === 'top10') {
        top10Container.style.display = 'block';
        setTimeout(() => top10Container.classList.add('active'), 10);
        updateTopPlayers();
    } else if (selectedValue === 'player') {
        playerStatsContainer.style.display = 'block';
        setTimeout(() => playerStatsContainer.classList.add('active'), 10);
        // Setze den Fokus auf das Suchfeld
        const playerStatsSearch = document.getElementById('player-stats-search');
        if (playerStatsSearch) {
            playerStatsSearch.focus();
        }
    }
});

// Lade die initialen Daten beim Start
loadInitialData();

// Zeige standardmäßig die Top 10 an
statsViewSelect.value = 'top10';
statsViewSelect.dispatchEvent(new Event('change')); 