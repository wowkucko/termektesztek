import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F2F4F1',
        ink: '#12191A',
        signal: {
          DEFAULT: '#E8542A',
          50: '#FDEEE8',
          100: '#FBDDD1',
          400: '#EF7A54',
          500: '#E8542A',
          600: '#C4421D',
          700: '#9A3417',
        },
        teal: {
          DEFAULT: '#0E6E63',
          50: '#E6F1EF',
          100: '#CCE3DF',
          500: '#0E6E63',
          600: '#0A5850',
          700: '#08423C',
        },
        amber: {
          DEFAULT: '#F0A202',
          500: '#F0A202',
          600: '#C98600',
        },
        pro: '#1FAA59',
        con: '#E14B4B',
        line: '#DCE0DA',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        chip: '999px',
        tight: '8px',
      },
      boxShadow: {
        card: '0 12px 32px -16px rgba(14, 110, 99, 0.28)',
        stamp: '0 8px 24px -6px rgba(232, 84, 42, 0.45)',
      },
      maxWidth: {
        prose: '68ch',
      },
      keyframes: {
        stampIn: {
          '0%': { transform: 'scale(1.3) rotate(-8deg)', opacity: '0' },
          '60%': { transform: 'scale(0.96) rotate(2deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-4deg)', opacity: '1' },
        },
      },
      animation: {
        stampIn: 'stampIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
