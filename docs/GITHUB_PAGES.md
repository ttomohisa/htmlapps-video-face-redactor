# GitHub Pages deployment guide

This repository builds the fully embedded Video Face Redactor HTML with GitHub Actions and publishes `dist/` to GitHub Pages.

Expected URL:

```text
https://ttomohisa.github.io/htmlapps-video-face-redactor/
```

## 1. Enable GitHub Pages once

1. Open the repository on GitHub.
2. Open **Settings -> Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

Do not select a branch `/root` or `/docs` publishing source. The workflow publishes the generated `dist/` artifact.

## 2. Deploy

Either:

- push to `main`, or
- open **Actions -> Deploy standalone app to GitHub Pages -> Run workflow**.

The workflow:

1. checks out the repository,
2. restores the pinned MP4Box.js cache when available,
3. runs repository checks,
4. builds `dist/index.html` and the self-extracting HTML,
5. verifies that Pages is enabled,
6. uploads `dist/` as the Pages artifact, and
7. deploys it to the `github-pages` environment.

If Pages has not been enabled yet, the build still succeeds and the deployment is skipped with setup instructions in the workflow summary.

## 3. Verify the deployment

After the deploy job succeeds, open:

```text
https://ttomohisa.github.io/htmlapps-video-face-redactor/
```

The first page load comes from GitHub Pages. Videos selected afterward are processed locally in the browser and are not uploaded by the app.

## Updates

Normal updates only require a push to `main`. The Pages workflow rebuilds the generated HTML from source and pinned dependencies, so `dist/index.html` does not need to be committed manually.

Pull requests are validated by `build-standalone.yml`; Pages deployment runs from `main` or manual workflow dispatch.

## Troubleshooting

### The Pages URL returns 404

- Confirm **Settings -> Pages -> Source** is **GitHub Actions**.
- Confirm **Deploy standalone app to GitHub Pages** completed successfully.
- Wait briefly after the first deployment and reload the page.

### `configure-pages` reports that the Pages site does not exist

Enable Pages once from **Settings -> Pages -> GitHub Actions**, then rerun the workflow. The deployment workflow checks this before calling `configure-pages` so a missing one-time setting does not make the build itself fail.

### Dependency download fails

The build downloads the exact MP4Box.js version pinned in `dependencies.json`. A transient network error can usually be handled by rerunning the workflow.
