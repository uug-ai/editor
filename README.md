# Editor

Cut, trim and create videos right in your browser. This first version trims: open a video, pick where the clip starts and ends, and download it. Everything happens on your computer; the video is never uploaded.

- **Open:** drop a video anywhere on the page or choose one. MP4, MOV, WebM and MKV are read; what plays depends on the browser (an H.264 MP4 plays everywhere).
- **Play and scrub:** play the clip, step one frame at a time, or click and drag on the timeline. A filmstrip of the video runs along it.
- **Trim:** drag the handles at either end of the clip, or move the playhead and press **Set start** (`I`) or **Set end** (`O`). Focus a handle to move it a frame at a time with the arrow keys. **Play** plays only the clip and stops at its end.
- **Download:** **Trim video** cuts the clip and offers it as `<name>-trimmed.<ext>`, in the container of the original.

## How the cut works

Trimming uses [Mediabunny](https://mediabunny.dev) (MPL-2.0), which reads and writes media files in the browser with WebCodecs ([src/media.ts](src/media.ts)).

- **MP4 and MOV** are cut without re-encoding, so the clip loses no quality and is ready almost at once. The clip starts on the exact frame you chose: the frames back to the previous key frame are copied too, because the first frame can't be decoded without them, and an edit list tells players to skip them. The end can run a few frames over when the video uses B-frames, because the last frames you keep may need a later one to decode.
- **WebM and MKV** are copied the same way when the start falls on a key frame. Otherwise those containers can't hide the frames before it, so the video is re-encoded, which takes longer and needs a browser with WebCodecs encoders (current Chrome, Edge, Firefox and Safari). Audio is re-encoded when its packets don't line up with the cut.

If the browser can't keep a track (for example audio it can't encode), the clip is still made without it, and the editor says what was left out.

## Running locally

You need Node.js 20.19 or later.

```bash
npm ci
npm run dev    # http://localhost:5176
```

From the monorepo, **Editor: Launch Chrome** in VS Code starts the dev server and opens the app with the debugger attached.

| Command | Does |
|---------|------|
| `npm run dev` | Starts the app on http://localhost:5176, which reloads as you edit. |
| `npm run build` | Type-checks and builds the static site into `dist/`. |
| `npm test` | Runs the tests. The trim tests make videos with ffmpeg and check the cuts, and are skipped when ffmpeg isn't installed. |

## Releases

The [image](Dockerfile) serves the static build with Nginx on port 80, with `/healthz` for Kubernetes probes. Pull requests and pushes to `main` build it and scan it with Trivy.

To release, run **Bump release** in GitHub Actions and choose which part of the version to bump. It tags the release, publishes `ghcr.io/uug-ai/editor:<tag>` for amd64 and arm64, and opens a pull request in [uug-ai/gitops](https://github.com/uug-ai/gitops) that deploys it to staging at https://editor.uug.lol once merged.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space or `K` | Play or pause the clip |
| ← →, Shift + ← → | Back or forward one frame, or one second |
| `I`, `O` | Start or end the clip at the playhead |
| ← → on a focused handle | Move that end of the clip one frame (Shift: one second) |
