import React from 'react';

export default function Input({ className = '', ...props }) {
  const base = 'w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary bg-surface text-text placeholder:text-text-muted';
  return <input className={[base, className].join(' ')} {...props} />;
}


