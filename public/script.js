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

// Überprüfe, ob alle erforderlichen DOM-Elemente vorhanden sind
if (!submitButton || !statsViewSelect || !refreshButton || !top10Container || !playerStatsContainer) {
    console.error('Erforderliche DOM-Elemente nicht gefunden:', {
        submitButton: !!submitButton,
        statsViewSelect: !!statsViewSelect,
        refreshButton: !!refreshButton,
        top10Container: !!top10Container,
        playerStatsContainer: !!playerStatsContainer
    });
}

// Globale Variablen für ausgewählte Spieler
let selectedWinner = null;
let selectedLoser = null;
let isSubmitting = false; // Globale Variable für die Sperre

// API URL - Nutze die lokale URL für Entwicklung
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '192.168.2.107'
    ? `http://${window.location.hostname}:3000/api`
    : 'https://dart-bot-stats-40bf895a4f48.herokuapp.com/api';

// Lade initiale Daten
async function loadInitialData() {
    try {
        await loadPlayers();
        await loadGames();
        await loadStats();
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
        
        // Überprüfe, ob die Statistiken gültig sind
        if (!Array.isArray(stats)) {
            console.error('Ungültiges Statistik-Format:', stats);
            stats = [];
        }
    } catch (error) {
        console.error('Fehler beim Laden der Statistiken:', error);
        alert('Fehler beim Laden der Statistiken. Bitte versuchen Sie es später erneut.');
    }
}

// Sortiere Spieler nach Anzahl der Spiele
function getSortedPlayers() {
    // Verwende direkt die vom Backend geladenen Statistiken
    return [...stats].sort((a, b) => {
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
    const tableBody = document.getElementById('top-players-table-body');
    tableBody.innerHTML = '';

    // Berechne die Elo-Verbesserung für die aktuelle Arbeitswoche (Montag-Freitag)
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    
    // Setze auf Montag 00:00:00
    startOfWeek.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Setze auf Sonntag 23:59:59
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Erstelle ein Mapping von Spielernamen zu ihren Elo-Werten am Wochenanfang
    const startOfWeekElo = {};
    players.forEach(player => {
        // Finde den letzten Elo-Wert vor dem Wochenstart
        const lastEloBeforeWeek = player.eloHistory
            .filter(entry => new Date(entry.date) < startOfWeek)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        
        startOfWeekElo[player.name] = lastEloBeforeWeek ? lastEloBeforeWeek.elo : 1000;
    });

    // Filtere Spiele für die aktuelle Arbeitswoche
    const weeklyGames = games.filter(game => {
        const gameDate = new Date(game.date);
        return gameDate >= startOfWeek && gameDate <= endOfWeek;
    });

    // Berechne die Elo-Verbesserung nur für Spieler, die in dieser Woche gespielt haben
    const weeklyEloImprovements = {};
    const playersInWeeklyGames = new Set();
    
    // Sammle alle Spieler, die diese Woche gespielt haben
    weeklyGames.forEach(game => {
        playersInWeeklyGames.add(game.winner);
        playersInWeeklyGames.add(game.loser);
    });
    
    // Berechne die Elo-Verbesserung für jeden Spieler
    playersInWeeklyGames.forEach(playerName => {
        const player = players.find(p => p.name === playerName);
        if (!player) return;
        
        // Finde den aktuellen Elo-Wert
        const currentElo = player.eloRating;
        
        // Finde den Start-Elo dieser Woche
        const startElo = startOfWeekElo[playerName] || 1000;
        
        // Berechne die Verbesserung
        weeklyEloImprovements[playerName] = currentElo - startElo;
    });

    // Debug-Logs
    console.log('=== Debug: Spieler der Woche ===');
    console.log('Wochenanfang:', startOfWeek.toLocaleString());
    console.log('Wochenende:', endOfWeek.toLocaleString());
    console.log('Anzahl Spiele in dieser Woche:', weeklyGames.length);
    console.log('Elo-Verbesserungen:', weeklyEloImprovements);

    // Finde den Spieler mit der größten Elo-Verbesserung
    let bestWeeklyPlayer = null;
    let maxImprovement = -Infinity;
    Object.entries(weeklyEloImprovements).forEach(([player, improvement]) => {
        if (improvement > maxImprovement) {
            maxImprovement = improvement;
            bestWeeklyPlayer = player;
        }
    });

    console.log('Bester Spieler der Woche:', bestWeeklyPlayer, 'mit Verbesserung:', maxImprovement);

    // Filtere Spieler mit mindestens einem Spiel und sortiere nach Elo-Rating
    const activePlayers = players
        .filter(player => player.gamesPlayed > 0)
        .sort((a, b) => {
            // Zuerst nach Elo-Rating
            if (b.eloRating !== a.eloRating) {
                return b.eloRating - a.eloRating;
            }
            // Bei gleichem Elo nach Siegesquote
            return parseFloat(b.winRate) - parseFloat(a.winRate);
        })
        .slice(0, 10);
    
    activePlayers.forEach((player, index) => {
        const row = document.createElement('tr');
        let playerName = player.name;

        // Füge Emojis für die Top 3 hinzu
        if (index === 0) playerName += ' 🏆';
        else if (index === 1) playerName += ' 🥈';
        else if (index === 2) playerName += ' 🥉';
        
        // Füge die Krone für den besten Spieler der Woche hinzu
        if (player.name === bestWeeklyPlayer) {
            playerName += ' 👑';
        }
        
        row.innerHTML = `
            <td>#${index + 1}</td>
            <td><a href="#" class="player-link" data-player="${player.name}">${playerName}</a></td>
            <td class="elo-rating">${player.eloRating}</td>
            <td>${player.gamesPlayed}</td>
            <td>${player.wins}</td>
            <td>${player.losses}</td>
            <td>${player.winRate}%</td>
        `;
        tableBody.appendChild(row);
    });

    // Füge Event-Listener für die Spielerlinks hinzu
    tableBody.querySelectorAll('.player-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const playerName = link.dataset.player;
            
            // Wechsle zur Einzelspieler-Ansicht
            statsViewSelect.value = 'player';
            top10Container.style.display = 'none';
            playerStatsContainer.style.display = 'block';
            playerStatsContainer.classList.add('active');
            
            // Zeige die Statistiken des ausgewählten Spielers
            showPlayerStats(playerName);
        });
    });

    // Füge die Legende hinzu
    const legendContainer = document.createElement('div');
    legendContainer.style.textAlign = 'center';
    legendContainer.style.marginTop = '20px';
    legendContainer.style.padding = '10px';
    legendContainer.style.backgroundColor = '#f5f5f5';
    legendContainer.style.borderRadius = '5px';
    legendContainer.innerHTML = `
        <p style="margin: 0; font-size: 14px; color: #666;">
            👑 Spieler der Woche
        </p>
    `;
    
    // Entferne die alte Legende, falls vorhanden
    const oldLegend = document.getElementById('top-players-legend');
    if (oldLegend) {
        oldLegend.remove();
    }
    
    // Füge die neue Legende hinzu
    legendContainer.id = 'top-players-legend';
    tableBody.parentElement.parentElement.appendChild(legendContainer);
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
                    <div class="stat-value">#${playerStats.rank}</div>
                    <div class="stat-label">Rang</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${playerStats.eloRating}</div>
                    <div class="stat-label">Elo-Wertung</div>
                </div>
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

// Hilfsfunktion für die Spielersuche
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
        
        dropdown.style.display = 'block';

        // Event Listener für Vorschläge
        dropdown.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', () => {
                const playerName = item.dataset.name;
                const player = players.find(p => p.name === playerName);
                if (player) {
                    onSelect(player);
                    dropdown.style.display = 'none';
                }
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
        showSuggestions(winnerSearch, winnerDropdown, stats, (player) => {
            selectedWinner = player;
            winnerSearch.value = player.name;
        });
    });

    loserSearch.addEventListener('input', () => {
        showSuggestions(loserSearch, loserDropdown, stats, (player) => {
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

            // Lade alle Daten neu und aktualisiere die Anzeige
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
    
    if (!playerStatsSearch || !playerStatsDropdown) {
        console.error('Spielersuche-Elemente nicht gefunden');
        return;
    }

    // Event Listener für Sucheingaben
    playerStatsSearch.addEventListener('input', () => {
        const searchText = playerStatsSearch.value.toLowerCase();
        const matches = stats.filter(player => 
            player.name.toLowerCase().includes(searchText)
        );

        if (matches.length > 0 && searchText.length > 0) {
            playerStatsDropdown.innerHTML = matches
                .map(player => `
                    <div class="search-item" data-name="${player.name}">
                        <span class="player-name">${player.name}</span>
                    </div>
                `).join('');
            
            playerStatsDropdown.style.display = 'block';

            // Event Listener für Vorschläge
            playerStatsDropdown.querySelectorAll('.search-item').forEach(item => {
                item.addEventListener('click', () => {
                    const playerName = item.dataset.name;
                    playerStatsSearch.value = playerName;
                    playerStatsDropdown.style.display = 'none';
                    
                    // Wechsle zur Einzelspieler-Ansicht
                    statsViewSelect.value = 'player';
                    top10Container.style.display = 'none';
                    playerStatsContainer.style.display = 'block';
                    playerStatsContainer.classList.add('active');
                    
                    // Zeige die Statistiken des ausgewählten Spielers
                    showPlayerStats(playerName);
                });
            });
        } else {
            playerStatsDropdown.style.display = 'none';
        }
    });

    // Schließe Dropdown beim Klick außerhalb
    document.addEventListener('click', (e) => {
        if (!playerStatsSearch.contains(e.target) && !playerStatsDropdown.contains(e.target)) {
            playerStatsDropdown.style.display = 'none';
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
loadInitialData().then(() => {
    // Zeige standardmäßig die Top 10 an
    statsViewSelect.value = 'top10';
    statsViewSelect.dispatchEvent(new Event('change'));
}); 