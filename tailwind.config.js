/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff5f0',
          100: '#ffe8dc',
          200: '#ffd0b8',
          300: '#ffb088',
          400: '#ff8a4c',
          500: '#c84200',
          600: '#b03a00',
          700: '#8f2f00',
          800: '#9c2a05',
          900: '#7d250a',
        },
        qn: {
          50: '#eef4ff',
          100: '#dbe7ff',
          200: '#bfd3ff',
          300: '#93b4ff',
          400: '#5f8cff',
          500: '#2f5fe8',
          600: '#2448cc',
          700: '#1d3aa8',
          800: '#2234b1',
          900: '#21328b',
        },
        ink: {
          50: '#f7f8fa',
          100: '#f0f2f5',
          200: '#e4e7ec',
          300: '#d0d5dd',
          400: '#5f6b7c',
          500: '#5b6578',
          600: '#475467',
          700: '#344054',
          800: '#1d2939',
          900: '#101828',
        },
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'system-ui', 'sans-serif'],
        num: ['"DIN Alternate"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        float: '0 8px 24px rgba(16,24,40,.12)',
        pop: '0 12px 40px rgba(16,24,40,.18)',
      },
      borderRadius: { xl2: '14px' },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        marquee: { '0%': { transform: 'translateY(0)' }, '100%': { transform: 'translateY(-50%)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: {
        fadeUp: 'fadeUp .35s ease both',
        marquee: 'marquee 12s linear infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
