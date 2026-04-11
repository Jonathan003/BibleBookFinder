const USERS_KEY = 'biblefinder_users';
const CURRENT_USER_KEY = 'biblefinder_current_user';

export function getUsers() {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function createUser(name) {
  const users = getUsers();
  if (users.length >= 10) {
    return { error: 'Max 10 users reached' };
  }
  if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
    return { error: 'Name already exists' };
  }
  
  const newUser = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: name.trim(),
    createdAt: Date.now(),
    foundBooks: [],
    bestStreak: 0,
    quizHistory: [], // { date, correct, total, avgTime }
    settings: {
      lang: 'nl',
    }
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

export function exportUserData(userId) {
  const user = getUser(userId);
  if (!user) return null;
  
  const exportObj = {
    app: 'BibleBookFinder',
    version: 1,
    exportedAt: Date.now(),
    user: user
  };
  
  // Encode as base64 for easy sharing
  const json = JSON.stringify(exportObj);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return encoded;
}

export function importUserData(encodedData) {
  try {
    const json = decodeURIComponent(escape(atob(encodedData.trim())));
    const data = JSON.parse(json);
    
    if (data.app !== 'BibleBookFinder') {
      return { error: 'Invalid export format' };
    }
    
    const importedUser = data.user;
    const users = getUsers();
    
    // Check if user with same name exists
    const existingIndex = users.findIndex(u => u.name.toLowerCase() === importedUser.name.toLowerCase());
    
    if (existingIndex >= 0) {
      // Merge: take the best of both
      const existing = users[existingIndex];
      const mergedFound = [...new Set([...existing.foundBooks, ...importedUser.foundBooks])];
      const mergedBestStreak = Math.max(existing.bestStreak, importedUser.bestStreak || 0);
      
      users[existingIndex] = {
        ...existing,
        foundBooks: mergedFound,
        bestStreak: mergedBestStreak,
        quizHistory: [...(existing.quizHistory || []), ...(importedUser.quizHistory || [])],
      };
      
      saveUsers(users);
      return { user: users[existingIndex], merged: true };
    } else {
      // Add as new user with new ID
      const newUser = {
        ...importedUser,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      };
      
      users.push(newUser);
      saveUsers(users);
      return { user: newUser, merged: false };
    }
  } catch (e) {
    return { error: 'Invalid import code' };
  }
}
