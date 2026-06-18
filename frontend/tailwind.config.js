/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        af: {
          bg:         '#080B14',
          card:       '#0F1623',
          border:     '#1E293B',
          footer:     '#050810',
          cream:      '#E8E4DC',
          blue:       '#0090FF',
          'blue-h':   '#007AE6',
          cyan:       '#06D6A0',
          text:       '#F1F5F9',
          muted:      '#94A3B8',
        },
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
