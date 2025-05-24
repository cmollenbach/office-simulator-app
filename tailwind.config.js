// c:/Users/chris/Documents/office-simulator-app/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx,html}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      typography: ({ theme }) => ({
        DEFAULT: { // This targets the base .prose class
          css: {
            maxWidth: 'none', // Override the default max-width
            // If the text elements inside .prose still don't go full width,
            // you might need to explicitly target them here too:
            p: { maxWidth: 'none' },
            ul: { maxWidth: 'none' },
            ol: { maxWidth: 'none' },
            h1: { maxWidth: 'none' },
            h2: { maxWidth: 'none' },
            h3: { maxWidth: 'none' },
            h4: { maxWidth: 'none' },
            h5: { maxWidth: 'none' },
            h6: { maxWidth: 'none' },
            blockquote: { maxWidth: 'none' },
            pre: { maxWidth: 'none' },
            table: { maxWidth: 'none' },
            figure: { maxWidth: 'none' },
            figcaption: { maxWidth: 'none' },
            // Add any other elements you see being constrained
          },
        },
        // You can also do this for responsive variants if needed, e.g.:
        // sm: { css: { maxWidth: 'none', p: {maxWidth: 'none'} /* etc. */ } },
        // lg: { css: { maxWidth: 'none', p: {maxWidth: 'none'} /* etc. */ } },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}