/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        luckiest: ["Luckiest Guy", "Josefin Sans"], // Add the Google Font here
        josfin: ["Josefin Sans"],
      },
    },
  },
  plugins: [],
};
