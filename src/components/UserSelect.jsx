import { useState } from 'react';
import { getUsers, createUser, getUser, updateUser } from '../users';
import { useAppConfig } from '../App';
import { InitialAvatar } from './Icons';
import './UserSelect.css';

export default function UserSelect({ onSelect, onToggleLang }) {
  const { t, lang } = useAppConfig();
  const [users, setUsers] = useState(getUsers());
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    const result = createUser(newName);
    if (result.error) {
      const errorMessages = { maxUsers: t.errorMaxUsers, duplicate: t.errorDuplicate };
      setError(errorMessages[result.error] || result.error);
      return;
    }
    const updatedUser = getUser(result.user.id);
    setUsers(getUsers());
    setNewName('');
    setShowAdd(false);
    setError('');
    // Auto-select the newly created user
    if (updatedUser) onSelect(updatedUser);
  };

  return (
    <div className="user-select">
      <button className="lang-btn user-select-lang" onClick={onToggleLang}>
        {lang === 'nl' ? 'NL' : 'EN'}
      </button>
      <div className="user-select-header">
        <h1>{t.title}</h1>
        <p className="subtitle">{t.subtitle}</p>
      </div>

      <div className="user-list">
        {users.length === 0 && <p className="no-users">{t.noUsers}</p>}

        {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(user => (
          <UserCard key={user.id} user={user} onSelect={onSelect} onRefresh={() => setUsers(getUsers())} t={t} />
        ))}

        {users.length < 10 && (
          <>
            {showAdd ? (
              <div className="add-user-form">
<div className="name-input-group">
                  <input
                    type="text"
                    placeholder={t.namePlaceholder}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    autoFocus
                    maxLength={20}
                  />
                  <button className="btn-create" onClick={handleCreate}>{t.addBtn}</button>
                  <button className="btn-cancel" onClick={() => { setShowAdd(false); setError(''); }}>✕</button>
                </div>
                {error && <p className="error-msg">{error}</p>}
              </div>
            ) : (
              <button className="add-user-btn" onClick={() => setShowAdd(true)}>
                <span className="plus">+</span>
                <span>{t.addUser}</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function UserCard({ user, onSelect, onRefresh, t }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
    import('../users').then(({ deleteUser }) => {
      deleteUser(user.id);
      onRefresh();
    });
  };

  const fsrsCards = user.fsrsCards || {};
  const masteredCount = Object.values(fsrsCards).filter(c => c.stability > 7).length;
  const progress = Math.round((masteredCount / 66) * 100);

  return (
    <div className="user-card">
      <button className="user-card-main" onClick={() => onSelect(user)}>
        <div className="user-avatar"><InitialAvatar name={user.name} size={36} /></div>
        <div className="user-info">
          <span className="user-name">{user.name}</span>
          <div className="user-progress">
            <div className="progress-bar-mini">
              <div className="progress-fill-mini" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{masteredCount}/66</span>
          </div>
        </div>
      </button>
      <button className="delete-btn" onClick={handleDelete} title={t.deleteTitle}>
        {confirmDelete ? t.confirmDelete : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        )}
      </button>
    </div>
  );
}
