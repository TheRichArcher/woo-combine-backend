import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Dialog({ title, children, onClose, footer = null, size = 'md' }) {
  useEffect(() => {
    function handleEsc(e) { if (e.key === 'Escape') onClose?.(); }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const sizeClass = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`bg-surface rounded-xl shadow-xl w-full ${sizeClass} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-lg transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}


