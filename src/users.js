const USERS_KEY = 'biblefinder_users';
const CURRENT_USER_KEY = 'biblefinder_current_user';

export function getUsers() {
  try {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      console.error('Users data is not an array, resetting');
      return [];
    }
    return parsed;
  } catch (e) {
    // localStorage corrupt or JSON parse failed. Return empty array
    // so the app keeps working; user can restore from backup if they
    // had one. Better than crashing the whole app.
    console.error('Failed to read users from localStorage:', e);
    return [];
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
    // Detect active language from current user's settings
    const currentId = localStorage.getItem(CURRENT_USER_KEY);
    const currentUser = currentId && users.find(u => u.id === currentId);
    const isNL = currentUser?.settings?.display?.lang !== 'en';

    alert(isNL
      ? '⚠️ Je voortgang kon niet worden opgeslagen. De opslagruimte van je browser is vol.\n\n' +
        'Wat je kunt doen:\n' +
        '1. Ga naar Instellingen → Data → Maak back-up\n' +
        '2. Wis je browsergegevens (cache en sitedata)\n' +
        '3. Open de app opnieuw en herstel je back-up'
      : '⚠️ Your progress could not be saved. Your browser storage is full.\n\n' +
        'What you can do:\n' +
        '1. Go to Settings → Data → Create Backup\n' +
        '2. Clear your browser data (cache and site data)\n' +
        '3. Reopen the app and restore your backup'
    );
  }
}

export function createUser(name, initialSettings) {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: 'empty' };
  }
  const users = getUsers();
  if (users.length >= 10) {
    return { error: 'maxUsers' };
  }
  if (users.find(u => u.name.toLowerCase() === trimmed.toLowerCase())) {
    return { error: 'duplicate' };
  }

  const newUser = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: trimmed,
    createdAt: Date.now(),
    bestStreak: 0,
    quizHistory: [],
    fsrsCards: {},
    // v4: per-book ring buffer driving the gold-line "confident" signal.
    // Each entry is an array of booleans (length up to 3); `true` = last
    // attempt was correct AND within masteryMs. Gold appears when all 3
    // most-recent entries are true. See src/fsrs.js for the helpers.
    confidentBuffers: {},
    // v4 commit 4: paused-session snapshots. When the user taps Back
    // mid-session, the full in-session state is written here (target
    // book, streak, score, etc.) so the home screen can offer a Resume
    // CTA that restores everything exactly. `null` means no paused
    // session for that mode.
    pausedQuizSession: null,
    pausedBoxSession: null,
    bestTimes: {},
    // Cumulative active-quiz time in ms. Grows with each answered question
    // (capped at 30s per question, Anki-style). Reset by Reset Progress.
    // Restored from backup, falling back to 0 for legacy backups.
    totalQuizMs: 0,
    // Persist the lang (and any other setting) the user had active on the
    // UserSelect screen so it isn't snapped back to the browser default
    // on first login.
    ...(initialSettings ? { settings: initialSettings } : {}),
  };

  users.push(newUser);
  saveUsers(users);
  return { user: newUser };
}

export function getUser(id) {
  const users = getUsers();
  return users.find(u => u.id === id) || null;
}

export function updateUser(id, updates) {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return false;
  
  users[index] = { ...users[index], ...updates };
  saveUsers(users);
  return true;
}

// Atomically add to a user's totalQuizMs counter. Reads the latest stored
// value and increments — avoids the closure-over-stale-state problem you'd
// get from `updateUser(id, { totalQuizMs: currentUser.totalQuizMs + ms })`
// where `currentUser` might be a snapshot from before a previous update.
//
// addMs is the delta to add. Negative is silently treated as 0 (clamps).
// Returns the new total, or null if the user doesn't exist.
export function addToTotalQuizMs(id, addMs) {
  if (!Number.isFinite(addMs) || addMs <= 0) return null;
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;
  const current = users[index].totalQuizMs || 0;
  const next = current + addMs;
  users[index] = { ...users[index], totalQuizMs: next };
  saveUsers(users);
  return next;
}

export function deleteUser(id) {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  saveUsers(filtered);
  
  if (getCurrentUser() === id) {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
  return true;
}

export function getCurrentUser() {
  try {
    return localStorage.getItem(CURRENT_USER_KEY);
  } catch (e) {
    console.error('Failed to read current user:', e);
    return null;
  }
}

export function setCurrentUser(id) {
  try {
    localStorage.setItem(CURRENT_USER_KEY, id);
  } catch (e) {
    // Quota exceeded or storage disabled. Non-fatal — user state
    // just won't persist across reloads. The main saveUsers call
    // already shows a quota warning, so we stay silent here.
    console.error('Failed to persist current user:', e);
  }
}
