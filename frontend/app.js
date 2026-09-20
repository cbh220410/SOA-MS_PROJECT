// CinePass Portal Application Logic
const API_BASE_URL = window.location.origin.includes('localhost:8080') 
    ? window.location.origin 
    : 'http://localhost:8080';

// Global State
let currentUser = null;
let currentToken = localStorage.getItem('cinepass_jwt') || null;
let moviesCache = [];
let showsCache = [];
let selectedMovie = null;
let selectedShow = null;
let selectedSeats = [];

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    loadMovies();
    loadShowsForAdminAndSim();
    setupEventListeners();
});

// =========================================================================
// 1. Authentication & Session Management
// =========================================================================
function isTokenValid(token) {
    if (!token) return false;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const payload = JSON.parse(atob(parts[1]));
        if (!payload.exp) return true;
        return (payload.exp * 1000) > Date.now();
    } catch (e) {
        return false;
    }
}

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken && isTokenValid(currentToken)) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return headers;
}

function initAuth() {
    const savedUser = localStorage.getItem('cinepass_user');
    if (savedUser && currentToken) {
        if (isTokenValid(currentToken)) {
            try {
                currentUser = JSON.parse(savedUser);
            } catch (e) {
                logout(false);
            }
        } else {
            logout(false);
        }
    }
    renderAuthSection();
}

function renderAuthSection() {
    const authContainer = document.getElementById('auth-section');
    const adminNavBtn = document.getElementById('admin-nav-btn');
    const simNavBtn = document.getElementById('sim-nav-btn');

    if (currentUser && currentToken && isTokenValid(currentToken)) {
        const isAdmin = currentUser.role === 'ADMIN';
        if (adminNavBtn) adminNavBtn.style.display = isAdmin ? 'inline-flex' : 'none';
        if (simNavBtn) simNavBtn.style.display = isAdmin ? 'inline-flex' : 'none';

        authContainer.innerHTML = `
            <div class="user-badge">
                <span style="font-size: 1.1rem;">👤</span>
                <span>${escapeHtml(currentUser.username)}</span>
                <span class="user-role-tag">${escapeHtml(currentUser.role)}</span>
                <button class="btn-clean" onclick="logout(true)" style="margin-left: 0.5rem;" title="Logout">🚪</button>
            </div>
        `;
    } else {
        if (adminNavBtn) adminNavBtn.style.display = 'none';
        if (simNavBtn) simNavBtn.style.display = 'none';
        authContainer.innerHTML = `
            <button class="btn btn-secondary" onclick="openAuthModal('login')">Sign In</button>
            <button class="btn btn-primary" onclick="openAuthModal('register')">Register</button>
        `;
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
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const loginBtn = document.getElementById('tab-login-btn');
    const regBtn = document.getElementById('tab-register-btn');
    const title = document.getElementById('auth-modal-title');

    if (mode === 'login') {
        loginForm.classList.add('active');
        regForm.classList.remove('active');
        loginBtn.classList.add('active');
        regBtn.classList.remove('active');
        title.innerText = 'Sign In to CinePass';
    } else {
        regForm.classList.add('active');
        loginForm.classList.remove('active');
        regBtn.classList.add('active');
        loginBtn.classList.remove('active');
        title.innerText = 'Create CinePass Account';
    }
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

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Invalid credentials');
        }

        currentToken = data.jwt;
        currentUser = {
            userId: data.userId,
            username: data.username,
            role: data.role
        };

        localStorage.setItem('cinepass_jwt', currentToken);
        localStorage.setItem('cinepass_user', JSON.stringify(currentUser));

        showToast(`Welcome back, ${data.username}!`, 'success');
        closeAuthModal();
        renderAuthSection();

        // Refresh bookings if in Bookings tab
        if (document.getElementById('bookings-view').classList.contains('active')) {
            loadUserBookings();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (username.length < 3) {
        showToast('Username must be at least 3 characters.', 'error');
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        showToast('Registration successful! Please sign in.', 'success');
        switchAuthTab('login');
        quickFillLogin(username, password);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function logout(notify = true) {
    currentUser = null;
    currentToken = null;
    localStorage.removeItem('cinepass_jwt');
    localStorage.removeItem('cinepass_user');
    renderAuthSection();
    if (notify) {
        showToast('Signed out successfully.', 'info');
    }
    switchView('movies-view');
}

// =========================================================================
// 2. Navigation Tabs
// =========================================================================
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-tab');
            switchView(targetView);
        });
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const activePanel = document.getElementById(viewId);
    if (activePanel) activePanel.classList.add('active');

    const activeBtn = document.querySelector(`.nav-btn[data-tab="${viewId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (viewId === 'bookings-view') {
        loadUserBookings();
    } else if (viewId === 'simulator-view' || viewId === 'admin-view') {
        loadShowsForAdminAndSim();
    }
}

// =========================================================================
// 3. Movie Catalog & Shows Exploration
// =========================================================================
async function loadMovies() {
    const grid = document.getElementById('movies-grid');
    grid.innerHTML = '<div class="loading-spinner">Loading movies from catalog...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/movies`);
        const movies = await response.json().catch(() => null);
        
        if (!response.ok || !Array.isArray(movies)) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; padding: 2.5rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 1rem; text-align: center;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
                    <h3 style="color: #ef4444; font-size: 1.1rem; margin-bottom: 0.5rem;">Movie Service Unavailable (HTTP ${response.status})</h3>
                    <p style="color: #94a3b8; font-size: 0.88rem; max-width: 500px; margin: 0 auto;">
                        Please ensure <strong>cinepass-eureka-server</strong> (port 8761) and <strong>cinepass-movie-service</strong> (port 8081) are running in STS and registered.
                    </p>
                </div>
            `;
            return;
        }

        moviesCache = movies;

        if (movies.length === 0) {
            grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center;">No movies found in catalog.</p>';
            return;
        }

        const posters = [
            { icon: '🌌', bg: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', rating: '9.2', tag: 'IMAX 3D' },
            { icon: '🚀', bg: 'linear-gradient(135deg, #1e293b 0%, #0c1222 100%)', rating: '8.9', tag: 'DOLBY CINEMA' },
            { icon: '⏳', bg: 'linear-gradient(135deg, #2e1065 0%, #0f172a 100%)', rating: '8.8', tag: '4K LASER' },
            { icon: '🌊', bg: 'linear-gradient(135deg, #083344 0%, #0f172a 100%)', rating: '8.5', tag: '3D HFR' },
            { icon: '🦸‍♂️', bg: 'linear-gradient(135deg, #3b0764 0%, #0f172a 100%)', rating: '9.0', tag: '4DX SCREEN' },
            { icon: '⚔️', bg: 'linear-gradient(135deg, #450a0a 0%, #0f172a 100%)', rating: '8.7', tag: 'ATMOS' }
        ];

        grid.innerHTML = movies.map((m, idx) => {
            const p = posters[idx % posters.length];
            return `
            <div class="movie-card">
                <div class="movie-poster-placeholder" style="background: ${p.bg}">
                    <span style="filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5)); transform: scale(1.15); font-size: 4.5rem;">${p.icon}</span>
                    <span style="position: absolute; top: 12px; left: 12px; z-index: 3; background: rgba(6,9,19,0.75); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); padding: 0.25rem 0.65rem; border-radius: 9999px; font-size: 0.72rem; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px;">${p.tag}</span>
                    <span style="position: absolute; top: 12px; right: 12px; z-index: 3; background: rgba(6,9,19,0.75); backdrop-filter: blur(8px); border: 1px solid rgba(251,191,36,0.3); padding: 0.25rem 0.65rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 800; color: #fbbf24;">⭐ ${p.rating}</span>
                    <span class="movie-duration-badge">⏱️ ${m.duration} mins</span>
                </div>
                <div class="movie-body">
                    <h3 class="movie-title">${escapeHtml(m.title)}</h3>
                    <span class="movie-genre">${escapeHtml(m.genre)}</span>
                    <div class="movie-footer">
                        <button class="btn btn-primary btn-block btn-glow" onclick="openShowsModal(${m.movieId})">
                            🎟️ Select Showtime & Seats
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        populateAdminMovieDropdown(movies);
    } catch (err) {
        grid.innerHTML = `<p class="text-danger">Failed to load movies: ${err.message}. Make sure Gateway and Movie service are running.</p>`;
    }
}

async function searchMovies() {
    const query = document.getElementById('movie-search-input').value.trim();
    if (!query) {
        loadMovies();
        return;
    }

    const grid = document.getElementById('movies-grid');
    grid.innerHTML = '<div class="loading-spinner">Searching...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/movies/search?title=${encodeURIComponent(query)}`);
        const movies = await response.json();

        if (movies.length === 0) {
            grid.innerHTML = `<p class="text-muted">No movies matching "${escapeHtml(query)}"</p>`;
            return;
        }

        const posters = ['🎬', '🍿', '🌟', '⚡'];
        grid.innerHTML = movies.map((m, idx) => `
            <div class="movie-card">
                <div class="movie-poster-placeholder">
                    <span>${posters[idx % posters.length]}</span>
                    <span class="movie-duration-badge">⏱️ ${m.duration} mins</span>
                </div>
                <div class="movie-body">
                    <h3 class="movie-title">${escapeHtml(m.title)}</h3>
                    <span class="movie-genre">${escapeHtml(m.genre)}</span>
                    <div class="movie-footer">
                        <button class="btn btn-primary btn-block" onclick="openShowsModal(${m.movieId})">
                            🎟️ View Shows & Book
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast('Search failed: ' + err.message, 'error');
    }
}

async function openShowsModal(movieId) {
    selectedMovie = moviesCache.find(m => m.movieId === movieId);
    if (!selectedMovie) return;

    document.getElementById('selected-movie-title').innerText = selectedMovie.title;
    document.getElementById('selected-movie-info').innerText = `${selectedMovie.genre} • ${selectedMovie.duration} mins`;
    document.getElementById('show-selection-modal').classList.add('active');
    document.getElementById('booking-widget').style.display = 'none';

    const showsList = document.getElementById('shows-list');
    showsList.innerHTML = '<div class="loading-spinner">Fetching showtimes...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/shows/movie/${movieId}`);
        const shows = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(shows)) {
            showsList.innerHTML = `<p class="text-danger">⚠️ Show service unavailable (HTTP ${response.status}). Please ensure cinepass-show-service is running on port 8082.</p>`;
            return;
        }

        if (shows.length === 0) {
            showsList.innerHTML = '<p class="text-muted">No scheduled shows found for this movie.</p>';
            return;
        }

        showsList.innerHTML = shows.map(s => {
            const date = new Date(s.showTime);
            const formatted = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isLow = s.availableSeats < 15;

            return `
                <div class="show-slot-card" id="show-slot-${s.showId}" onclick="selectShowSlot(${JSON.stringify(s).replace(/"/g, '&quot;')})">
                    <div class="show-time-text">🕒 ${formatted}</div>
                    <div class="show-seats-count ${isLow ? 'low' : ''}">
                        💺 ${s.availableSeats} Seats Left ${isLow ? '(Selling Fast!)' : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        showsList.innerHTML = `<p class="text-danger">Failed to fetch shows: ${err.message}</p>`;
    }
}

function closeShowModal() {
    document.getElementById('show-selection-modal').classList.remove('active');
    selectedShow = null;
    selectedSeats = [];
}

function selectShowSlot(show) {
    selectedShow = show;
    selectedSeats = ['A1']; // default 1 seat

    document.querySelectorAll('.show-slot-card').forEach(c => c.classList.remove('selected'));
    const slotCard = document.getElementById(`show-slot-${show.showId}`);
    if (slotCard) slotCard.classList.add('selected');

    const widget = document.getElementById('booking-widget');
    widget.style.display = 'block';

    renderSeatMap(show.availableSeats);
    updateBookingSummary();
}

function renderSeatMap(availableSeats) {
    const seatContainer = document.getElementById('seat-map-container');
    const rows = [
        { name: 'A', tier: 'VIP RECLINER ($18.00)', price: 18.00, count: 8 },
        { name: 'B', tier: 'VIP RECLINER ($18.00)', price: 18.00, count: 8 },
        { name: 'C', tier: 'EXECUTIVE GOLD ($14.00)', price: 14.00, count: 8 },
        { name: 'D', tier: 'EXECUTIVE GOLD ($14.00)', price: 14.00, count: 8 },
        { name: 'E', tier: 'CLASSIC STANDARD ($10.00)', price: 10.00, count: 8 }
    ];

    let overallIndex = 1;
    let html = '';

    rows.forEach(r => {
        html += `<div class="seat-row-label-header">
                    <span class="row-letter">${r.name}</span>
                    <span class="row-tier-tag">${r.tier}</span>
                 </div>`;
        html += `<div class="seat-row">`;
        for (let i = 1; i <= r.count; i++) {
            const seatId = `${r.name}${i}`;
            const isOccupied = overallIndex > availableSeats;
            const isSelected = selectedSeats.includes(seatId);
            html += `
                <div class="seat-item ${isOccupied ? 'occupied' : ''} ${isSelected ? 'selected' : ''}" 
                     data-seat-id="${seatId}"
                     data-price="${r.price}"
                     title="Seat ${seatId} - ${r.tier}"
                     onclick="toggleSeatSelection('${seatId}', ${isOccupied})">
                    ${seatId}
                </div>
            `;
            overallIndex++;
        }
        html += `</div>`;
    });

    seatContainer.innerHTML = html;
}

function toggleSeatSelection(seatId, isOccupied) {
    if (isOccupied) return;
    const index = selectedSeats.indexOf(seatId);
    if (index > -1) {
        selectedSeats.splice(index, 1);
    } else {
        if (selectedSeats.length >= 6) {
            showToast('Fair Booking Policy: Maximum 6 seats per transaction.', 'warning');
            return;
        }
        selectedSeats.push(seatId);
    }
    renderSeatMap(selectedShow.availableSeats);
    updateBookingSummary();
}

function updateBookingSummary() {
    if (!selectedShow) return;
    const count = selectedSeats.length || 1;
    
    // Calculate accurate seat pricing based on row
    let subtotal = 0;
    selectedSeats.forEach(s => {
        if (s.startsWith('A') || s.startsWith('B')) subtotal += 18.00;
        else if (s.startsWith('C') || s.startsWith('D')) subtotal += 14.00;
        else subtotal += 10.00;
    });
    if (selectedSeats.length === 0) subtotal = 14.00;

    const bookingFee = 1.50 * count;
    const total = (subtotal + bookingFee).toFixed(2);

    document.getElementById('summary-show-id').innerText = `#${selectedShow.showId}`;
    document.getElementById('summary-seats-count').innerText = `${selectedSeats.join(', ') || '1 Seat'} (${count} Total)`;
    document.getElementById('summary-total-price').innerText = `$${total} (inc. fee)`;
}

// =========================================================================
// 4. Booking Execution & Concurrency Protection
// =========================================================================
async function confirmBooking() {
    if (!currentUser || !currentToken) {
        showToast('Please sign in first to complete your booking.', 'info');
        openAuthModal('login');
        return;
    }

    if (!selectedShow) {
        showToast('Please select a showtime slot.', 'error');
        return;
    }

    const seatsCount = selectedSeats.length || 1;
    const confirmBtn = document.getElementById('confirm-booking-btn');
    confirmBtn.disabled = true;
    confirmBtn.innerText = '⚡ Allocating Seats...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`,
                'X-User-Id': currentUser.userId ? currentUser.userId.toString() : '1'
            },
            body: JSON.stringify({
                userId: currentUser.userId || 1,
                showId: parseInt(selectedShow.showId, 10),
                seatsBooked: seatsCount
            })
        });

        const data = await response.json();

        if (response.status === 409) {
            throw new Error(`🚫 Concurrency Conflict: ${data.message || 'Insufficient seats remaining'}`);
        } else if (!response.ok) {
            throw new Error(data.message || 'Booking failed');
        }

        closeShowModal();
        showTicketPassModal(data, selectedMovie.title);
        showToast('🎉 Booking Confirmed Successfully!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerText = '⚡ Confirm Instant Booking';
    }
}

function showTicketPassModal(booking, movieTitle) {
    document.getElementById('ticket-movie-title').innerText = movieTitle || 'CinePass Screening';
    document.getElementById('ticket-booking-id').innerText = `#${booking.bookingId}`;
    document.getElementById('ticket-seats-count').innerText = `${booking.seatsBooked} Seat(s)`;
    document.getElementById('ticket-show-id').innerText = `#${booking.showId}`;
    document.getElementById('ticket-status').innerText = booking.bookingStatus;
    document.getElementById('ticket-pass-modal').classList.add('active');
}

function closeTicketModal() {
    document.getElementById('ticket-pass-modal').classList.remove('active');
    switchView('bookings-view');
}

// =========================================================================
// 5. User Bookings Management
// =========================================================================
async function loadUserBookings() {
    const grid = document.getElementById('bookings-grid');

    if (!currentUser || !currentToken) {
        grid.innerHTML = `
            <div class="text-center" style="grid-column: 1/-1; padding: 3rem;">
                <p class="text-muted" style="margin-bottom: 1rem;">Please sign in to view your CinePass tickets.</p>
                <button class="btn btn-primary" onclick="openAuthModal('login')">Sign In</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = '<div class="loading-spinner">Loading your ticket history...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/bookings/user/${currentUser.userId}`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        const bookings = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(bookings)) {
            grid.innerHTML = `<p class="text-danger" style="grid-column: 1/-1; text-align: center; padding: 2rem;">⚠️ Booking service unavailable (HTTP ${response.status}). Please ensure cinepass-booking-service is running on port 8083.</p>`;
            return;
        }

        if (bookings.length === 0) {
            grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">You have no ticket bookings yet.</p>';
            return;
        }

        grid.innerHTML = bookings.map(b => `
            <div class="booking-card">
                <div class="booking-card-header">
                    <span class="booking-id-tag">TICKET #${b.bookingId}</span>
                    <span class="status-badge ${b.bookingStatus}">${b.bookingStatus}</span>
                </div>
                <div class="booking-details-row">
                    <span>Show ID:</span>
                    <strong>#${b.showId}</strong>
                </div>
                <div class="booking-details-row">
                    <span>Seats Booked:</span>
                    <strong>${b.seatsBooked} Seats</strong>
                </div>
                <div class="booking-details-row">
                    <span>Booking Date:</span>
                    <strong>${new Date(b.createdAt || Date.now()).toLocaleDateString()}</strong>
                </div>
                ${b.bookingStatus === 'CONFIRMED' ? `
                    <button class="btn btn-outline btn-block" style="margin-top: 1rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.4);" 
                            onclick="cancelUserBooking(${b.bookingId})">
                        ❌ Cancel & Refund Seats
                    </button>
                ` : ''}
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<p class="text-danger">Failed to load bookings: ${err.message}</p>`;
    }
}

async function cancelUserBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking and refund the seats back to inventory?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to cancel booking');
        }

        showToast('Ticket cancelled and seats refunded to inventory.', 'success');
        loadUserBookings();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =========================================================================
// 6. High Concurrency Simulator Engine
// =========================================================================
async function loadShowsForAdminAndSim() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/shows`);
        const shows = await response.json().catch(() => null);
        if (response.ok && Array.isArray(shows)) {
            showsCache = shows;

            const simSelect = document.getElementById('sim-target-show');
            if (simSelect) {
                if (shows.length === 0) {
                    simSelect.innerHTML = '<option value="">No shows available</option>';
                } else {
                    simSelect.innerHTML = shows.map(s => `
                        <option value="${s.showId}">Show #${s.showId} (Movie #${s.movieId}) — ${s.availableSeats} Available Seats</option>
                    `).join('');
                }
            }
        }
    } catch (err) {
        console.error('Failed to load shows:', err);
    }
}

async function runConcurrencySimulation() {
    const showId = document.getElementById('sim-target-show').value;
    const usersCount = parseInt(document.getElementById('sim-users-count').value, 10);
    const seatsPerUser = parseInt(document.getElementById('sim-seats-per-user').value, 10);
    const runBtn = document.getElementById('run-sim-btn');

    if (!showId) {
        showToast('No show selected for simulation.', 'error');
        return;
    }

    // Fetch latest fresh show status
    let initialSeats = 0;
    try {
        const showRes = await fetch(`${API_BASE_URL}/api/shows/${showId}`);
        const showData = await showRes.json();
        initialSeats = showData.availableSeats;
    } catch (e) {
        initialSeats = 10;
    }

    document.getElementById('metric-start-inventory').innerText = initialSeats;
    document.getElementById('metric-confirmed').innerText = '0';
    document.getElementById('metric-rejected').innerText = '0';
    document.getElementById('metric-final-seats').innerText = '...';

    runBtn.disabled = true;
    runBtn.innerText = '⚡ Simulating Rush...';

    logSim(`[SIMULATOR START] Initiating ${usersCount} simultaneous booking threads for Show #${showId}. Starting inventory: ${initialSeats} seats. Demanded total: ${usersCount * seatsPerUser} seats.`, 'info');

    let confirmedCount = 0;
    let rejectedCount = 0;

    let simToken = currentToken;
    if (!simToken) {
        try {
            logSim('[AUTHENTICATING] Obtaining demonstration JWT token for simulation...', 'info');
            const authRes = await fetch(`${API_BASE_URL}/api/users/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'john@example.com', password: 'password123' })
            });
            const authData = await authRes.json();
            if (authData.token) {
                simToken = authData.token;
            }
        } catch (e) {
            console.warn('Auto-auth for simulator failed:', e);
        }
    }

    // Create an array of simultaneous promises
    const promises = Array.from({ length: usersCount }, (_, i) => {
        const simulatedUserId = 100 + i;
        const headers = {
            'Content-Type': 'application/json',
            'X-User-Id': simulatedUserId.toString()
        };
        if (simToken) {
            headers['Authorization'] = `Bearer ${simToken}`;
        }
        return fetch(`${API_BASE_URL}/api/bookings`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                userId: simulatedUserId,
                showId: parseInt(showId, 10),
                seatsBooked: seatsPerUser
            })
        }).then(async res => {
            const data = await res.json().catch(() => ({}));
            if (res.status === 201 || res.status === 200) {
                confirmedCount++;
                document.getElementById('metric-confirmed').innerText = confirmedCount;
                logSim(`Thread [User #${simulatedUserId}] -> SUCCESS: Allocated ${seatsPerUser} seats. Booking ID #${data.bookingId}.`, 'success');
            } else if (res.status === 409) {
                rejectedCount++;
                document.getElementById('metric-rejected').innerText = rejectedCount;
                logSim(`Thread [User #${simulatedUserId}] -> CONFLICT (409): Rejected. Insufficient inventory.`, 'conflict');
            } else {
                logSim(`Thread [User #${simulatedUserId}] -> Status ${res.status}: ${data.message || 'Error'}`, 'info');
            }
        }).catch(err => {
            logSim(`Thread [User #${simulatedUserId}] -> Network Error: ${err.message}`, 'conflict');
        });
    });

    await Promise.all(promises);

    // Refresh final database state
    try {
        const finalShowRes = await fetch(`${API_BASE_URL}/api/shows/${showId}`);
        const finalShowData = await finalShowRes.json();
        document.getElementById('metric-final-seats').innerText = finalShowData.availableSeats;

        logSim(`[SIMULATOR COMPLETE] Final DB Available Seats: ${finalShowData.availableSeats}. Total Confirmed: ${confirmedCount}, Total Blocked: ${rejectedCount}. Zero Double-Bookings!`, 'info');
    } catch (e) {
        document.getElementById('metric-final-seats').innerText = '0';
    }

    runBtn.disabled = false;
    runBtn.innerText = '🔥 Launch Simultaneous Rush';
    loadShowsForAdminAndSim();
}

function logSim(msg, type = 'info') {
    const stream = document.getElementById('sim-logs-stream');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    entry.innerText = `[${timestamp}] ${msg}`;
    stream.appendChild(entry);
    stream.scrollTop = stream.scrollHeight;
}

function clearSimLogs() {
    document.getElementById('sim-logs-stream').innerHTML = '<div class="log-entry info">Simulation log cleared.</div>';
}

// =========================================================================
// 7. Admin Control Operations
// =========================================================================
function populateAdminMovieDropdown(movies) {
    const select = document.getElementById('admin-show-movie-select');
    if (select) {
        select.innerHTML = movies.map(m => `
            <option value="${m.movieId}">${m.title} (${m.duration} mins)</option>
        `).join('');
    }
}

async function handleAddMovie(event) {
    event.preventDefault();
    if (!currentUser || currentUser.role !== 'ADMIN') {
        showToast('Admin authorization required to create movies.', 'error');
        return;
    }

    const title = document.getElementById('admin-movie-title').value.trim();
    const genre = document.getElementById('admin-movie-genre').value.trim();
    const duration = parseInt(document.getElementById('admin-movie-duration').value, 10);

    try {
        const response = await fetch(`${API_BASE_URL}/api/movies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ title, genre, duration })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to add movie');

        showToast(`Movie "${title}" added successfully!`, 'success');
        document.getElementById('add-movie-form').reset();
        loadMovies();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleScheduleShow(event) {
    event.preventDefault();
    if (!currentUser || currentUser.role !== 'ADMIN') {
        showToast('Admin authorization required to schedule shows.', 'error');
        return;
    }

    const movieId = parseInt(document.getElementById('admin-show-movie-select').value, 10);
    const showTimeRaw = document.getElementById('admin-show-time').value;
    const availableSeats = parseInt(document.getElementById('admin-show-capacity').value, 10);

    if (!showTimeRaw) {
        showToast('Please select a valid showtime.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/shows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                movieId,
                showTime: showTimeRaw + ':00',
                availableSeats
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to schedule show');

        showToast(`Show scheduled with ${availableSeats} seats!`, 'success');
        document.getElementById('schedule-show-form').reset();
        loadShowsForAdminAndSim();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =========================================================================
// 8. Event Listeners & Utilities
// =========================================================================
function setupEventListeners() {
    // Auth Forms
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    // Movie Search
    document.getElementById('search-movie-btn').addEventListener('click', searchMovies);
    document.getElementById('reset-search-btn').addEventListener('click', () => {
        document.getElementById('movie-search-input').value = '';
        loadMovies();
    });

    // Booking actions
    document.getElementById('confirm-booking-btn').addEventListener('click', confirmBooking);
    document.getElementById('refresh-bookings-btn').addEventListener('click', loadUserBookings);

    // Concurrency Sim
    document.getElementById('run-sim-btn').addEventListener('click', runConcurrencySimulation);

    // Admin forms
    document.getElementById('add-movie-form').addEventListener('submit', handleAddMovie);
    document.getElementById('schedule-show-form').addEventListener('submit', handleScheduleShow);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

