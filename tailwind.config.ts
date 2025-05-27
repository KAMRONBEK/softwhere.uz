import type { Config } from "tailwindcss";

const config: Config = {
  // Removed darkMode config
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    // Removed container and extend blocks
    extend: {
      // Kept original backgroundImage extensions just in case
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    }
  },
  plugins: [], // Removed tailwindcss-animate
};

export default config;
