# Chroma Glass

An interactive glass-circle gradient studio built with React, TypeScript, and Vite.

## Local development

```sh
pnpm install
pnpm dev
```

## Production build

```sh
pnpm lint
pnpm build
```

The build output is written to `dist/`.

## GitHub Pages

The `Deploy to GitHub Pages` workflow builds the site and publishes `dist/` whenever a commit is pushed to `main`. In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**.

The Vite base path is configured for the project site at `https://adij-design.github.io/Chroma-Glass/`.
