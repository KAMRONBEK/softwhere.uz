# softwhere.uz portfolio videos

Remotion project that renders the silent walkthrough videos shown in the website's portfolio slider
(`../public/videos/<slug>.mp4`). Full guide: [`../docs/portfolio-videos.md`](../docs/portfolio-videos.md).

```bash
yarn install
yarn studio                                  # preview every project
yarn -s validate                             # schema-check all configs
node scripts/render.mjs --only=talim-ai      # render one (omit --only for all)
```

One data file per video lives in `src/projects/<slug>.json`; its material lives in
`public/projects/<slug>/`.
