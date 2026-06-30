import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
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
    },
  },
  plugins: [],
};

export default config;
