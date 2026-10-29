/* ==========================================================================
   CinePass Portal — application logic
   Talks to the API Gateway only (/api/users, /api/movies, /api/shows,
   /api/bookings). Works when served by the gateway, from a LAN address,
   from a local dev server, or opened directly as a file.
   ========================================================================== */

// ---------------------------------------------------------------------------
// 0. API connection resolution
//    Priority: ?api=<url> query  >  saved override  >  same origin (gateway)
//              >  <current host>:8080  >  http://localhost:8080
// ---------------------------------------------------------------------------
const GATEWAY_PORT = '8080';
const REQUEST_TIMEOUT_MS = 12000;

function resolveApiBase() {
    try {
        const qp = new URLSearchParams(window.location.search).get('api');
        if (qp) {
            const clean = qp.replace(/\/+$/, '');
            localStorage.setItem('cinepass_api', clean);
            return clean;
        }
        const saved = localStorage.getItem('cinepass_api');
        if (saved) return saved.replace(/\/+$/, '');
    } catch (e) { /* storage unavailable */ }

    const { protocol, hostname, port, origin } = window.location;
    if (protocol === 'file:' || !hostname) return `http://localhost:${GATEWAY_PORT}`;
    if (port === GATEWAY_PORT || (port === '' && protocol === 'https:')) return origin;
    // Served from a different port (Live Server, etc.): assume gateway on the same host.
    return `${protocol}//${hostname}:${GATEWAY_PORT}`;
}

const API_BASE_URL = resolveApiBase();

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------
let currentUser = null;
let currentToken = safeGet('cinepass_jwt');
let moviesCache = [];
let showsCache = [];
let selectedMovie = null;
let selectedShow = null;
let selectedSeats = [];

const SEAT_ROWS = [
    { name: 'A', tier: 'Premier Recliner', price: 18.0, count: 8 },
    { name: 'B', tier: 'Premier Recliner', price: 18.0, count: 8 },
    { name: 'C', tier: 'Executive', price: 14.0, count: 8 },
    { name: 'D', tier: 'Executive', price: 14.0, count: 8 },
    { name: 'E', tier: 'Standard', price: 10.0, count: 8 }
];
const BOOKING_FEE = 1.5;
const MAX_SEATS = 6;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('footer-api').textContent = API_BASE_URL;
    initAuth();
    initNavigation();
    setupEventListeners();
    loadMovies();
    loadShowsForAdminAndSim();
});

// ---------------------------------------------------------------------------
// 1. HTTP helper
// ---------------------------------------------------------------------------
function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}
function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

/**
 * Fetch wrapper: timeout, safe JSON parsing, optional auth header.
 * Always resolves with { ok, status, data, networkError }.
 */
async function api(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
    const opts = { method, headers: { Accept: 'application/json', ...headers } };
    if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    if (auth && currentToken) opts.headers['Authorization'] = `Bearer ${currentToken}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    opts.signal = controller.signal;

    try {
        const res = await fetch(`${API_BASE_URL}${path}`, opts);
        const text = await res.text();
        let data = null;
        if (text) { try { data = JSON.parse(text); } catch (e) { data = { message: text.slice(0, 200) }; } }
        setConnection(true);
        if (res.status === 401 && auth) handleSessionExpired();
        return { ok: res.ok, status: res.status, data, networkError: false };
    } catch (err) {
        setConnection(false);
        const message = err.name === 'AbortError' ? 'The request timed out.' : 'Unable to reach the gateway.';
        return { ok: false, status: 0, data: { message }, networkError: true };
    } finally {
        clearTimeout(timer);
    }
}

function errorMessage(result, fallback) {
    return (result.data && result.data.message) || fallback;
}

function setConnection(online) {
    const el = document.getElementById('connection-status');
    const text = document.getElementById('connection-text');
    if (!el || !text) return;
    el.classList.toggle('ok', online);
    el.classList.toggle('bad', !online);
    text.textContent = online ? 'Connected' : 'Gateway offline';
}

function serviceDownBox(title, hint, retryFn) {
    return `
        <div class="error-box">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(hint)}</p>
            <button class="btn btn-secondary" onclick="${retryFn}">Try again</button>
        </div>`;
}

// ---------------------------------------------------------------------------
// 2. Authentication
// ---------------------------------------------------------------------------
function isTokenValid(token) {
    if (!token) return false;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(b64));
        return !payload.exp || payload.exp * 1000 > Date.now();
    } catch (e) {
        return false;
    }
}

function isLoggedIn() {
    return !!(currentUser && currentToken && isTokenValid(currentToken));
}

function initAuth() {
    const savedUser = safeGet('cinepass_user');
    if (savedUser && currentToken) {
        if (isTokenValid(currentToken)) {
            try { currentUser = JSON.parse(savedUser); } catch (e) { logout(false); }
        } else {
            logout(false);
        }
    }
    renderAuthSection();
}

function renderAuthSection() {
    const container = document.getElementById('auth-section');
    const adminBtn = document.getElementById('admin-nav-btn');
    const simBtn = document.getElementById('sim-nav-btn');

    if (isLoggedIn()) {
        const isAdmin = currentUser.role === 'ADMIN';
        adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
        simBtn.style.display = isAdmin ? 'inline-block' : 'none';
        container.innerHTML = `
            <div class="user-badge">
                <span>${escapeHtml(currentUser.username)}</span>
                <span class="user-role-tag">${escapeHtml(currentUser.role || 'USER')}</span>
                <button class="btn-clean" onclick="logout(true)">Sign out</button>
            </div>`;
    } else {
        adminBtn.style.display = 'none';
        simBtn.style.display = 'none';
        container.innerHTML = `
            <button class="btn btn-secondary" onclick="openAuthModal('login')">Sign In</button>
            <button class="btn btn-primary" onclick="openAuthModal('register')">Register</button>`;
    }
}

function openAuthModal(mode = 'login') {
    document.getElementById('auth-modal').classList.add('active');
    switchAuthTab(mode);
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('active');
}

function switchAuthTab(mode) {
    const isLogin = mode === 'login';
    document.getElementById('login-form').classList.toggle('active', isLogin);
    document.getElementById('register-form').classList.toggle('active', !isLogin);
    document.getElementById('tab-login-btn').classList.toggle('active', isLogin);
    document.getElementById('tab-register-btn').classList.toggle('active', !isLogin);
    document.getElementById('auth-modal-title').textContent = isLogin ? 'Member Sign In' : 'Create Account';
}

function quickFillLogin(username, password) {
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) {
        showToast('Please enter both username and password.', 'error');
        return;
    }

    // Accept either username or email in the single field.
    const payload = username.includes('@') ? { email: username, password } : { username, password };
    const res = await api('/api/users/signin', { method: 'POST', body: payload });

    if (!res.ok || !res.data || !res.data.jwt) {
        showToast(errorMessage(res, 'Invalid credentials.'), 'error');
        return;
    }

    currentToken = res.data.jwt;
    currentUser = { userId: res.data.userId, username: res.data.username || username, role: res.data.role };
    safeSet('cinepass_jwt', currentToken);
    safeSet('cinepass_user', JSON.stringify(currentUser));

    showToast(`Welcome, ${currentUser.username}.`, 'success');
    closeAuthModal();
    document.getElementById('login-form').reset();
    renderAuthSection();
    if (document.getElementById('bookings-view').classList.contains('active')) loadUserBookings();
}

async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (username.length < 3) return showToast('Username must be at least 3 characters.', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Please enter a valid email address.', 'error');
    if (password.length < 6) return showToast('Password must be at least 6 characters.', 'error');

    const res = await api('/api/users/signup', { method: 'POST', body: { username, email, password, role: 'USER' } });
    if (!res.ok) {
        showToast(errorMessage(res, 'Registration failed.'), 'error');
        return;
    }
    showToast('Registration successful. Please sign in.', 'success');
    document.getElementById('register-form').reset();
    switchAuthTab('login');
    quickFillLogin(username, password);
}

function handleSessionExpired() {
    if (!currentToken) return;
    logout(false);
    showToast('Your session has expired. Please sign in again.', 'warning');
    openAuthModal('login');
}

function logout(notify = true) {
    currentUser = null;
    currentToken = null;
    safeRemove('cinepass_jwt');
    safeRemove('cinepass_user');
    renderAuthSection();
    if (notify) showToast('You have been signed out.', 'info');
    switchView('movies-view');
}

// ---------------------------------------------------------------------------
// 3. Navigation
// ---------------------------------------------------------------------------
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.getAttribute('data-tab'));
            closeMobileMenu();
        });
    });

    const toggle = document.getElementById('menu-toggle');
    toggle.addEventListener('click', () => {
        const panel = document.getElementById('masthead-right');
        const open = panel.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeAuthModal();
            closeShowModal();
            document.getElementById('ticket-pass-modal').classList.remove('active');
        }
    });

    // Close a modal when the dark backdrop is clicked.
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('mousedown', e => {
            if (e.target !== modal) return;
            if (modal.id === 'auth-modal') closeAuthModal();
            else if (modal.id === 'show-selection-modal') closeShowModal();
        });
    });
}

function closeMobileMenu() {
    document.getElementById('masthead-right').classList.remove('open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}

function switchView(viewId) {
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const panel = document.getElementById(viewId);
    if (panel) panel.classList.add('active');
    const btn = document.querySelector(`.nav-btn[data-tab="${viewId}"]`);
    if (btn) btn.classList.add('active');

    document.getElementById('hero').style.display = viewId === 'movies-view' ? '' : 'none';

    if (viewId === 'bookings-view') loadUserBookings();
    else if (viewId === 'simulator-view' || viewId === 'admin-view') loadShowsForAdminAndSim();
}

// ---------------------------------------------------------------------------
// 4. Movies & performances
// ---------------------------------------------------------------------------
async function loadMovies() {
    const grid = document.getElementById('movies-grid');
    grid.innerHTML = '<div class="loading-spinner">Loading programme&hellip;</div>';

    const res = await api('/api/movies');
    if (!res.ok || !Array.isArray(res.data)) {
        grid.innerHTML = serviceDownBox(
            res.networkError ? 'Cannot reach the gateway' : `Movie service unavailable (HTTP ${res.status})`,
            `Expected the API gateway at ${API_BASE_URL}. Make sure the Eureka server, gateway and movie service are running.`,
            'loadMovies()'
        );
        return;
    }
    moviesCache = res.data;
    populateAdminMovieDropdown(moviesCache);
    renderMovies(applyMovieFilter());
}

function applyMovieFilter() {
    const q = document.getElementById('movie-search-input').value.trim().toLowerCase();
    if (!q) return moviesCache;
    return moviesCache.filter(m =>
        (m.title || '').toLowerCase().includes(q) || (m.genre || '').toLowerCase().includes(q));
}

function renderMovies(movies) {
    const grid = document.getElementById('movies-grid');
    if (movies.length === 0) {
        grid.innerHTML = `<div class="empty-state"><h3>No films found</h3><p>No film in the programme matches your search.</p></div>`;
        return;
    }
    grid.innerHTML = movies.map((m, i) => {
        const initial = escapeHtml((m.title || '?').trim().charAt(0).toUpperCase());
        return `
        <article class="movie-card">
            <div class="movie-poster p${i % 6}">
                <span class="poster-mono">${initial}</span>
                <span class="poster-caption">${escapeHtml(m.genre || 'Feature Film')}</span>
            </div>
            <div class="movie-body">
                <h3 class="movie-title">${escapeHtml(m.title)}</h3>
                <div class="movie-meta">
                    <span class="movie-genre">${escapeHtml(m.genre)}</span>
                    <span>${Number(m.duration) || 0} min</span>
                </div>
                <div class="movie-footer">
                    <button class="btn btn-primary btn-block" onclick="openShowsModal(${Number(m.movieId)})">Select Performance</button>
                </div>
            </div>
        </article>`;
    }).join('');
}

function searchMovies() { renderMovies(applyMovieFilter()); }

async function openShowsModal(movieId) {
    selectedMovie = moviesCache.find(m => Number(m.movieId) === movieId);
    if (!selectedMovie) return;
    selectedShow = null;
    selectedSeats = [];

    document.getElementById('selected-movie-title').textContent = selectedMovie.title;
    document.getElementById('selected-movie-info').textContent = `${selectedMovie.genre} \u00B7 ${selectedMovie.duration} min`;
    document.getElementById('booking-widget').style.display = 'none';
    document.getElementById('show-selection-modal').classList.add('active');

    const list = document.getElementById('shows-list');
    list.innerHTML = '<div class="loading-spinner">Fetching performances&hellip;</div>';

    const res = await api(`/api/shows/movie/${movieId}`);
    if (!res.ok || !Array.isArray(res.data)) {
        list.innerHTML = serviceDownBox('Show service unavailable',
            res.networkError ? 'The gateway could not be reached.' : `The show service returned HTTP ${res.status}.`,
            `openShowsModal(${movieId})`);
        return;
    }
    if (res.data.length === 0) {
        list.innerHTML = '<p class="text-muted" style="grid-column:1/-1;">No performances are scheduled for this film yet.</p>';
        return;
    }

    showsCache = mergeShows(res.data);
    list.innerHTML = res.data.map(s => {
        const d = new Date(s.showTime);
        const when = isNaN(d) ? escapeHtml(String(s.showTime)) :
            d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const low = s.availableSeats < 15;
        const full = s.availableSeats <= 0;
        return `
            <div class="show-slot-card" id="show-slot-${s.showId}" onclick="selectShowSlot(${s.showId})">
                <div class="show-time-text">${when}</div>
                <div class="show-seats-count ${low ? 'low' : ''}">${full ? 'Sold out' : `${s.availableSeats} seats left${low ? ' \u2014 selling fast' : ''}`}</div>
            </div>`;
    }).join('');
}

function mergeShows(newShows) {
    const map = new Map(showsCache.map(s => [s.showId, s]));
    newShows.forEach(s => map.set(s.showId, s));
    return Array.from(map.values());
}

function closeShowModal() {
    document.getElementById('show-selection-modal').classList.remove('active');
    selectedShow = null;
    selectedSeats = [];
}

function selectShowSlot(showId) {
    const show = showsCache.find(s => s.showId === showId);
    if (!show) return;
    selectedShow = show;
    selectedSeats = [];

    document.querySelectorAll('.show-slot-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById(`show-slot-${showId}`);
    if (card) card.classList.add('selected');

    document.getElementById('booking-widget').style.display = 'block';
    renderSeatMap();
    updateBookingSummary();
    document.getElementById('booking-widget').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderSeatMap() {
    const available = selectedShow ? selectedShow.availableSeats : 0;
    let index = 1;
    let html = '';
    SEAT_ROWS.forEach(r => {
        html += `<div class="seat-row-label-header">
                    <span class="row-letter">Row ${r.name}</span>
                    <span class="row-tier-tag">${r.tier} &middot; $${r.price.toFixed(2)}</span>
                 </div><div class="seat-row">`;
        for (let i = 1; i <= r.count; i++) {
            const id = `${r.name}${i}`;
            const occupied = index > available;
            const selected = selectedSeats.includes(id);
            html += `<div class="seat-item ${occupied ? 'occupied' : ''} ${selected ? 'selected' : ''}"
                          role="button" tabindex="${occupied ? -1 : 0}" aria-pressed="${selected}"
                          title="Seat ${id} \u2014 ${r.tier}"
                          onclick="toggleSeatSelection('${id}', ${occupied})"
                          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleSeatSelection('${id}', ${occupied});}">${id}</div>`;
            index++;
        }
        html += '</div>';
    });
    document.getElementById('seat-map-container').innerHTML = html;
}

function toggleSeatSelection(seatId, occupied) {
    if (occupied || !selectedShow) return;
    const i = selectedSeats.indexOf(seatId);
    if (i > -1) {
        selectedSeats.splice(i, 1);
    } else {
        if (selectedSeats.length >= MAX_SEATS) {
            showToast(`Booking policy: a maximum of ${MAX_SEATS} seats per transaction.`, 'warning');
            return;
        }
        selectedSeats.push(seatId);
    }
    renderSeatMap();
    updateBookingSummary();
}

function seatPrice(seatId) {
    const row = SEAT_ROWS.find(r => seatId.startsWith(r.name));
    return row ? row.price : 10.0;
}

function updateBookingSummary() {
    if (!selectedShow) return;
    const count = selectedSeats.length;
    const subtotal = selectedSeats.reduce((sum, s) => sum + seatPrice(s), 0);
    const total = subtotal + BOOKING_FEE * count;
    document.getElementById('summary-show-id').textContent = `#${selectedShow.showId}`;
    document.getElementById('summary-seats-count').textContent = count ? `${selectedSeats.join(', ')} (${count})` : 'None selected';
    document.getElementById('summary-total-price').textContent = `$${total.toFixed(2)}${count ? ' (incl. fees)' : ''}`;
}

// ---------------------------------------------------------------------------
// 5. Booking
// ---------------------------------------------------------------------------
async function confirmBooking() {
    if (!isLoggedIn()) {
        showToast('Please sign in to complete your reservation.', 'info');
        openAuthModal('login');
        return;
    }
    if (!selectedShow) return showToast('Please select a performance.', 'error');
    if (selectedSeats.length === 0) return showToast('Please select at least one seat.', 'warning');

    const btn = document.getElementById('confirm-booking-btn');
    btn.disabled = true;
    btn.textContent = 'Reserving\u2026';

    const res = await api('/api/bookings', {
        method: 'POST',
        auth: true,
        headers: { 'X-User-Id': String(currentUser.userId || '') },
        body: { userId: currentUser.userId, showId: Number(selectedShow.showId), seatsBooked: selectedSeats.length }
    });

    btn.disabled = false;
    btn.textContent = 'Confirm Reservation';

    if (res.status === 409) {
        showToast(errorMessage(res, 'Those seats are no longer available.'), 'error');
        refreshSelectedShow();
        return;
    }
    if (res.status === 429) return showToast(errorMessage(res, 'Too many requests. Please wait a moment.'), 'warning');
    if (!res.ok) return showToast(errorMessage(res, 'Booking failed.'), 'error');

    const title = selectedMovie ? selectedMovie.title : 'CinePass Screening';
    closeShowModal();
    showTicketPassModal(res.data, title);
    showToast('Reservation confirmed.', 'success');
}

async function refreshSelectedShow() {
    if (!selectedShow) return;
    const res = await api(`/api/shows/${selectedShow.showId}`);
    if (res.ok && res.data) {
        selectedShow = res.data;
        showsCache = mergeShows([res.data]);
        selectedSeats = [];
        renderSeatMap();
        updateBookingSummary();
    }
}

function showTicketPassModal(booking, movieTitle) {
    document.getElementById('ticket-movie-title').textContent = movieTitle;
    document.getElementById('ticket-booking-id').textContent = `#${booking.bookingId}`;
    document.getElementById('ticket-seats-count').textContent = `${booking.seatsBooked} seat${booking.seatsBooked === 1 ? '' : 's'}`;
    document.getElementById('ticket-show-id').textContent = `#${booking.showId}`;
    document.getElementById('ticket-status').textContent = booking.bookingStatus || 'CONFIRMED';
    document.getElementById('ticket-pass-modal').classList.add('active');
}

function closeTicketModal() {
    document.getElementById('ticket-pass-modal').classList.remove('active');
    switchView('bookings-view');
}

// ---------------------------------------------------------------------------
// 6. My tickets
// ---------------------------------------------------------------------------
async function loadUserBookings() {
    const grid = document.getElementById('bookings-grid');

    if (!isLoggedIn()) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>Sign in required</h3>
                <p>Please sign in to view your tickets.</p>
                <button class="btn btn-primary" onclick="openAuthModal('login')">Sign In</button>
            </div>`;
        return;
    }

    grid.innerHTML = '<div class="loading-spinner">Loading your tickets&hellip;</div>';
    const res = await api(`/api/bookings/user/${currentUser.userId}`, { auth: true });

    if (res.status === 401) return; // session handler already took over
    if (!res.ok || !Array.isArray(res.data)) {
        grid.innerHTML = serviceDownBox('Booking service unavailable',
            res.networkError ? 'The gateway could not be reached.' : `The booking service returned HTTP ${res.status}.`,
            'loadUserBookings()');
        return;
    }
    if (res.data.length === 0) {
        grid.innerHTML = `<div class="empty-state"><h3>No tickets yet</h3><p>Your reservations will appear here once you book a performance.</p>
            <button class="btn btn-secondary" onclick="switchView('movies-view')">Browse Films</button></div>`;
        return;
    }

    const sorted = [...res.data].sort((a, b) => (b.bookingId || 0) - (a.bookingId || 0));
    grid.innerHTML = sorted.map(b => {
        const status = escapeHtml(b.bookingStatus || 'UNKNOWN');
        return `
        <div class="booking-card">
            <div class="booking-card-header">
                <span class="booking-id-tag">Ticket #${b.bookingId}</span>
                <span class="status-badge ${status}">${status}</span>
            </div>
            <div class="booking-details-row"><span>Performance</span><strong>#${b.showId}</strong></div>
            <div class="booking-details-row"><span>Seats</span><strong>${b.seatsBooked}</strong></div>
            ${b.bookingStatus === 'CONFIRMED' ? `
                <button class="btn btn-outline btn-block booking-cancel" onclick="cancelUserBooking(${b.bookingId})">Cancel &amp; Refund Seats</button>` : ''}
        </div>`;
    }).join('');
}

async function cancelUserBooking(bookingId) {
    if (!confirm('Cancel this booking and release the seats?')) return;
    const res = await api(`/api/bookings/${bookingId}`, { method: 'DELETE', auth: true });
    if (res.status === 401) return;
    if (!res.ok) return showToast(errorMessage(res, 'Unable to cancel the booking.'), 'error');
    showToast('Booking cancelled and seats released.', 'success');
    loadUserBookings();
}

// ---------------------------------------------------------------------------
// 7. Concurrency test (admin)
// ---------------------------------------------------------------------------
async function loadShowsForAdminAndSim() {
    const res = await api('/api/shows');
    if (!res.ok || !Array.isArray(res.data)) return;
    showsCache = mergeShows(res.data);

    const select = document.getElementById('sim-target-show');
    if (!select) return;
    const previous = select.value;
    select.innerHTML = res.data.length === 0
        ? '<option value="">No performances available</option>'
        : res.data.map(s => {
            const movie = moviesCache.find(m => Number(m.movieId) === Number(s.movieId));
            const label = movie ? movie.title : `Movie #${s.movieId}`;
            return `<option value="${s.showId}">Show #${s.showId} \u2014 ${escapeHtml(label)} \u2014 ${s.availableSeats} seats</option>`;
        }).join('');
    if (previous) select.value = previous;
}

async function runConcurrencySimulation() {
    const showId = document.getElementById('sim-target-show').value;
    const usersCount = clamp(parseInt(document.getElementById('sim-users-count').value, 10) || 2, 2, 50);
    const seatsPerUser = clamp(parseInt(document.getElementById('sim-seats-per-user').value, 10) || 1, 1, MAX_SEATS);
    const runBtn = document.getElementById('run-sim-btn');

    if (!showId) return showToast('No performance selected.', 'error');

    const before = await api(`/api/shows/${showId}`);
    const initialSeats = before.ok && before.data ? before.data.availableSeats : '?';

    document.getElementById('metric-start-inventory').textContent = initialSeats;
    document.getElementById('metric-confirmed').textContent = '0';
    document.getElementById('metric-rejected').textContent = '0';
    document.getElementById('metric-final-seats').textContent = '\u2026';

    runBtn.disabled = true;
    runBtn.textContent = 'Running\u2026';
    logSim(`Starting ${usersCount} simultaneous requests for show #${showId} (${seatsPerUser} seat(s) each). Inventory: ${initialSeats}.`, 'info');

    // Use the signed-in admin's token; otherwise fall back to the demo account.
    let token = isLoggedIn() ? currentToken : null;
    if (!token) {
        logSim('Obtaining demonstration token\u2026', 'info');
        const auth = await api('/api/users/signin', { method: 'POST', body: { username: 'john_doe', password: 'password123' } });
        if (auth.ok && auth.data && auth.data.jwt) token = auth.data.jwt;
        else logSim('Could not obtain a token; requests may be rejected.', 'conflict');
    }

    let confirmed = 0, rejected = 0;
    const jobs = Array.from({ length: usersCount }, (_, i) => {
        const uid = 100 + i;
        const headers = { 'Content-Type': 'application/json', 'X-User-Id': String(uid), Accept: 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return fetch(`${API_BASE_URL}/api/bookings`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId: uid, showId: parseInt(showId, 10), seatsBooked: seatsPerUser })
        }).then(async res => {
            const data = await res.json().catch(() => ({}));
            if (res.status === 200 || res.status === 201) {
                confirmed++;
                document.getElementById('metric-confirmed').textContent = confirmed;
                logSim(`Patron ${uid}: confirmed, booking #${data.bookingId}.`, 'success');
            } else if (res.status === 409) {
                rejected++;
                document.getElementById('metric-rejected').textContent = rejected;
                logSim(`Patron ${uid}: rejected (409), insufficient inventory.`, 'conflict');
            } else {
                logSim(`Patron ${uid}: HTTP ${res.status} \u2014 ${data.message || 'error'}`, 'info');
            }
        }).catch(err => logSim(`Patron ${uid}: network error \u2014 ${err.message}`, 'conflict'));
    });

    await Promise.all(jobs);

    const after = await api(`/api/shows/${showId}`);
    const finalSeats = after.ok && after.data ? after.data.availableSeats : '?';
    document.getElementById('metric-final-seats').textContent = finalSeats;
    logSim(`Complete. Final seats: ${finalSeats}. Confirmed: ${confirmed}. Rejected: ${rejected}.`, 'info');

    runBtn.disabled = false;
    runBtn.textContent = 'Run Simultaneous Test';
    loadShowsForAdminAndSim();
}

function logSim(msg, type = 'info') {
    const stream = document.getElementById('sim-logs-stream');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`;
    stream.appendChild(entry);
    stream.scrollTop = stream.scrollHeight;
}

function clearSimLogs() {
    document.getElementById('sim-logs-stream').innerHTML = '<div class="log-entry info">Log cleared.</div>';
}

// ---------------------------------------------------------------------------
// 8. Management (admin)
// ---------------------------------------------------------------------------
function populateAdminMovieDropdown(movies) {
    const select = document.getElementById('admin-show-movie-select');
    if (!select) return;
    select.innerHTML = movies.map(m =>
        `<option value="${m.movieId}">${escapeHtml(m.title)} (${m.duration} min)</option>`).join('');
}

function requireAdmin(action) {
    if (!isLoggedIn() || currentUser.role !== 'ADMIN') {
        showToast(`Administrator access is required to ${action}.`, 'error');
        return false;
    }
    return true;
}

async function handleAddMovie(event) {
    event.preventDefault();
    if (!requireAdmin('add films')) return;

    const title = document.getElementById('admin-movie-title').value.trim();
    const genre = document.getElementById('admin-movie-genre').value.trim();
    const duration = parseInt(document.getElementById('admin-movie-duration').value, 10);

    const res = await api('/api/movies', { method: 'POST', auth: true, body: { title, genre, duration } });
    if (!res.ok) return showToast(errorMessage(res, 'Failed to add film.'), 'error');

    showToast(`"${title}" added to the programme.`, 'success');
    document.getElementById('add-movie-form').reset();
    loadMovies();
}

async function handleScheduleShow(event) {
    event.preventDefault();
    if (!requireAdmin('schedule performances')) return;

    const movieId = parseInt(document.getElementById('admin-show-movie-select').value, 10);
    const raw = document.getElementById('admin-show-time').value;
    const availableSeats = parseInt(document.getElementById('admin-show-capacity').value, 10);
    if (!raw || isNaN(movieId)) return showToast('Please choose a film and a showtime.', 'error');

    const showTime = raw.length === 16 ? `${raw}:00` : raw; // datetime-local -> ISO with seconds
    const res = await api('/api/shows', { method: 'POST', auth: true, body: { movieId, showTime, availableSeats } });
    if (!res.ok) return showToast(errorMessage(res, 'Failed to schedule performance.'), 'error');

    showToast(`Performance scheduled with ${availableSeats} seats.`, 'success');
    document.getElementById('schedule-show-form').reset();
    loadShowsForAdminAndSim();
}

// ---------------------------------------------------------------------------
// 9. Events & utilities
// ---------------------------------------------------------------------------
function setupEventListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    const searchInput = document.getElementById('movie-search-input');
    document.getElementById('search-movie-btn').addEventListener('click', searchMovies);
    searchInput.addEventListener('input', searchMovies);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchMovies(); });
    document.getElementById('reset-search-btn').addEventListener('click', () => {
        searchInput.value = '';
        loadMovies();
    });

    document.getElementById('confirm-booking-btn').addEventListener('click', confirmBooking);
    document.getElementById('refresh-bookings-btn').addEventListener('click', loadUserBookings);
    document.getElementById('run-sim-btn').addEventListener('click', runConcurrencySimulation);
    document.getElementById('add-movie-form').addEventListener('submit', handleAddMovie);
    document.getElementById('schedule-show-form').addEventListener('submit', handleScheduleShow);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}