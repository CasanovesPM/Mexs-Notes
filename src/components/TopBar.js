import React, { useRef, useState, useEffect } from 'react';
import { exportNotes, importNotes } from '../utils/exportImport';

export default function TopBar({ onNew, onSave, onDelete, disabled, onSearch }) {
  const fileRef = useRef(null);
  const [showHelp, setShowHelp] = useState(false);

  const openHelp = () => setShowHelp(true);
  const closeHelp = () => setShowHelp(false);

  // Cerrar con ESC y bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (!showHelp) return;
    const onKey = (e) => { if (e.key === 'Escape') closeHelp(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showHelp]);

  return (
    <>
      <div className="d-flex gap-2 align-items-center p-2 border-bottom bg-light">
        <button className="btn btn-primary btn-sm" onClick={onNew}>➕ Nueva</button>
        <button className="btn btn-success btn-sm" onClick={onSave} disabled={disabled}>💾 Guardar</button>
        <button className="btn btn-outline-danger btn-sm" onClick={onDelete} disabled={disabled}>🗑️ Eliminar</button>

        <div className="vr mx-2" />
        <button className="btn btn-outline-secondary btn-sm" onClick={exportNotes}>⬇️ Exportar</button>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => fileRef.current?.click()}>⬆️ Importar</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="d-none"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              await importNotes(f);
              window.location.reload();
            } catch {
              alert('Archivo de importación inválido');
            }
          }}
        />

        {/* Botón de Instructivo, a la derecha de Importar */}
        <button className="btn btn-outline-info btn-sm" onClick={openHelp}>📘 Instructivo de Uso</button>

        <div className="ms-auto" style={{ maxWidth: 280 }}>
          <input
            className="form-control form-control-sm"
            placeholder="Buscar..."
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
      </div>

      {/* Modal de ayuda */}
      {showHelp && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeHelp}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
              zIndex: 1050
            }}
          />
          {/* Caja */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Instructivo de Uso"
            style={{
              position: 'fixed', inset: 0, zIndex: 1060,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16
            }}
          >
            <div className="bg-white rounded-3 shadow" style={{ width: 'min(880px, 96vw)', maxHeight: '90vh', overflow: 'auto' }}>
              <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
                <h5 className="m-0">Instructivo de Uso</h5>
                <button className="btn-close" aria-label="Cerrar" onClick={closeHelp} />
              </div>
              <div className="p-3">
                <h6>Panel izquierdo (editor de texto)</h6>
                <ul className="mb-3">
                  <li>Escribí normalmente. Las <strong>líneas en blanco</strong> (Enter) se ven como saltos reales en la vista previa.</li>
                  <li>Presioná <strong>*</strong> para abrir el menú de etiquetas. Empezá a <strong>escribir el nombre</strong> y <kbd>Enter</kbd> para aplicar a la línea actual.
                    <div className="text-muted small mt-1">También podés usar ↑ ↓ para navegar y <kbd>Esc</kbd> para cerrar.</div>
                  </li>
                  <li>Etiquetas disponibles:
                    <ul className="mt-1">
                      <li><code>@texto</code> — párrafo estándar.</li>
                      <li><code>@titulo</code> — encabezado grande.</li>
                      <li><code>@subtitulo</code> — encabezado mediano.</li>
                      <li><code>@resena</code> — se muestra entre comillas: “…”.</li>
                      <li><code>@lista</code> — cada línea <code>@lista …</code> agrega un ítem.</li>
                      <li><code>@salto</code> — separador (línea). </li>
                      <li><code>@resaltado</code> — bloque resaltado.</li>
                      <li><code>@nota</code> — muestra <em>Nota:</em> en itálica + tu texto.</li>
                    </ul>
                  </li>
                  <li><strong>Resaltado inline</strong> dentro de cualquier etiqueta:
                    <div className="mt-1">
                      Escribí <code>@resaltar Palabra</code> o <code>@resaltar "frase entera"</code> y sólo ese fragmento queda resaltado.
                    </div>
                  </li>
                </ul>

                <h6>Barras de estilo (arriba del editor)</h6>
                <ul className="mb-3">
                  <li>Configurá <em>tamaño</em>, <em>interlineado</em>, <em>negrita/itálica</em>, <em>color</em> y <em>centrado</em> por etiqueta (Título, Subtítulo, Reseña, Texto, Lista, Resaltado y Nota).</li>
                  <li>La configuración se <strong>guarda</strong> automáticamente en tu navegador (localStorage).</li>
                  <li>Orden en grilla: <strong>Título | Reseña</strong> — <strong>Subtítulo | Lista</strong> — <strong>Texto | Resaltado</strong> — <strong>Nota</strong>.</li>
                </ul>

                <h6>Exportar / Importar / PDF</h6>
                <ul className="mb-3">
                  <li><strong>Exportar</strong> guarda todas tus notas a un .json.</li>
                  <li><strong>Importar</strong> restaura desde un .json exportado.</li>
                  <li><strong>Exportar PDF</strong> imprime <u>solo</u> el panel derecho (caja final) en tamaño <strong>A4</strong>.</li>
                </ul>

                <h6>Atajos útiles</h6>
                <ul className="mb-3">
                  <li><kbd>*</kbd> abre el menú de etiquetas, escribí el nombre y <kbd>Enter</kbd>.</li>
                  <li><kbd>↑</kbd>/<kbd>↓</kbd> navega opciones; <kbd>Esc</kbd> cierra.</li>
                  <li><kbd>Ctrl</kbd>+<kbd>S</kbd> guarda la nota actual.</li>
                </ul>

                <h6 className="mb-2">Ejemplo rápido</h6>
                <pre className="p-2 bg-light rounded border" style={{ whiteSpace: 'pre-wrap' }}>
{`@titulo Mi Apunte
@resena "Definición clave"
@texto Un párrafo cualquiera.
@lista Item 1
@lista Item 2
@texto Palabra @resaltar "importante".
@nota revisar mañana.`}
                </pre>
              </div>
              <div className="p-3 border-top d-flex justify-content-end gap-2">
                <button className="btn btn-secondary" onClick={closeHelp}>Cerrar</button>
                <button className="btn btn-primary" onClick={closeHelp}>Entendido</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
