import React from 'react';

export default function Select({ className = '', children, ...props }) {
  const base = 'w-full border border-brand-primary/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary bg-surface text-text';
  return (
    <select className={[base, className].join(' ')} {...props}>
      {children}
    </select>
  );
}


