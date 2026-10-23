# Chroma Glass

Chroma Glass is a browser-based interactive art studio. Move the pointer across a field of glass-like circles to paint a soft two-color gradient. The canvas also supports idle motion, optional palette cycling, bubble audio, recording, and still-image export.

**Live site:** <https://adij-design.github.io/Chroma-Glass/>

## Built with

- React and TypeScript
- Vite
- HTML Canvas 2D
- MediaRecorder and Web Audio browser APIs

The app runs entirely in the browser; it does not need a backend, account, or database.

## Requirements

- Node.js 22 (the GitHub Pages workflow uses Node 22)
- pnpm 10

## Run locally

```sh
git clone https://github.com/adij-design/Chroma-Glass.git
cd Chroma-Glass
pnpm install
pnpm dev
```

Vite prints the local development URL in the terminal.

## Check a production build

```sh
pnpm lint
pnpm build
pnpm preview
```

The production site is generated in `dist/`. `pnpm preview` serves that build locally so you can check it before publishing. Do not commit `dist/`; GitHub Actions builds it during deployment.

## Publish to GitHub Pages

This repository includes [a GitHub Actions workflow](./.github/workflows/deploy.yml). It installs dependencies from `pnpm-lock.yaml`, runs the production build, and deploys `dist/` whenever code is pushed to `main`. It can also be started manually from the repository's **Actions** tab.

1. Open the repository on GitHub: <https://github.com/adij-design/Chroma-Glass>.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Push changes to `main`:

   ```sh
   git add .
   git commit -m "Describe your change"
   git push origin main
   ```

5. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish successfully.
6. Visit <https://adij-design.github.io/Chroma-Glass/>. The first deployment may take a few minutes to appear.

GitHub CLI or Git credentials must be configured locally before `git push` can authenticate. Never put a personal access token in a source file or commit it to the repository.

### If GitHub Pages shows a blank page

- Confirm **Settings → Pages → Source** is set to **GitHub Actions**, not branch/folder publishing.
- Check **Actions → Deploy to GitHub Pages** and resolve any failed build or deploy step.
- Make sure the project URL remains `https://adij-design.github.io/Chroma-Glass/`. Vite's `base` path is set to `/Chroma-Glass/` in [`vite.config.ts`](./vite.config.ts) so compiled JavaScript and CSS load from the project site.
- If the repository name changes, update the Vite `base` path to match the new project URL and push again.

## Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm lint` | Run Oxlint |
| `pnpm build` | Type-check and create the production build |
| `pnpm preview` | Serve the production build locally |
