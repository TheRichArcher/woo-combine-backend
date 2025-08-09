export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--color-primary)',
          secondary: 'var(--color-secondary)',
          accent: 'var(--color-accent)',
          contrast: 'var(--color-contrast)',
          light: 'var(--color-light)'
        },
        // Back-compat alias (to be removed after refactor): cmf-* → brand-*
        cmf: {
          primary: 'var(--color-primary)',
          secondary: 'var(--color-secondary)',
          accent: 'var(--color-accent)',
          contrast: 'var(--color-contrast)',
          light: 'var(--color-light)'
        },
        semantic: {
          info: 'var(--color-info)',
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          error: 'var(--color-error)'
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          subtle: 'var(--color-surface-subtle)'
        },
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)'
        },
        border: {
          DEFAULT: 'var(--color-border)'
        }
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        lg: 'var(--radius-md)',
        xl: 'var(--radius-lg)'
      },
    },
  },
  plugins: [],
}; 