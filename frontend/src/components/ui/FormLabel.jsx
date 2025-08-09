import React from 'react';

export default function FormLabel({ children, required = false, className = '', htmlFor }) {
  return (
    <label htmlFor={htmlFor} className={["block text-sm font-medium text-text mb-1", className].join(' ')}>
      {children} {required ? <span className="text-semantic-error">*</span> : null}
    </label>
  );
}


