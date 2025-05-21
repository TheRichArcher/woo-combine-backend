export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cmf: {
          primary: '#19c3e6', // bright teal/aqua
          secondary: '#008fa3', // deep cyan/turquoise
          accent: '#ffffff', // white
          contrast: '#111111', // black/dark gray
          light: '#f5f6fa', // light gray background
        },
      },
    },
  },
  plugins: [],
}; 