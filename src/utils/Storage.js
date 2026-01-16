const KEY = 'notes-v1';

export function loadNotes() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes) {
  localStorage.setItem(KEY, JSON.stringify(notes));
}

export function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

export function createNote() {
  const note = {
    id: newId(),
    title: 'Nueva nota',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const notes = loadNotes();
  const updated = [note, ...notes];
  saveNotes(updated);
  return note;
}

export function getNote(id) {
  return loadNotes().find(n => n.id === id) || null;
}

export function updateNote(id, patch) {
  const notes = loadNotes();
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return null;
  notes[idx] = { ...notes[idx], ...patch, updatedAt: new Date().toISOString() };
  saveNotes(notes);
  return notes[idx];
}

export function deleteNote(id) {
  const notes = loadNotes().filter(n => n.id !== id);
  saveNotes(notes);
}

export function searchNotes(q) {
  const notes = loadNotes();
  if (!q?.trim()) return notes;
  const s = q.toLowerCase();
  return notes.filter(n =>
    (n.title || '').toLowerCase().includes(s) ||
    strip(n.content).toLowerCase().includes(s)
  );
}

function strip(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}
