// src/components/Editor.js
import React, { useEffect, useMemo, useRef, useState } from 'react';

// ---------- Utils ----------
function applyLabelToCurrentLine(text, caret, label) {
  const start = text.lastIndexOf('\n', Math.max(0, caret - 1)) + 1;
  const end = text.indexOf('\n', caret) === -1 ? text.length : text.indexOf('\n', caret);
  const line = text.slice(start, end);
  const re = /^@(texto|titulo|subtitulo|resena|lista|salto|resaltado|nota|imagen)\s*/i;

  let newLine;
  if (label === 'salto') newLine = '@salto';
  else if (re.test(line)) newLine = line.replace(re, `@${label} `);
  else newLine = `@${label} ${line}`;

  const before = text.slice(0, start);
  const after = text.slice(end);
  const newText = before + newLine + after;

  const delta = newLine.length - line.length;
  const newCaret = Math.max(start, Math.min(newText.length, caret + delta));
  return { newText, newCaret };
}

function parseBlocks(text) {
  const lines = (text || '').split('\n');
  const blocks = [];
  let i = 0;

  const isUrlOrData = (s) =>
    /^https?:\/\//i.test(s) || /^data:image\//i.test(s);

  while (i < lines.length) {
    const raw = lines[i];

    // Línea en blanco -> salto simple (sin estilos)
    if (raw.trim() === '') {
      blocks.push({ type: 'blank' });
      i++;
      continue;
    }

    const m = raw.match(/^@(texto|titulo|subtitulo|resena|lista|salto|resaltado|nota|imagen)\s*(.*)$/i);
    let tag = 'texto', rest = raw;
    if (m) { tag = m[1].toLowerCase(); rest = m[2]; }

    if (tag === 'lista') {
      const items = [];
      while (i < lines.length) {
        const m2 = lines[i].match(/^@lista\s*(.*)$/i);
        if (!m2) break;
        items.push(m2[1]);
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (tag === 'salto') { blocks.push({ type: 'hr' }); i++; continue; }

    if (tag === 'imagen') {
      const restTrim = (rest || '').trim();
      if (restTrim && isUrlOrData(restTrim)) {
        // Si el usuario pegó una URL pública o un dataURL manual
        blocks.push({ type: 'image', src: restTrim, from: 'inline' });
      } else {
        // Placeholder corto: "@imagen Imagen" (sin src)
        blocks.push({ type: 'image', src: null, from: 'placeholder' });
      }
      i++;
      continue;
    }

    blocks.push({ type: 'block', tag, text: rest });
    i++;
  }
  return blocks;
}

// Resaltado inline: @resaltar "frase entera"  ó  @resaltar palabra
function renderInlineWithHighlight(text, preset) {
  const els = [];
  const rx = /@(resaltar|resaltado)\s+(?:"([^"]+)"|(\S+))/gi;
  let last = 0, m;
  while ((m = rx.exec(text)) !== null) {
    const start = m.index;
    if (start > last) els.push(text.slice(last, start));
    const phrase = m[2] ?? m[3] ?? '';
    els.push(
      <span
        key={`hl-${els.length}`}
        style={{
          display: 'inline-block',
          fontSize: `${preset.fontSize}px`,
          fontWeight: preset.bold ? 700 : 500,
          fontStyle: preset.italic ? 'italic' : 'normal',
          color: preset.color,
          background: preset.bgColor,
          lineHeight: 1.25,
          padding: '2px 6px',
          borderRadius: 6,
        }}
      >
        {phrase}
      </span>
    );
    last = rx.lastIndex;
  }
  if (last < text.length) els.push(text.slice(last));
  return els;
}

// ---------- Componente ----------
export default function Editor({ title, setTitle, content, setContent, onCtrlS, noteId }) {
  // Presets (v3 + nota)
  const defaultPresets = {
    texto:     { fontSize: 14, lineHeight: 1.25, center: false },
    titulo:    { fontSize: 28, bold: true,  center: true },
    subtitulo: { fontSize: 20, bold: true,  center: true },
    resena:    { fontSize: 14, italic: true, color: '#6c757d', center: true },
    lista:     { fontSize: 14, lineHeight: 1.25, center: true },
    resaltado: { fontSize: 14, bold: true, italic: false, color: '#212529', bgColor: '#fff59d', center: true },
    nota:      { fontSize: 13, italic: true, color: '#495057', center: false },
  };

  const [presets, setPresets] = useState(() => {
    const v3 = localStorage.getItem('style-presets-v3');
    if (v3) {
      const parsed = JSON.parse(v3);
      return { ...defaultPresets, ...parsed, nota: parsed.nota || defaultPresets.nota };
    }
    return defaultPresets;
  });
  useEffect(() => { localStorage.setItem('style-presets-v3', JSON.stringify(presets)); }, [presets]);

  // 👉 Mapa de imágenes: dataURL guardados internamente por orden de inserción
  const [imageMap, setImageMap] = useState([]); // array de dataURL en orden

  // Menú con * (typeahead)
  const taRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 12, left: 12 });
  const [menuIndex, setMenuIndex] = useState(0);
  const [typeBuf, setTypeBuf] = useState('');
  const [bufTimer, setBufTimer] = useState(null);
  const OPTIONS = useMemo(
    () => ['texto', 'titulo', 'subtitulo', 'resena', 'lista', 'salto', 'resaltado', 'nota', 'imagen'],
    []
  );

  function openMenuAtCaret() {
    const el = taRef.current;
    if (!el) return;

    const caret = el.selectionStart;
    const before = (content || '').slice(0, caret);
    const lineIndex = before.split('\n').length - 1; // 0 = primera línea

    const styles = getComputedStyle(el);
    const padTop = parseFloat(styles.paddingTop) || 10;
    const padLeft = parseFloat(styles.paddingLeft) || 10;

    // line-height en px (si viene 'normal', calculo con fontSize * preset)
    let lh = parseFloat(styles.lineHeight);
    if (!lh || Number.isNaN(lh)) {
      const fs = parseFloat(styles.fontSize) || 14;
      lh = fs * (presets.texto.lineHeight || 1.25);
    }

    const top = padTop + lineIndex * lh - el.scrollTop + 4; // +4px de respiro
    const left = padLeft; // mismo renglón, pegado al margen izquierdo

    setMenuPos({ top, left });
    setMenuOpen(true);
    setMenuIndex(0);
    setTypeBuf('');
  }

  // Ctrl+S
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onCtrlS?.(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCtrlS]);

  // Foco al cambiar de nota
  useEffect(() => { if (noteId) taRef.current?.focus(); }, [noteId]);

  function commitSelection(label) {
    const el = taRef.current;
    const caret = el.selectionStart;
    const { newText, newCaret } = applyLabelToCurrentLine(content, caret, label);
    setContent(newText);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = newCaret; el.focus(); });
    setMenuOpen(false);
    setTypeBuf('');
    if (bufTimer) clearTimeout(bufTimer);
  }

  function updateIndexByTypeahead(buf) {
    const matches = OPTIONS
      .map((opt, idx) => ({ opt, idx }))
      .filter(x => x.opt.startsWith(buf));
    if (matches.length) setMenuIndex(matches[0].idx);
  }

  // --- Insert helper en el caret ---
  function insertAtCaret(textToInsert) {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const newText = before + textToInsert + after;
    const newCaret = start + textToInsert.length;
    setContent(newText);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = newCaret;
    });
  }

  // --- Helpers de lectura de archivos a dataURL ---
  function filesToDataUrls(files) {
    return Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsDataURL(file);
          })
      )
    );
  }

  // --- Pegado de imágenes (clipboard) ---
  async function onTextareaPaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const images = [];
    for (const it of items) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) images.push(file);
      }
    }
    if (images.length === 0) return; // deja que se pegue texto normal
    e.preventDefault();

    const dataUrls = await filesToDataUrls(images);
    // Guardamos dataURLs internamente y en el texto insertamos solo placeholders cortos
    setImageMap((prev) => [...prev, ...dataUrls]);
    const block = '\n' + dataUrls.map(() => `@imagen Imagen`).join('\n') + '\n';
    insertAtCaret(block);
  }

  // --- Drag & Drop de imágenes ---
  async function onTextareaDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    const imgFiles = files.filter(f => f.type.startsWith('image/'));
    if (imgFiles.length === 0) return;

    const dataUrls = await filesToDataUrls(imgFiles);
    setImageMap((prev) => [...prev, ...dataUrls]);
    const block = '\n' + dataUrls.map(() => `@imagen Imagen`).join('\n') + '\n';
    insertAtCaret(block);
  }

  function onTextareaDragOver(e) {
    // Necesario para permitir drop
    e.preventDefault();
  }

  function onTextareaKeyDown(e) {
    // Apertura del menú con '*'
    if (!menuOpen && e.key === '*') {
      e.preventDefault();
      openMenuAtCaret();
      return;
    }

    // Compat vieja
    if (!menuOpen && e.key === '*') { e.preventDefault(); setMenuOpen(true); setMenuIndex(0); setTypeBuf(''); return; }
    if (!menuOpen) return;

    if (e.key === 'ArrowDown') { e.preventDefault(); setMenuIndex(i => (i + 1) % OPTIONS.length); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setMenuIndex(i => (i - 1 + OPTIONS.length) % OPTIONS.length); return; }

    if (e.key === 'Backspace') {
      e.preventDefault();
      setTypeBuf((prev) => {
        const next = prev.slice(0, -1);
        updateIndexByTypeahead(next);
        return next;
      });
      return;
    }
    if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      const next = (typeBuf + e.key.toLowerCase());
      updateIndexByTypeahead(next);
      setTypeBuf(next);
      if (bufTimer) clearTimeout(bufTimer);
      setBufTimer(setTimeout(() => setTypeBuf(''), 1000));
      return;
    }

    if (e.key === 'Enter') { e.preventDefault(); commitSelection(OPTIONS[menuIndex]); }
    else if (e.key === 'Escape') { e.preventDefault(); setMenuOpen(false); setTypeBuf(''); if (bufTimer) clearTimeout(bufTimer); }
  }

  // ---------- Barras (grid 2×3 + Nota abajo) ----------
  const Row = ({ children }) => (
    <div className="bar row-item d-flex align-items-center gap-2 p-2 border rounded bg-light small">{children}</div>
  );

  const TextoBar = () => (
    <Row>
      <strong className="me-2">TEXTO</strong>
      <label className="d-flex align-items-center gap-2">
        Tamaño
        <input type="number" min="10" max="28" step="1"
               value={presets.texto.fontSize}
               onChange={e=>setPresets(p=>({...p, texto:{...p.texto, fontSize:Number(e.target.value)}}))}
               className="form-control form-control-sm" style={{width:70}}/> px
      </label>
      <label className="d-flex align-items-center gap-2">
        Interlineado
        <input type="number" min="1.0" max="2.0" step="0.05"
               value={presets.texto.lineHeight}
               onChange={e=>setPresets(p=>({...p, texto:{...p.texto, lineHeight:Number(e.target.value)}}))}
               className="form-control form-control-sm" style={{width:80}}/>
      </label>
      <div className="form-check">
        <input id="txt-center" className="form-check-input" type="checkbox"
               checked={!!presets.texto.center}
               onChange={e=>setPresets(p=>({...p, texto:{...p.texto, center:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="txt-center">Centrar</label>
      </div>
    </Row>
  );

  const TituloBar = () => (
    <Row>
      <strong className="me-2">TÍTULO</strong>
      <label className="d-flex align-items-center gap-2">
        Tamaño
        <input type="number" min="14" max="64" step="1"
               value={presets.titulo.fontSize}
               onChange={e=>setPresets(p=>({...p, titulo:{...p.titulo, fontSize:Number(e.target.value)}}))}
               className="form-control form-control-sm" style={{width:70}}/> px
      </label>
      <div className="form-check">
        <input id="tit-bold" className="form-check-input" type="checkbox"
               checked={!!presets.titulo.bold}
               onChange={e=>setPresets(p=>({...p, titulo:{...p.titulo, bold:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="tit-bold">Negrita</label>
      </div>
      <div className="form-check">
        <input id="tit-center" className="form-check-input" type="checkbox"
               checked={!!presets.titulo.center}
               onChange={e=>setPresets(p=>({...p, titulo:{...p.titulo, center:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="tit-center">Centrar</label>
      </div>
    </Row>
  );

  const SubtituloBar = () => (
    <Row>
      <strong className="me-2">SUBTÍTULO</strong>
      <label className="d-flex align-items-center gap-2">
        Tamaño
        <input type="number" min="12" max="48" step="1"
               value={presets.subtitulo.fontSize}
               onChange={e=>setPresets(p=>({...p, subtitulo:{...p.subtitulo, fontSize:Number(e.target.value)}}))}
               className="form-control form-control-sm" style={{width:70}}/> px
      </label>
      <div className="form-check">
        <input id="sub-bold" className="form-check-input" type="checkbox"
               checked={!!presets.subtitulo.bold}
               onChange={e=>setPresets(p=>({...p, subtitulo:{...p.subtitulo, bold:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="sub-bold">Negrita</label>
      </div>
      <div className="form-check">
        <input id="sub-center" className="form-check-input" type="checkbox"
               checked={!!presets.subtitulo.center}
               onChange={e=>setPresets(p=>({...p, subtitulo:{...p.subtitulo, center:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="sub-center">Centrar</label>
      </div>
    </Row>
  );

  const ResenaBar = () => (
    <Row>
      <strong className="me-2">RESEÑA</strong>
      <label className="d-flex align-items-center gap-2">
        Tamaño
        <input type="number" min="10" max="28" step="1"
               value={presets.resena.fontSize}
               onChange={e=>setPresets(p=>({...p, resena:{...p.resena, fontSize:Number(e.target.value)}}))}
               className="form-control form-control-sm" style={{width:70}}/> px
      </label>
      <div className="form-check">
        <input id="res-italic" className="form-check-input" type="checkbox"
               checked={!!presets.resena.italic}
               onChange={e=>setPresets(p=>({...p, resena:{...p.resena, italic:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="res-italic">Cursiva</label>
      </div>
      <label className="d-flex align-items-center gap-2">
        Color
        <input type="color"
               value={presets.resena.color}
               onChange={e=>setPresets(p=>({...p, resena:{...p.resena, color:e.target.value}}))}
               className="form-control form-control-color p-0" style={{width:40}}/>
      </label>
      <div className="form-check">
        <input id="res-center" className="form-check-input" type="checkbox"
               checked={!!presets.resena.center}
               onChange={e=>setPresets(p=>({...p, resena:{...p.resena, center:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="res-center">Centrar</label>
      </div>
    </Row>
  );

  const ListaBar = () => (
    <Row>
      <strong className="me-2">LISTA</strong>
      <label className="d-flex align-items-center gap-2">
        Tamaño
        <input type="number" min="10" max="28" step="1"
               value={presets.lista.fontSize}
               onChange={e=>setPresets(p=>({...p, lista:{...p.lista, fontSize:Number(e.target.value)}}))}
               className="form-control form-control-sm" style={{width:70}}/> px
      </label>
      <label className="d-flex align-items-center gap-2">
        Interlineado
        <input type="number" min="1.0" max="2.0" step="0.05"
               value={presets.lista.lineHeight}
               onChange={e=>setPresets(p=>({...p, lista:{...p.lista, lineHeight:Number(e.target.value)}}))}
               className="form-control form-control-sm" style={{width:80}}/>
      </label>
      <div className="form-check">
        <input id="list-center" className="form-check-input" type="checkbox"
               checked={!!presets.lista.center}
               onChange={e=>setPresets(p=>({...p, lista:{...p.lista, center:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="list-center">Centrar</label>
      </div>
    </Row>
  );

  const ResaltadoBar = () => (
    <Row>
      <strong className="me-2">RESALTADO</strong>
      <label className="d-flex align-items-center gap-2">
        Tamaño
        <input type="number" min="10" max="28" step="1"
               value={presets.resaltado.fontSize}
               onChange={e=>setPresets(p=>({...p, resaltado:{...p.resaltado, fontSize:Number(e.target.value)}}))}
               className="form-control form-control-sm" style={{width:70}}/> px
      </label>
      <label className="d-flex align-items-center gap-2">
        Texto
        <input type="color"
               value={presets.resaltado.color}
               onChange={e=>setPresets(p=>({...p, resaltado:{...p.resaltado, color:e.target.value}}))}
               className="form-control form-control-color p-0" style={{width:40}}/>
      </label>
      <label className="d-flex align-items-center gap-2">
        Fondo
        <input type="color"
               value={presets.resaltado.bgColor}
               onChange={e=>setPresets(p=>({...p, resaltado:{...p.resaltado, bgColor:e.target.value}}))}
               className="form-control form-control-color p-0" style={{width:40}}/>
      </label>
      <div className="form-check">
        <input id="resal-bold" className="form-check-input" type="checkbox"
               checked={!!presets.resaltado.bold}
               onChange={e=>setPresets(p=>({...p, resaltado:{...p.resaltado, bold:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="resal-bold">Negrita</label>
      </div>
      <div className="form-check">
        <input id="resal-center" className="form-check-input" type="checkbox"
               checked={!!presets.resaltado.center}
               onChange={e=>setPresets(p=>({...p, resaltado:{...p.resaltado, center:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="resal-center">Centrar</label>
      </div>
    </Row>
  );

  const NotaBar = () => (
    <div className="bar row-item d-flex align-items-center gap-2 p-2 border rounded bg-light small">
      <strong className="me-2">NOTA</strong>
      <label className="d-flex align-items-center gap-2">
        Tamaño
        <input type="number" min="10" max="28" step="1"
               value={presets.nota.fontSize}
               onChange={e=>setPresets(p=>({...p, nota:{...p.nota, fontSize:Number(e.target.value)}}))}
               className="form-control form-control-sm" style={{width:70}}/> px
      </label>
      <div className="form-check">
        <input id="nota-italic" className="form-check-input" type="checkbox"
               checked={!!presets.nota.italic}
               onChange={e=>setPresets(p=>({...p, nota:{...p.nota, italic:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="nota-italic">Itálica</label>
      </div>
      <label className="d-flex align-items-center gap-2">
        Color
        <input type="color"
               value={presets.nota.color}
               onChange={e=>setPresets(p=>({...p, nota:{...p.nota, color:e.target.value}}))}
               className="form-control form-control-color p-0" style={{width:40}}/>
      </label>
      <div className="form-check">
        <input id="nota-center" className="form-check-input" type="checkbox"
               checked={!!presets.nota.center}
               onChange={e=>setPresets(p=>({...p, nota:{...p.nota, center:e.target.checked}}))}/>
        <label className="form-check-label" htmlFor="nota-center">Centrar</label>
      </div>
      <span className="text-muted ms-auto">@nota</span>
    </div>
  );

  // Preview helpers
  const blocks = useMemo(() => parseBlocks(content), [content]);

  function styleForBlock(tag) {
    if (tag === 'titulo') {
      const s = presets.titulo;
      return { fontSize: `${s.fontSize}px`, fontWeight: s.bold ? 700 : 500, textAlign: s.center ? 'center' : 'left', lineHeight: 1.15, margin: '.35rem 0' };
    }
    if (tag === 'subtitulo') {
      const s = presets.subtitulo;
      return { fontSize: `${s.fontSize}px`, fontWeight: s.bold ? 700 : 600, textAlign: s.center ? 'center' : 'left', lineHeight: 1.15, margin: '.3rem 0' };
    }
    if (tag === 'resena') {
      const s = presets.resena;
      return { fontSize: `${s.fontSize}px`, fontStyle: s.italic ? 'italic' : 'normal', color: s.color || '#6c757d', textAlign: s.center ? 'center' : 'left', lineHeight: 1.2, margin: '.25rem 0' };
    }
    if (tag === 'resaltado') {
      const s = presets.resaltado;
      return { textAlign: s.center ? 'center' : 'left', margin: '.25rem 0' };
    }
    if (tag === 'nota') {
      const s = presets.nota;
      return { fontSize: `${s.fontSize}px`, fontStyle: s.italic ? 'italic' : 'normal', color: s.color, textAlign: s.center ? 'center' : 'left', lineHeight: 1.25, margin: '.25rem 0' };
    }
    const t = presets.texto;
    return { fontSize: `${t.fontSize}px`, lineHeight: t.lineHeight || 1.25, textAlign: t.center ? 'center' : 'left', margin: '0' };
  }

  function exportToPDF() { window.print(); }

  // 👉 contador para resolver placeholders secuenciales en preview
  let placeholderIndex = 0;

  return (
    <div className="h-100 d-flex flex-column">
      {/* Título + Exportar */}
      <div className="d-flex align-items-center gap-2 p-2 border-bottom">
        <input
          className="form-control form-control-lg border-0 border-bottom rounded-0 flex-grow-1"
          placeholder="Título de la nota"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); taRef.current?.focus(); }}}
        />
        <button className="btn btn-outline-secondary btn-sm no-print ms-2" onClick={exportToPDF}>
          ⬇️ Exportar PDF
        </button>
      </div>

      {/* Barras en grilla 2×3 + Nota abajo */}
      <div className="no-print px-2 py-2">
        <div className="bar-grid">
          {/* fila 1 */}
          <TituloBar />
          <ResenaBar />
          {/* fila 2 */}
          <SubtituloBar />
          <ListaBar />
          {/* fila 3 */}
          <TextoBar />
          <ResaltadoBar />
          {/* fila 4 (extra) */}
          <NotaBar />
        </div>
      </div>

      {/* Área edición + preview */}
      <div className="d-flex flex-grow-1">
        {/* Editor (izquierda) */}
        <div className="flex-grow-1 border-end position-relative no-print"
             onDrop={onTextareaDrop}
             onDragOver={onTextareaDragOver}>
          <textarea
            ref={taRef}
            className="form-control border-0 rounded-0 h-100"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            onPaste={onTextareaPaste}
            placeholder="Escribí. Tip: * y escribí el nombre de la etiqueta (texto, titulo, subtitulo, resena, lista, salto, resaltado, nota, imagen). Enter confirma.
Para imágenes: pegá una captura o arrastrá archivos; se insertará '@imagen Imagen'."
            style={{
              height: '100%',
              resize: 'none',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, \"Helvetica Neue\", Arial, sans-serif',
              fontSize: '14px',
              lineHeight: 1.25,
              padding: '10px',
            }}
          />
          {menuOpen && (
            <div
              className="position-absolute shadow-sm border bg-white rounded small"
              style={{ top: menuPos.top, left: menuPos.left, zIndex: 10, width: 300 }}
            >
              {OPTIONS.map((opt, i) => (
                <div key={opt} className={`px-2 py-1 ${i===menuIndex ? 'bg-primary text-white' : ''}`}>
                  {opt}
                </div>
              ))}
              {typeBuf && <div className="px-2 py-1 text-muted border-top">filtrando: <strong>{typeBuf}</strong></div>}
              <div className="px-2 py-1 text-muted border-top">↑ ↓ o escribí nombre • Enter confirma • Esc cierra</div>
            </div>
          )}
        </div>

        {/* Vista previa (derecha) — SOLO esto se exporta en PDF */}
        <div
          className="p-3 print-area"
          style={{
            background: '#fafafa',
            // 👉 columna derecha con ancho fijo (doc 720 + algo de padding)
            flex: '0 0 780px'
          }}
        >
          <div className="doc bg-white border rounded-3 mx-auto p-4" style={{ maxWidth: 720, minHeight: '100%' }}>
            {blocks.map((b, idx) => {
              if (b.type === 'blank') {
                const linePx = presets.texto.fontSize * (presets.texto.lineHeight || 1.25);
                return <div key={idx} style={{ height: `${linePx}px` }} />;
              }
              if (b.type === 'hr') return <hr key={idx} style={{ borderTop: '2px solid #0dcaf0', margin: '8px auto', width: '80%' }} />;
              if (b.type === 'ul') {
                const s = presets.lista;
                return (
                  <ul key={idx} style={{
                    listStyle: 'disc',
                    listStylePosition: 'inside',
                    padding: 0,
                    margin: '.25rem 0',
                    textAlign: s.center ? 'center' : 'left',
                    fontSize: `${s.fontSize}px`,
                    lineHeight: s.lineHeight,
                  }}>
                    {b.items.map((it, i2) => <li key={i2} style={{ margin: 0 }}>{it}</li>)}
                  </ul>
                );
              }
              if (b.type === 'image') {
                // Resolver src: si viene inline úsalo; si es placeholder, usa el siguiente del imageMap
                const src = b.src ?? imageMap[placeholderIndex++];
                if (!src) {
                  // Si no hay imagen disponible para este placeholder, mostramos un recuadro vacío
                  return (
                    <div key={idx} style={{ textAlign: 'center', margin: '.5rem 0' }}>
                      <div style={{
                        display: 'inline-block',
                        width: '80%',
                        padding: '32px 0',
                        border: '2px dashed #ced4da',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#6c757d'
                      }}>
                        Imagen
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={idx} style={{ textAlign: 'center', margin: '.5rem 0' }}>
                    <img
                      src={src}
                      alt=""
                      style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto', borderRadius: 6 }}
                    />
                  </div>
                );
              }
              if (b.tag === 'resaltado') {
                const s = presets.resaltado;
                return (
                  <div key={idx} style={styleForBlock('resaltado')}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: `${s.fontSize}px`,
                      fontWeight: s.bold ? 700 : 500,
                      fontStyle: s.italic ? 'italic' : 'normal',
                      color: s.color,
                      background: s.bgColor,
                      lineHeight: 1.25,
                      padding: '2px 6px',
                      borderRadius: 6,
                    }}>
                      {b.text}
                    </span>
                  </div>
                );
              }
              if (b.tag === 'resena') {
                const inline = renderInlineWithHighlight(b.text, presets.resaltado);
                return (
                  <div key={idx} style={styleForBlock(b.tag)}>
                    <span>“</span>{inline}<span>”</span>
                  </div>
                );
              }
              if (b.tag === 'nota') {
                const inline = renderInlineWithHighlight(b.text, presets.resaltado);
                return (
                  <div key={idx} style={styleForBlock('nota')}>
                    <em>Nota: </em>{inline}
                  </div>
                );
              }
              const inline = renderInlineWithHighlight(b.text, presets.resaltado);
              return <div key={idx} style={styleForBlock(b.tag)}>{inline}</div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
