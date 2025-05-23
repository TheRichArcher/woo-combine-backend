import React from 'react';

export default function Navigation() {
  return (
    <nav style={{ backgroundColor: 'red', padding: '16px' }}>
      <a href="/dashboard" style={{ color: 'white', marginRight: '20px' }}>Dashboard</a>
      <a href="/players" style={{ color: 'white' }}>Players</a>
    </nav>
  );
} 