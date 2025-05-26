// c:/Users/chris/Documents/office-simulator-app/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx,html}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        signatureBlue: '#002346',
        actionBlue: '#0069FA',
        oceanBlue: '#003778', // Was Blue 1
        skyBlue: '#4673C3',   // Was Blue 2
        iceBlue: '#87AAE1',   // Was Blue 3
        mistBlue: '#B9C8E6',  // Was Blue 4

        desertSand: '#968C73', // Was Sand 1
        beachSand: '#CDC8B4',  // Was Sand 2
        lightSand: '#EBEBE6',  // Was Sand 3
        // White: '#FFFFFF' is a default Tailwind color
      },

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