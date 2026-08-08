# Hero video

Drop the homepage background video here as **`hero.mp4`** (and optionally
`hero.webm`, which the browser prefers when present). Nothing else needs to
change — `VideoHero` picks it up automatically.

If you would rather serve it from a CDN, set `VITE_HERO_VIDEO_URL` instead and
leave this folder empty.

## What the hero does without a video

The hero never depends on this file. A CSS backdrop (layered gradients, a faint
grid and a slow drift) paints on the first frame, so the page has no empty box,
no layout shift and no image request. The video, when present, fades in over the
top once it is actually playing.

It is also deliberately **not** loaded when:

- the visitor has `prefers-reduced-motion: reduce` set,
- the connection reports `saveData`, or an effective type of `2g` / `3g`,
- the viewport is narrower than 768px — a multi-megabyte background on a phone
  on mobile data is not a cost worth imposing.

## Encoding guidance

Keep it small; this is decoration sitting behind text.

```bash
# ~1080p, no audio, tuned for a short seamless loop
ffmpeg -i source.mov -an -vf "scale=1920:-2,fps=25" \
  -c:v libx264 -crf 30 -preset slow -movflags +faststart hero.mp4

# webm is typically 30–40% smaller again
ffmpeg -i source.mov -an -vf "scale=1920:-2,fps=25" \
  -c:v libvpx-vp9 -crf 40 -b:v 0 hero.webm
```

Aim for **under 3 MB** and 8–15 seconds. The scrim over the video is dark, so
low-contrast, slow-moving footage reads best — fast cuts fight the headline.
