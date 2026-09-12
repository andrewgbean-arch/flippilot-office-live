/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: "#FFD700",
        goldDeep: "#B8860B",
        flipBlue: "#0A1128",
        flipBlueSoft: "#0F1A3A",
        flipDark: "#050A18",
        flipWhite: "#FFFFFF",
        flipGlass: "rgba(255,255,255,0.08)",
        flipGlassGold: "rgba(255,215,0,0.08)",
        flipGlassBlue: "rgba(10,17,40,0.25)",
      },

      borderColor: {
        DEFAULT: "#FFD700",
      },

      backgroundColor: {
        screen: "#0A1128",
        card: "rgba(10,17,40,0.65)",
        cardSoft: "rgba(10,17,40,0.45)",
      },

      boxShadow: {
        goldGlow: "0 0 25px rgba(255, 215, 0, 0.45)",
        goldGlowSoft: "0 0 15px rgba(255, 215, 0, 0.25)",
        blueGlow: "0 0 25px rgba(10, 17, 40, 0.6)",
        blueGlowSoft: "0 0 15px rgba(10, 17, 40, 0.4)",
      },

      backgroundImage: {
        heroGradient:
          "linear-gradient(135deg, rgba(255,215,0,0.25), rgba(10,17,40,0.9))",
      },

      animation: {
        fadeIn: "fadeIn 0.6s ease-out",
        slideUp: "slideUp 0.6s ease-out",
        shine: "shine 2.5s ease-in-out infinite",
        spin: "spin 6s linear infinite",
        supernovaPulse: "supernovaPulse 2.2s ease-in-out infinite",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        slideUp: {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        shine: {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        supernovaPulse: {
          "0%": { opacity: 0.4, transform: "scale(1)" },
          "50%": { opacity: 0.9, transform: "scale(1.05)" },
          "100%": { opacity: 0.4, transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
