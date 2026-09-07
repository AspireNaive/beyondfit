# Hero video

`hero.webm` (628 KB) and `hero.mp4` (865 KB) back the homepage hero. Browsers
pick WebM when they support it and fall back to MP4; `VideoHero` lists both.

## Provenance

| | |
| --- | --- |
| Source | Pexels — "Close-up of Dumbbells", video id `6053511` |
| Page | https://www.pexels.com/video/close-up-of-dumbbells-6053511/ |
| Licence | [Pexels License](https://www.pexels.com/license/) — free for commercial use, modification allowed, **attribution not required** |

Recorded here for provenance, not because the licence demands it. Two things
the licence *does* prohibit, worth knowing before swapping in another clip:
you may not resell it unmodified, and you may not use identifiable people in a
way that puts them in a bad light. This clip has no people in it, which also
sidesteps any model-release question.

## How it was encoded

The source is 1280×720 (Pexels' filename claims 1080p — the stream is not), so
it is kept at native resolution rather than upscaled to nothing.

It is a **palindrome loop**: the clip is concatenated with a reversed copy of
itself, so the end frame *is* the start frame and the wrap is invisible. A slow
dolly shot like this cannot loop cleanly otherwise, and a visible jump-cut
every twelve seconds is exactly the sort of thing that reads as cheap.

```bash
# 24s seamless loop, no audio, from the 12s source
ffmpeg -i 6053511.mp4 -an -filter_complex \
  "[0:v]fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[out]" \
  -map "[out]" -c:v libx264 -crf 30 -preset slower -profile:v high \
  -pix_fmt yuv420p -movflags +faststart hero.mp4

ffmpeg -i 6053511.mp4 -an -filter_complex \
  "[0:v]fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[out]" \
  -map "[out]" -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 hero.webm
```

## Replacing it

Drop in a new `hero.mp4` / `hero.webm` and nothing else changes. To serve from
a CDN instead, set `VITE_HERO_VIDEO_URL` and leave this folder empty.

Keep it **under ~3 MB**, dark, and slow. The scrim over the video is heavy, so
low-contrast footage with gentle motion reads best — fast cuts fight the
headline and win.

## When the video is deliberately *not* loaded

The hero never depends on this file. A CSS backdrop (layered gradients, a faint
grid, a slow drift) paints on the first frame, so there is no empty box, no
layout shift and no image request. The video fades in over it only once it is
genuinely playing.

It is skipped entirely when:

- `prefers-reduced-motion: reduce` is set,
- the connection reports `saveData`, or an effective type of `2g` / `3g`,
- the viewport is narrower than 768px.

That last one is deliberate: a background video is decoration, and a phone on a
metered plan should not pay for it. Verified — on a 390px viewport the browser
makes **zero** requests for these files.

# Logo

`kedem_logo.jpeg` is the supplied artwork (1254×1254, mark on a black
backdrop). `kedem_logo.png` is what the `Logo` component actually renders: the
same image with the black turned into alpha (`alpha = max(r,g,b)`, colour
un-premultiplied), trimmed to the artwork and padded back to a 512×512 square.
Composited over black it is pixel-identical to the JPEG; over the site's
dark surfaces it behaves like a `screen` blend, so no square edge shows.
