import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ivory: "#fbf7ef",
        champagne: "#d8b977",
        graphite: "#2f2a24",
        sage: "#7f8b75"
      }
    }
  },
  plugins: []
};

export default config;
