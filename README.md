# Editor

Cut, trim and create videos right in your browser. This first version trims: open a video, pick where the clip starts and ends, and download it. Everything happens on your computer; the video is never uploaded.

- **Open:** drop a video anywhere on the page or choose one. MP4, MOV, WebM and MKV are read; what plays depends on the browser (an H.264 MP4 plays everywhere).
- **Play and scrub:** play the clip, step one frame at a time, or click and drag on the timeline. A filmstrip of the video runs along it.
- **Trim:** drag the handles at either end of the clip, or move the playhead and press **Set start** (`I`) or **Set end** (`O`). Focus a handle to move it a frame at a time with the arrow keys. **Play** plays only the clip and stops at its end.
- **Download:** **Trim video** cuts the clip and offers it as `<name>-trimmed.<ext>`, in the container of the original.

## Navigation and appearance

The top bar follows Learn's UUG styling, with the UUG logo and **Home** linking
to <https://uug.ai/>, and theme and [UUG.AI GitHub](https://github.com/uug-ai)
controls on the right. The current filename and **Open another** stay available
when editing, wrapping onto a second row on small screens.

The theme follows the system until you pick light or dark mode. Your choice is
saved per origin under `editor.theme` and synchronized across tabs. Clearing the
preference resumes the system theme. [public/theme.js](public/theme.js) restores
it before the first paint; storage failures are logged and shown in the top bar,
but the toggle and video editor remain usable.

## Branding, SEO and analytics

[index.html](index.html) supplies the UUG.AI-prefixed title, description, canonical URL, social previews and WebApplication structured data. The tab keeps the UUG.AI prefix when a video is opened. The UUG favicon and touch icons in [public](public) are copied from the UUG.AI website and included in the Docker build.

The canonical app URL is https://edit.uug.lol. The GitOps ingress retains `editor.uug.lol` as a compatibility alias, routed to the same application. Each hostname has its own TLS certificate.

Google Analytics runs only on `edit.uug.lol` and the `editor.uug.lol` compatibility alias, using the **Editor** web stream (`G-928MMDN0Q9`, stream ID `16247177565`) in the existing UUG.AI property (`540298183`). Local development and previews do not load the tag. Page measurements on both hosts use the fixed product title and `https://edit.uug.lol/` root URL with no referrer or query string; filenames and video contents are not sent. Enhanced measurement is disabled in the stream to prevent automatic file-download, form and video tracking; keep it disabled. Google signals and ad personalization are disabled in the tag. Videos are still processed entirely on your computer.

The bottom-right **We use cookies** banner matches Learn's consent UI and policy: **Accept cookies**, **Reject cookies**, and a link to the privacy policy. [public/analytics.js](public/analytics.js) uses Consent Mode v2 advanced mode: the tag loads on approved HTTPS hosts with every consent type denied, sending only cookieless usage pings before acceptance and after rejection. Acceptance grants only `analytics_storage`; advertising consent always stays denied. One sanitized page view is sent per load, not again when choosing.

Preferences use Learn's `uug-analytics-consent` local-storage key, separately per origin (including the compatibility alias). Cookies use the `edit` prefix and the current hostname; rejection clears only this app's accessible GA cookies, never Learn, Draw, or parent-domain cookies. Choices sync across tabs of the same origin. Storage and tag-load failures appear in the banner without blocking video editing. The banner stays hidden on localhost, HTTP and unapproved preview hosts; it has no permanent reopen control, matching Learn. Get privacy sign-off before changing this policy.

When changing the deployed hostname, update the canonical/social/structured-data URLs, Analytics hostname guard and page location, sitemap, robots sitemap URL, and the stream URL together.

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

To release, run **Bump release** in GitHub Actions and choose which part of the version to bump. It tags the release, publishes `ghcr.io/uug-ai/editor:<tag>` for amd64 and arm64, and opens a pull request in [uug-ai/gitops](https://github.com/uug-ai/gitops) that deploys it to staging at https://edit.uug.lol once merged.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space or `K` | Play or pause the clip |
| ← →, Shift + ← → | Back or forward one frame, or one second |
| `I`, `O` | Start or end the clip at the playhead |
| ← → on a focused handle | Move that end of the clip one frame (Shift: one second) |
