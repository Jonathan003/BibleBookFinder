const USERS_KEY = 'biblefinder_users';
const CURRENT_USER_KEY = 'biblefinder_current_user';

export function getUsers() {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
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
    bestTimes: {},
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
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function setCurrentUser(id) {
  localStorage.setItem(CURRENT_USER_KEY, id);
}
