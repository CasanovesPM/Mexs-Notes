import React, { useEffect, useMemo, useState } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import {
  loadNotes, createNote, getNote, updateNote, deleteNote, searchNotes
} from './utils/Storage.js';

export default function App() {

  const [notes, setNotes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [currentId, setCurrentId] = useState(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // ✅ NUEVO: estado para mostrar/ocultar sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen(v => !v);

  const current = useMemo(
    () => filtered.find(n => n.id === currentId) || notes.find(n => n.id === currentId) || null,
    [filtered, notes, currentId]
  );

  useEffect(() => {
    const n = loadNotes();
    n.sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
    setNotes(n);
    setFiltered(n);
    if (n[0]) {
      setCurrentId(n[0].id);
      setTitle(n[0].title);
      setContent(n[0].content);
    }
  }, []);

  useEffect(() => {
    if (!currentId) return;
    const t = setTimeout(() => onSave(), 1200); // autosave tras 1.2s
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, currentId]);

  function refreshList(selectId) {
    const all = loadNotes().sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
    setNotes(all);
    setFiltered(all);
    if (selectId) setCurrentId(selectId);
  }

  function onNew() {
    const n = createNote();
    refreshList(n.id);
    setTitle(n.title);
    setContent(n.content);
  }

  function onSelect(id) {
    const n = getNote(id);
    setCurrentId(id);
    setTitle(n?.title || '');
    setContent(n?.content || '');
  }

  function onSave() {
    if (!currentId) return;
    const updated = updateNote(currentId, { title, content });
    if (updated) refreshList(currentId);
  }

  function onDelete() {
    if (!currentId) return;
    if (!window.confirm('¿Eliminar esta nota?')) return;
    deleteNote(currentId);
    const all = loadNotes().sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
    setNotes(all); setFiltered(all);
    const next = all[0] || null;
    setCurrentId(next?.id || null);
    setTitle(next?.title || ''); setContent(next?.content || '');
  }

  function onSearch(q) {
    const res = searchNotes(q).sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
    setFiltered(res);
    if (res.length && !res.find(n=>n.id===currentId)) onSelect(res[0].id);
  }

  return (
    <div className="d-flex flex-column" style={{height:'100vh'}}>
      <TopBar onNew={onNew} onSave={onSave} onDelete={onDelete} disabled={!currentId} onSearch={onSearch} />
      <div className="d-flex flex-grow-1">
        {/* ✅ Pasamos isOpen y onToggle al Sidebar */}
        <Sidebar
          items={filtered}
          selectedId={currentId}
          onSelect={onSelect}
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
        />
        <div className="flex-grow-1">
          {currentId ? (
            <Editor
              title={title}
              setTitle={setTitle}
              content={content}
              setContent={setContent}
              onCtrlS={onSave}
            />
          ) : (
            <div className="h-100 d-flex align-items-center justify-content-center text-muted">
              <div className="text-center">
                <h5 className="mb-2">No hay nota seleccionada</h5>
                <button className="btn btn-primary btn-sm" onClick={onNew}>Crear primera nota</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
