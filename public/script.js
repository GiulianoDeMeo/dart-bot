// Spielerdaten
let players = [];
let games = [];
let stats = [];

// DOM Elemente
const submitButton = document.getElementById('submit-game');
const statsViewSelect = document.getElementById('stats-view-select');
const refreshButton = document.getElementById('refresh-stats');
const top10Container = document.getElementById('top10-container');
const playerStatsContainer = document.getElementById('player-stats-container');
const topPlayersContainer = document.getElementById('top-players-container');

// Globale Variablen für ausgewählte Spieler
let selectedWinner = null;
let selectedLoser = null;
let isSubmitting = false; // Globale Variable für die Sperre

// API URL - Nutze die Heroku-URL
const API_URL = 'https://dart-bot-stats-40bf895a4f48.herokuapp.com/api';

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
        console.log('Lade Spieler von:', `${API_URL}/players`);
        const response = await fetch(`${API_URL}/players`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        players = await response.json();
        console.log('Spieler geladen:', players);
    } catch (error) {
        console.error('Fehler beim Laden der Spieler:', error);
        alert('Fehler beim Laden der Spieler. Bitte versuchen Sie es später erneut.');
    }
}

// Lade Spiele
async function loadGames() {
    try {
        console.log('Lade Spiele von:', `${API_URL}/games`);
        const response = await fetch(`${API_URL}/games`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        games = await response.json();
        console.log('Spiele geladen:', games);
    } catch (error) {
        console.error('Fehler beim Laden der Spiele:', error);
        alert('Fehler beim Laden der Spiele. Bitte versuchen Sie es später erneut.');
    }
}

// Lade Statistiken
async function loadStats() {
    try {
        console.log('Lade Statistiken von:', `${API_URL}/stats`);
        const response = await fetch(`${API_URL}/stats`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        stats = await response.json();
        console.log('Statistiken geladen:', stats);
    } catch (error) {
        console.error('Fehler beim Laden der Statistiken:', error);
        alert('Fehler beim Laden der Statistiken. Bitte versuchen Sie es später erneut.');
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
    const topPlayersList = document.getElementById('top-players-list');
    topPlayersList.innerHTML = '';

    // Sortiere die Spieler basierend auf den Statistiken
    const playersWithStats = players
        .map(player => {
            const playerStats = stats.find(s => s.name === player.name);
            return playerStats || null;
        })
        .filter(player => player !== null && player.games > 0)
        .sort((a, b) => {
            // Zuerst nach Siegen
            if (b.wins !== a.wins) {
                return b.wins - a.wins;
            }
            // Dann nach Anzahl der Spiele (weniger ist besser)
            if (a.games !== b.games) {
                return a.games - b.games;
            }
            // Zuletzt nach Siegesquote
            return parseFloat(b.winRate) - parseFloat(a.winRate);
        });

    // Zeige nur die Top 10 Spieler an
    const top10Players = playersWithStats.slice(0, 10);
    
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
                ${top10Players.map((player, index) => `
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
        player.name.toLowerCase().includes(searchText) ||
        player.nickname.toLowerCase().includes(searchText)
    );

    if (matches.length > 0 && searchText.length > 0) {
        dropdown.innerHTML = matches
            .map(player => `
                <div class="search-item" data-name="${player.name}">
                    <span class="player-name">${player.name}</span>
                    <span class="player-nickname">${player.nickname}</span>
                </div>
            `).join('');
        
        dropdown.style.display = 'block';

        // Event Listener für Vorschläge
        dropdown.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', () => {
                const playerName = item.dataset.name;
                const player = players.find(p => p.name === playerName);
                searchInput.value = player.name;
                dropdown.style.display = 'none';
                onSelect(player);
            });
        });
    } else {
        dropdown.style.display = 'none';
    }
}

// Spielerauswahl-Funktionalität
function setupPlayerSelection() {
    const winnerSearch = document.getElementById('winner-search');
    const loserSearch = document.getElementById('loser-search');
    const winnerDropdown = document.getElementById('winner-dropdown');
    const loserDropdown = document.getElementById('loser-dropdown');

    // Event Listener für Sucheingaben
    winnerSearch.addEventListener('input', () => {
        showSuggestions(winnerSearch, winnerDropdown, players, (player) => {
            selectedWinner = player;
            winnerSearch.value = player.name;
        });
    });

    loserSearch.addEventListener('input', () => {
        showSuggestions(loserSearch, loserDropdown, players, (player) => {
            selectedLoser = player;
            loserSearch.value = player.name;
        });
    });

    // Event Listener für Klicks außerhalb der Dropdowns
    document.addEventListener('click', (e) => {
        if (!winnerSearch.contains(e.target) && !winnerDropdown.contains(e.target)) {
            winnerDropdown.style.display = 'none';
        }
        if (!loserSearch.contains(e.target) && !loserDropdown.contains(e.target)) {
            loserDropdown.style.display = 'none';
        }
    });

    // Submit Button Event Listener
    submitButton.addEventListener('click', async () => {
        // Prüfe ob bereits ein Spiel gesendet wird
        if (isSubmitting) {
            console.log('Ein Spiel wird bereits gesendet...');
            return;
        }

        if (!selectedWinner || !selectedLoser) {
            alert('Bitte wähle Gewinner und Verlierer aus.');
            return;
        }

        if (selectedWinner.name === selectedLoser.name) {
            alert('Gewinner und Verlierer müssen unterschiedlich sein.');
            return;
        }

        // Aktiviere die Sperre und deaktiviere den Button
        isSubmitting = true;
        submitButton.disabled = true;
        submitButton.style.opacity = '0.5';
        submitButton.textContent = 'Wird gespeichert...';

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
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Speichern des Spiels');
            }

            // Setze die Eingabefelder zurück
            winnerSearch.value = '';
            loserSearch.value = '';
            selectedWinner = null;
            selectedLoser = null;

            // Lade die Daten neu
            await loadGames();
            await loadStats();
            updateTopPlayers();

            alert('Spiel erfolgreich gespeichert!');
        } catch (error) {
            console.error('Fehler:', error);
            alert('Fehler beim Speichern des Spiels');
        } finally {
            // Setze den Button zurück und deaktiviere die Sperre
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.textContent = 'Spiel speichern';
            isSubmitting = false;
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

// Event Listener für den Aktualisieren-Button
refreshButton.addEventListener('click', async () => {
    try {
        // Zeige Ladeanimation
        refreshButton.style.animation = 'spin 1s linear';
        
        // Lade Daten neu
        await loadInitialData();
        
        // Aktualisiere die Anzeige basierend auf der aktuellen Auswahl
        if (statsViewSelect.value === 'top10') {
            updateTopPlayers();
        } else if (statsViewSelect.value === 'player') {
            const playerSelect = document.getElementById('player-select');
            if (playerSelect) {
                showPlayerStats(playerSelect.value);
            }
        }
        
        // Entferne Ladeanimation
        refreshButton.style.animation = '';
    } catch (error) {
        console.error('Fehler beim Aktualisieren:', error);
        alert('Fehler beim Aktualisieren der Daten. Bitte versuchen Sie es später erneut.');
        refreshButton.style.animation = '';
    }
});

// Lade die initialen Daten beim Start
loadInitialData();

// Zeige standardmäßig die Top 10 an
statsViewSelect.value = 'top10';
statsViewSelect.dispatchEvent(new Event('change')); 