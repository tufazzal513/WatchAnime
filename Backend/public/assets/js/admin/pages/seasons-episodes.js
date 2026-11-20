// ========== DUAL WHEEL PICKER LOGIC (unchanged) ==========
let seasonsData = [];
let selectedSeasonIndex = 0;
let selectedEpisodeIndex = 0;

const seasonListEl = document.getElementById('season-list');
const episodeListEl = document.getElementById('episode-list');
const editPanel = document.getElementById('episode-edit-panel');
const editQ = (q) => document.getElementById('edit-ep-q' + q);

function renderSeasons() {
    seasonListEl.innerHTML = '';
    seasonsData.forEach((season, idx) => {
        const div = document.createElement('div');
        div.className = `picker-item ${idx === selectedSeasonIndex ? 'selected' : ''}`;
        div.textContent = season.name;
        div.dataset.index = idx;
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            selectSeason(idx);
        });
        seasonListEl.appendChild(div);
    });
    renderEpisodes();
}

function renderEpisodes() {
    episodeListEl.innerHTML = '';
    const currentSeason = seasonsData[selectedSeasonIndex];
    if (currentSeason) {
        currentSeason.episodes.forEach((ep, idx) => {
            const div = document.createElement('div');
            div.className = `picker-item ${idx === selectedEpisodeIndex ? 'selected' : ''}`;
            div.textContent = ep.name || `Episode ${idx+1}`;
            div.dataset.index = idx;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                selectEpisode(idx);
            });
            episodeListEl.appendChild(div);
        });
    }
    updateEditPanelVisibility();
}

function selectSeason(index) {
    if (index >= 0 && index < seasonsData.length) {
        selectedSeasonIndex = index;
        selectedEpisodeIndex = 0;
        renderSeasons();
        loadEpisodeForEdit();
    }
}

function selectEpisode(index) {
    if (seasonsData[selectedSeasonIndex] && index >= 0 && index < seasonsData[selectedSeasonIndex].episodes.length) {
        selectedEpisodeIndex = index;
        renderEpisodes();
        loadEpisodeForEdit();
    } else {
        editPanel.classList.add('hidden');
    }
}

function loadEpisodeForEdit() {
    const season = seasonsData[selectedSeasonIndex];
    if (season && season.episodes[selectedEpisodeIndex]) {
        const ep = season.episodes[selectedEpisodeIndex];
        [480, 720, 1080].forEach(q => { const el = editQ(q); if (el) { el.value = ep['q' + q] || ''; el.dispatchEvent(new Event('input', { bubbles: true })); } });
        editPanel.classList.remove('hidden');

        // এপিসোড প্যানেল লোড হলে লিংকের ধরন শো করবে
        if(window.triggerLinkDetectors) window.triggerLinkDetectors();
    } else {
        editPanel.classList.add('hidden');
    }
}

function updateEditPanelVisibility() {
    if (seasonsData.length > 0 && seasonsData[selectedSeasonIndex] && seasonsData[selectedSeasonIndex].episodes.length > 0 && selectedEpisodeIndex >= 0) {
        loadEpisodeForEdit();
    } else {
        editPanel.classList.add('hidden');
    }
}

window.addSeasonUI = function() {
    let n = seasonsData.length + 1;
    while (seasonsData.some(x => x.name === `Season ${n}`)) n++;
    const newSeasonName = `Season ${n}`;
    seasonsData.push({ name: newSeasonName, episodes: [] });
    selectSeason(seasonsData.length - 1);
};

window.deleteCurrentSeason = function() {
    if (seasonsData.length === 0) return;
    if (confirm('Delete this season and all its episodes?')) {
        seasonsData.splice(selectedSeasonIndex, 1);
        if (seasonsData.length === 0) {
            selectedSeasonIndex = 0;
            selectedEpisodeIndex = 0;
            editPanel.classList.add('hidden');
        } else {
            selectedSeasonIndex = Math.min(selectedSeasonIndex, seasonsData.length - 1);
        }
        renderSeasons();
    }
};

window.addEpisodeUI = function() {
    if (seasonsData.length === 0) {
        alert('Please add a season first.');
        return;
    }
    const season = seasonsData[selectedSeasonIndex];
    const newEpName = `Episode ${season.episodes.length + 1}`;
    season.episodes.push({ name: newEpName });
    selectedEpisodeIndex = season.episodes.length - 1;
    renderEpisodes();
};

window.bulkAddEpisodesUI = function() {
    if (seasonsData.length === 0) {
        alert('Please add a season first.');
        return;
    }
    const start = parseInt(prompt('Start episode number:', '1'));
    const end = parseInt(prompt('End episode number:', '10'));
    if (isNaN(start) || isNaN(end) || end < start) return;
    const season = seasonsData[selectedSeasonIndex];
    for (let i = start; i <= end; i++) {
        season.episodes.push({ name: `Episode ${i}` });
    }
    selectedEpisodeIndex = season.episodes.length - 1;
    renderEpisodes();
};

window.saveEpisodeEdit = function() {
    const season = seasonsData[selectedSeasonIndex];
    if (!season || !season.episodes[selectedEpisodeIndex]) return;
    const ep = season.episodes[selectedEpisodeIndex];
    [480, 720, 1080].forEach(q => { const el = editQ(q); ep['q' + q] = el ? el.value.trim() : ''; });
    alert('Episode updated');
};

window.deleteCurrentEpisode = function() {
    const season = seasonsData[selectedSeasonIndex];
    if (!season || season.episodes.length === 0) return;
    if (confirm('Delete this episode?')) {
        season.episodes.splice(selectedEpisodeIndex, 1);
        if (season.episodes.length === 0) {
            selectedEpisodeIndex = -1;
            editPanel.classList.add('hidden');
        } else {
            selectedEpisodeIndex = Math.min(selectedEpisodeIndex, season.episodes.length - 1);
        }
        renderEpisodes();
    }
};

function loadSeasonsFromMovie(movie) {
    if (movie.seasons) {
        seasonsData = [];
        Object.keys(movie.seasons).forEach(seasonName => {
            const episodes = movie.seasons[seasonName].map(ep => ({
                name: ep.name,
                q480: ep.q480 || '', q720: ep.q720 || '', q1080: ep.q1080 || ''}));
            seasonsData.push({ name: seasonName, episodes });
        });
        selectedSeasonIndex = 0;
        selectedEpisodeIndex = seasonsData[0]?.episodes.length ? 0 : -1;
    } else {
        seasonsData = [];
        selectedSeasonIndex = 0;
        selectedEpisodeIndex = -1;
    }
    renderSeasons();
}
