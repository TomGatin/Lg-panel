/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Tokens from the "Gravure A · Almanach" / "Flat A" mock-ups.
      colors: {
        ink: '#0C0B0A',
        surface: '#161411',
        panel: '#191613',
        tile: '#25211C',
        rule: '#3B352C',
        bone: { DEFAULT: '#ECE4D3', dim: '#CFC6B3' },
        muted: '#A89F8E',
        faint: '#6E665A',
        blood: { DEFAULT: '#9E2B25', deep: '#2B0F0C', go: '#C0392B', text: '#DB6A5E' },
        ok: '#7CC08A'
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
