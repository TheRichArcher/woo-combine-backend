import React from 'react';

export default function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-surface-subtle rounded ${className}`} />
  );
}


