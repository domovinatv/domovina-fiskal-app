import type { Config } from "tailwindcss";

// DOMOVINA brand (isti kao fiskal.domovina.ai /admin i pipeline.domovina.ai):
// navy #002F6C primarna, red #FF0000 naglasak, muted #5A6570 body.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#002F6C",
        crvena: "#FF0000",
        muted: "#5A6570",
        rub: "#E1E5EA",
        povrsina: "#F5F7F9",
        uspjeh: "#2E8540",
        upozorenje: "#B45309",
        opasnost: "#B42318",
      },
    },
  },
  plugins: [],
};

export default config;
