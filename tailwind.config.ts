import type { Config } from 'tailwindcss';

// Tokens recorded from design/reference/*.webp (Tripsy iPhone screenshots). Surface and
// label colors are CSS variables in client/src/index.css so light/dark mode swap them.
export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI Variable Text"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI Variable Display"', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        'card-2': 'rgb(var(--card-2) / <alpha-value>)',
        fill: 'rgb(var(--fill) / <alpha-value>)',
        label: 'rgb(var(--label) / <alpha-value>)',
        'label-2': 'rgb(var(--label-2) / <alpha-value>)',
        'label-3': 'rgb(var(--label-3) / <alpha-value>)',
        separator: 'rgb(var(--separator) / <alpha-value>)',
        // Accent: the orange of "View All Days" / the add button.
        accent: { DEFAULT: '#FF7A1A', soft: '#FF7A1A26' },
        danger: '#FF3B30',
        success: '#34C759',
        // Category colors (icon tint; badges use a 15% fill of the same color).
        cat: {
          flight: '#1E9BF5',
          transport: '#2F6BFF',
          lodging: '#C03CF0',
          place: '#F5225A',
          restaurant: '#FF8A00',
          museum: '#E5197E',
          shopping: '#F8B500',
          bar: '#F59E0B',
          bakery: '#D97706',
          music: '#E11D48',
          nature: '#30B651',
          expense: '#8E8E93',
          itinerary: '#F97316',
        },
      },
      borderRadius: {
        card: '22px',
        sheet: '28px',
        pill: '999px',
        badge: '10px',
      },
      boxShadow: {
        sheet: '0 24px 80px -12px rgb(0 0 0 / 0.45)',
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 4px 16px rgb(0 0 0 / 0.04)',
      },
      fontSize: {
        'large-title': ['34px', { lineHeight: '41px', fontWeight: '700', letterSpacing: '0.01em' }],
        'title-1': ['28px', { lineHeight: '34px', fontWeight: '700' }],
        'title-2': ['22px', { lineHeight: '28px', fontWeight: '700' }],
        'title-3': ['20px', { lineHeight: '25px', fontWeight: '600' }],
        headline: ['17px', { lineHeight: '22px', fontWeight: '600' }],
        body: ['17px', { lineHeight: '22px' }],
        callout: ['16px', { lineHeight: '21px' }],
        subhead: ['15px', { lineHeight: '20px' }],
        footnote: ['13px', { lineHeight: '18px' }],
        caption: ['12px', { lineHeight: '16px' }],
      },
      spacing: { sidebar: '300px' },
    },
  },
  plugins: [],
} satisfies Config;
