// Supabase Configuration
const SUPABASE_URL = "https://alnpiwrwleegotdfahpv.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ufi61yRrZbyy1XgGKRkLZw_SQDGg4G0";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = "2026OHS12345";

let currentMatchEvents = [];
let editingImages = { team: "", player: "", trophy: "", news: "" };

function escapeHtml(v = "") { return String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
function placeholder(label) { return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="220"><rect width="100%" height="100%" fill="#16283c"/><text x="50%" y="50%" fill="#7890a8" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="20">${label}</text></svg>`); }

// --- DATA FETCHING & RENDERING ---

async function renderAll() {
  await renderStandings();
  await renderMatches();
  await renderTeams();
  await renderPlayers();
  await renderTrophies();
  await renderNews();
  await renderStats();
}

async function renderTeams() {
  const teamsGrid = document.getElementById("teamsGrid");
  if (!teamsGrid) return;

  const { data: teams, error } = await supabase.from('teams').select('*');
  if (error) return console.error(error);

  teamsGrid.innerHTML = teams.map(t => `
    <article class="team-card">
      <img src="${t.logo || placeholder(t.short || "TEAM")}" alt="${escapeHtml(t.name)}">
      <h3>${escapeHtml(t.name)}</h3>
      <p class="muted">${escapeHtml(t.coach || "Coach TBA")}</p>
    </article>
  `).join("") || `<p class="muted">No teams added yet.</p>`;
}

async function renderStandings() {
  const body = document.getElementById("standingsBody");
  if (!body) return;

  const { data: teams } = await supabase.from('teams').select('*');
  const { data: matches } = await supabase.from('matches').select('*').eq('status', 'Played');

  if (!teams || teams.length === 0) {
    body.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;" class="muted">No teams registered yet. Add teams in Admin.</td></tr>`;
    return;
  }

  const table = teams.map(t => {
    let s = { team: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    (matches || []).filter(m => m.home_id === t.id || m.away_id === t.id).forEach(m => {
      s.mp++;
      let h = Number(m.home_score), a = Number(m.away_score);
      if (m.home_id === t.id) {
        s.gf += h; s.ga += a;
        if (h > a) { s.w++; s.pts += 3; }
        else if (h === a) { s.d++; s.pts++; }
        else s.l++;
      } else {
        s.gf += a; s.ga += h;
        if (a > h) { s.w++; s.pts += 3; }
        else if (a === h) { s.d++; s.pts++; }
        else s.l++;
      }
    });
    s.gd = s.gf - s.ga;
    return s;
  }).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

  body.innerHTML = table.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><div class="team-cell"><img class="team-logo" src="${s.team.logo || placeholder(s.team.short || "TEAM")}" alt=""><span>${escapeHtml(s.team.name)}</span></div></td>
      <td>${s.mp}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td><td>${s.gf}</td><td>${s.ga}</td><td>${s.gd}</td><td><b>${s.pts}</b></td>
    </tr>
  `).join("");
}

async function renderPlayers() {
  const playersGrid = document.getElementById("playersGrid");
  if (!playersGrid) return;

  const { data: players } = await supabase.from('players').select('*, teams(name)');
  const { data: events } = await supabase.from('match_events').select('scorer_id');

  const goalCounts = {};
  (events || []).forEach(e => {
    if (e.scorer_id) goalCounts[e.scorer_id] = (goalCounts[e.scorer_id] || 0) + 1;
  });

  const sorted = (players || []).map(p => ({ ...p, goals: goalCounts[p.id] || 0 }))
    .sort((a, b) => b.goals - a.goals);

  playersGrid.innerHTML = sorted.map(p => `
    <article class="player-card">
      <img src="${p.image || placeholder("PLAYER")}" alt="">
      <div class="player-info">
        <span class="pill">#${escapeHtml(p.number || "")}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="muted">${escapeHtml(p.position || "Player")} • ${escapeHtml(p.teams?.name || "Free Agent")}</p>
        <strong>${p.goals} goals</strong>
      </div>
    </article>
  `).join("") || `<p class="muted">No players added yet.</p>`;
}

async function renderMatches() {
  const fixturesGrid = document.getElementById("fixturesGrid");
  const resultsGrid = document.getElementById("resultsGrid");

  const { data: matches } = await supabase.from('matches').select('*, home:teams!home_id(name), away:teams!away_id(name)');
  
  const matchCard = m => {
    const played = m.status === "Played";
    return `
      <article class="match-card">
        <div class="match-meta"><span>${escapeHtml(m.match_date)} ${m.match_time || ""}</span><span>${played ? "RESULT" : "FIXTURE"}</span></div>
        <div class="match-teams"><strong>${escapeHtml(m.home?.name || "TBA")}</strong><div class="score">${played ? `${m.home_score} - ${m.away_score}` : "VS"}</div><strong>${escapeHtml(m.away?.name || "TBA")}</strong></div>
        <p class="muted" style="text-align:center">${escapeHtml(m.venue || "Venue TBA")}</p>
      </article>`;
  };

  if (fixturesGrid) fixturesGrid.innerHTML = (matches || []).filter(m => m.status !== "Played").map(matchCard).join("") || `<p class="muted">No upcoming fixtures.</p>`;
  if (resultsGrid) resultsGrid.innerHTML = (matches || []).filter(m => m.status === "Played").map(matchCard).join("") || `<p class="muted">No results recorded yet.</p>`;
}

async function renderTrophies() {
  const trophiesGrid = document.getElementById("trophiesGrid");
  if (!trophiesGrid) return;
  const { data } = await supabase.from('trophies').select('*');
  trophiesGrid.innerHTML = (data || []).map(t => `<article class="trophy-card">${t.image ? `<img src="${t.image}">` : `<div class="trophy-icon">🏆</div>`}<h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.winner)}</p><span class="pill">${escapeHtml(t.season)}</span></article>`).join("") || `<p class="muted">No trophy awards recorded yet.</p>`;
}

async function renderNews() {
  const newsGrid = document.getElementById("newsGrid");
  if (!newsGrid) return;
  const { data } = await supabase.from('news').select('*');
  newsGrid.innerHTML = (data || []).map(n => `<article class="news-card">${n.image ? `<img src="${n.image}">` : ""}<span class="pill">${escapeHtml(n.date)}</span><h3>${escapeHtml(n.title)}</h3><p class="muted">${escapeHtml(n.body)}</p></article>`).join("") || `<p class="muted">No news articles published.</p>`;
}

async function renderStats() {
  const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
  const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { data: playedMatches } = await supabase.from('matches').select('home_score, away_score').eq('status', 'Played');

  if (document.getElementById("statTeams")) document.getElementById("statTeams").textContent = teamCount || 0;
  if (document.getElementById("statPlayers")) document.getElementById("statPlayers").textContent = playerCount || 0;
  if (document.getElementById("statMatches")) document.getElementById("statMatches").textContent = playedMatches?.length || 0;
  if (document.getElementById("statGoals")) document.getElementById("statGoals").textContent = (playedMatches || []).reduce((sum, m) => sum + Number(m.home_score || 0) + Number(m.away_score || 0), 0);
  if (document.getElementById("footerYear")) document.getElementById("footerYear").textContent = new Date().getFullYear();
}

// --- MULTI-GOAL EVENT SYSTEM FOR MATCHES ---

async function loadMatchEvents(matchId) {
  currentMatchEvents = [];
  if (!matchId) return renderGoalInputs();

  const { data } = await supabase.from('match_events').select('*').eq('match_id', matchId);
  if (data) currentMatchEvents = data;
  renderGoalInputs();
}

async function renderGoalInputs() {
  const container = document.getElementById("goalEventsContainer");
  if (!container) return;

  const { data: players } = await supabase.from('players').select('id, name, team_id, teams(name)');

  const playerOptions = (selectedId) => `<option value="">Select Player</option>` + (players || []).map(p => 
    `<option value="${p.id}" ${selectedId === p.id ? "selected" : ""}>${escapeHtml(p.name)} (${escapeHtml(p.teams?.name || "")})</option>`
  ).join("");

  container.innerHTML = currentMatchEvents.map((ev, i) => `
    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
      <select onchange="currentMatchEvents[${i}].scorer_id = this.value" required>${playerOptions(ev.scorer_id)}</select>
      <select onchange="currentMatchEvents[${i}].assister_id = this.value || null"><option value="">No Assist</option>${playerOptions(ev.assister_id)}</select>
      <input type="number" placeholder="Min" value="${ev.minute || ''}" style="width: 70px;" onchange="currentMatchEvents[${i}].minute = Number(this.value) || null">
      <button type="button" class="btn danger small" onclick="currentMatchEvents.splice(${i}, 1); renderGoalInputs();">✕</button>
    </div>
  `).join("");
}

function addGoalEventRow() {
  currentMatchEvents.push({ scorer_id: "", assister_id: null, minute: null });
  renderGoalInputs();
}

// --- ADMIN FORMS ---

async function uploadImage(file) {
  if (!file) return "";
  const fileName = `${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('league-assets').upload(fileName, file);
  if (error) { console.error(error); return ""; }
  const { data } = supabase.storage.from('league-assets').getPublicUrl(fileName);
  return data.publicUrl;
}

document.getElementById("teamForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("teamId").value;
  const logo = await uploadImage(document.getElementById("teamLogo").files[0]) || editingImages.team;

  const payload = {
    name: document.getElementById("teamName").value,
    short: document.getElementById("teamShort").value || document.getElementById("teamName").value.slice(0, 3).toUpperCase(),
    coach: document.getElementById("teamCoach").value,
    logo
  };

  const { error } = id ? await supabase.from('teams').update(payload).eq('id', id) : await supabase.from('teams').insert([payload]);
  if (error) return alert(error.message);

  document.getElementById("teamForm").reset();
  renderAll();
});

document.getElementById("matchForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("matchId").value;
  const matchPayload = {
    home_id: document.getElementById("homeTeam").value,
    away_id: document.getElementById("awayTeam").value,
    match_date: document.getElementById("matchDate").value,
    match_time: document.getElementById("matchTime").value,
    venue: document.getElementById("matchVenue").value,
    status: document.getElementById("matchStatus").value,
    home_score: Number(document.getElementById("homeScore").value) || 0,
    away_score: Number(document.getElementById("awayScore").value) || 0
  };

  const { data: match, error } = id 
    ? await supabase.from('matches').update(matchPayload).eq('id', id).select().single()
    : await supabase.from('matches').insert([matchPayload]).select().single();

  if (error) return alert(error.message);

  // Sync Goal Events
  await supabase.from('match_events').delete().eq('match_id', match.id);
  if (currentMatchEvents.length > 0) {
    const eventsToInsert = currentMatchEvents.map(ev => ({
      match_id: match.id,
      scorer_id: ev.scorer_id,
      assister_id: ev.assister_id || null,
      minute: ev.minute || null
    }));
    await supabase.from('match_events').insert(eventsToInsert);
  }

  document.getElementById("matchForm").reset();
  currentMatchEvents = [];
  renderGoalInputs();
  renderAll();
});

// Admin Authentication
document.getElementById("loginForm")?.addEventListener("submit", e => {
  e.preventDefault();
  if (document.getElementById("adminPassword")?.value === ADMIN_PASSWORD) {
    sessionStorage.setItem("ohs_admin", "1");
    showAdmin(true);
  } else alert("Incorrect password.");
});

function showAdmin(ok) {
  document.getElementById("loginPanel")?.classList.toggle("hidden", ok);
  document.getElementById("adminPanel")?.classList.toggle("hidden", !ok);
}
showAdmin(sessionStorage.getItem("ohs_admin") === "1");

// App Initialization
renderAll();