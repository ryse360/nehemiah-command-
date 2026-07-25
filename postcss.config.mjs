// Tailwind v4 via its PostCSS plugin. Added as an ADDITIVE primitive layer
// (shadcn/ui) only — see src/app/tailwind.css, which imports utilities
// WITHOUT Preflight so no global reset runs against the existing CSS.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
