import { loadNotes, saveNotes } from './Storage.js';

export function exportNotes() {
  const notes = loadNotes();
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notes-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importNotes(file) {
  const text = await file.text();
  const incoming = JSON.parse(text);
  if (!Array.isArray(incoming)) throw new Error('Archivo inválido');
  saveNotes(incoming);
  return incoming;
}
