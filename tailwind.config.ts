import type { Config } from 'tailwindcss';

/**
 * Colour tokens are chosen to meet WCAG 2.1 AA contrast against their intended
 * backgrounds (>= 4.5:1 for body text, >= 3:1 for large text and UI components).
 * `brand` 600+ on white and white on `brand` 600+ both pass AA. Matches the
 * church's maroon brand colour (see logo).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbeef1',
          100: '#f6d6dd',
          200: '#eaadbc',
          300: '#dc7f97',
          400: '#c85272', // AA on slate-950 for dark-mode focus ring (>= 3:1)
          500: '#a8355a',
          600: '#8c2749', // AA on white for large text (>= 3:1)
          700: '#701d3a', // AA on white for body text (>= 4.5:1)
          800: '#57172e',
          900: '#421222',
        },
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};

export default config;
