/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070709',
          900: '#0c0c0f',
          850: '#121216',
          800: '#18181f',
          750: '#202029',
          700: '#292934',
          600: '#3a3a49',
          500: '#525266',
        },
        oxblood: {
          950: '#230505',
          900: '#3b0808',
          800: '#570e0e',
          700: '#781515',
          600: '#9b1e1e',
          500: '#bf2a2a',
        },
        bronze: {
          950: '#1f1508',
          900: '#33230c',
          800: '#4e3713',
          700: '#704f1a',
          600: '#946a25',
          500: '#b88533',
          400: '#d4a24c',
          300: '#e5be75',
          200: '#f2dca6',
        },
        parchment: {
          900: '#383227',
          800: '#544c3c',
          700: '#7a705b',
          600: '#9c9077',
          400: '#c7bca5',
          300: '#ded5c3',
          200: '#ede6d8',
          100: '#f6f2ea',
        }
      },
      fontFamily: {
        display: ['Cinzel Decorative', 'serif'],
        serif: ['Cinzel', 'Georgia', 'serif'],
        reading: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
