import React from 'react';

export default function Sidebar({ items, selectedId, onSelect, isOpen, onToggle }) {
  const WIDTH_OPEN = 320;
  const WIDTH_COLLAPSED = 36;

  return (
    <aside
      className="border-end h-100 d-flex flex-column bg-white position-relative"
      aria-expanded={isOpen}
      style={{
        width: isOpen ? WIDTH_OPEN : WIDTH_COLLAPSED,
        transition: 'width 180ms ease',
      }}
    >
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between p-2 border-bottom bg-light">
        {isOpen ? (
          <>
            <strong className="m-0">Notas</strong>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={onToggle}
              title="Ocultar panel de notas"
              aria-label="Ocultar panel de notas"
            >
              ⟨ Ocultar
            </button>
          </>
        ) : (
          <button
            className="btn btn-sm btn-outline-secondary w-100"
            onClick={onToggle}
            title="Mostrar panel de notas"
            aria-label="Mostrar panel de notas"
          >
            ⟩
          </button>
        )}
      </div>

      {/* Lista (se oculta visualmente al colapsar) */}
      <div
        className="list-group list-group-flush flex-grow-1 overflow-auto"
        aria-hidden={!isOpen}
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transform: isOpen ? 'translateX(0)' : 'translateX(-8px)',
          transition: 'opacity 160ms ease, transform 160ms ease',
        }}
      >
        {items.map((n) => (
          <button
            key={n.id}
            className={`list-group-item list-group-item-action ${selectedId === n.id ? 'active' : ''}`}
            onClick={() => onSelect(n.id)}
            title={n.title || 'Sin título'}
          >
            <div className="fw-semibold text-truncate">{n.title || 'Sin título'}</div>
            <div className="small text-truncate text-muted">
              {new Date(n.updatedAt).toLocaleString()}
            </div>
          </button>
        ))}
        {!items.length && (
          <div className="text-center text-muted p-3 small">No hay notas</div>
        )}
      </div>
    </aside>
  );
}
