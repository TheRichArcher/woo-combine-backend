import React from 'react';

const variantToClasses = {
  primary: 'bg-brand-primary text-white hover:opacity-90 focus:ring-2 focus:ring-brand-primary/30',
  secondary: 'bg-brand-secondary text-white hover:opacity-90 focus:ring-2 focus:ring-brand-primary/30',
  outline: 'bg-transparent text-brand-primary border border-brand-primary hover:bg-brand-primary/5 focus:ring-2 focus:ring-brand-primary/30',
  subtle: 'bg-surface-subtle text-text hover:bg-brand-primary/5 focus:ring-2 focus:ring-brand-primary/30',
  danger: 'bg-semantic-error text-white hover:opacity-90 focus:ring-2 focus:ring-semantic-error/30',
  success: 'bg-semantic-success text-white hover:opacity-90 focus:ring-2 focus:ring-semantic-success/30',
};

const sizeToClasses = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-5 py-2.5',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  as: AsComponent,
  to,
  href,
  type = 'button',
  ...rest
}) {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  let classes = [base, variantToClasses[variant], sizeToClasses[size], className]
    .filter(Boolean)
    .join(' ');

  // If rendering as a Link/anchor, emulate disabled state with styles/attributes
  if (disabled && AsComponent && AsComponent !== 'button') {
    classes += ' pointer-events-none opacity-50';
  }

  if (AsComponent && AsComponent !== 'button') {
    const Component = AsComponent;
    return (
      <Component to={to} href={href} className={classes} aria-disabled={disabled} {...rest}>
        {children}
      </Component>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}


