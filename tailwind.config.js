/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{mdx,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            blockquote: {
              quotes: "none"
            }
          },
        }
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
