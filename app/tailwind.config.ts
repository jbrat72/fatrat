import type { Config } from 'tailwindcss';

/** Use rgb(var(--token) / <alpha>) so utilities like bg-accent/20 work. */
const rgb = (cssVar: string) => `rgb(var(${cssVar}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: rgb('--color-bg'),
          card:    rgb('--color-bg-card'),
          elev:    rgb('--color-bg-elev'),
          input:   rgb('--color-bg-input'),
        },
        accent: {
          DEFAULT: rgb('--color-accent'),
          hot:     rgb('--color-accent-hot'),
          dim:     rgb('--color-accent-dim'),
        },
        ok:     rgb('--color-ok'),
        warn:   rgb('--color-warn'),
        info:   rgb('--color-info'),
        danger: rgb('--color-danger'),
        ink: {
          DEFAULT: rgb('--color-ink'),
          dim:  rgb('--color-ink-dim'),
          mute: rgb('--color-ink-mute'),
          line: rgb('--color-ink-line'),
        },
        // Muscle badges stay constant across themes (white text on saturated bg).
        muscle: {
          chest: '#a855f7',
          back: '#3b82f6',
          shoulders: '#ec4899',
          arms: '#f59e0b',
          biceps: '#f97316',
          triceps: '#ef4444',
          legs: '#22c55e',
          quads: '#22c55e',
          hamstrings: '#16a34a',
          glutes: '#10b981',
          calves: '#84cc16',
          core: '#eab308',
          forearms: '#8b5cf6',
          neck: '#64748b',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: { '2xs': ['0.6875rem', { lineHeight: '1rem' }] },
      letterSpacing: { wider2: '0.08em', widest2: '0.16em' },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--color-accent)), 0 0 18px rgb(var(--color-accent) / 0.35)',
        card: 'var(--shadow-card)',
      },
      borderRadius: { card: '14px' },
      keyframes: {
        pulseRed: {
          '0%,100%': { boxShadow: '0 0 0 0 rgb(var(--color-accent) / 0.55)' },
          '50%':     { boxShadow: '0 0 0 8px rgb(var(--color-accent) / 0)' },
        },
      },
      animation: { pulseRed: 'pulseRed 1.6s ease-out infinite' },
    },
  },
  plugins: [],
};

export default config;
