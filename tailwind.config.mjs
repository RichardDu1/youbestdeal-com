/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#ec4899',
          600: '#db2777',
        },
        dark: '#050505',
        card: '#111111',
      },
      animation: {
        blob: "blob 10s infinite",
        "fade-in-up": "fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)", opacity: "0.2" },
          "33%": { transform: "translate(40px, -60px) scale(1.1)", opacity: "0.3" },
          "66%": { transform: "translate(-30px, 30px) scale(0.9)", opacity: "0.1" },
          "100%": { transform: "translate(0px, 0px) scale(1)", opacity: "0.2" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}