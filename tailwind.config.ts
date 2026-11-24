import type { Config } from "tailwindcss";

const config: Config = {
  // All source lives under src/; the legacy ./pages, ./components and ./app
  // globs pointed at directories that don't exist.
  content: ['./src/**/*.{ts,tsx}'],
  prefix: '',
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      // The old site's names, on the look's tokens (src/app/globals.css).
      colors: {
        ember: {
          bg: 'var(--bg)',
          surface: 'var(--surface)',
          surface2: 'var(--surface2)',
          border: 'var(--border)',
          text: 'var(--text)',
          muted: 'var(--muted)',
          accent: 'var(--accent)',
          accent2: 'var(--accent2)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
