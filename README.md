# Mini VLC

Offline-first playlist player for audio & video files that runs entirely in the browser. Bring your local library or point the player at `file://` and network URLs, then enjoy VLC-style playback controls, looping, shuffle, playlist persistence, and custom theming—all without a backend.

![Mini VLC UI Preview](docs/ui-preview.jpg)

> 💡 Save the screenshot above as `docs/ui-preview.jpg` (or update the path) so the image renders on GitHub. The preview in this README references the image you shared.

---

## ✨ Features

- **Offline & local-file friendly** – add media via drag & drop, file picker, or `file://` URLs without any server component.
- **Persistent playlists** – `localStorage` + IndexedDB keep tracklists and settings across browser restarts (including large local files via blobs).
- **Loop & shuffle controls** – toggle single-track looping, playlist looping, and shuffle just like VLC.
- **Customizable look** – drop in a background image and optional audio artwork overlays for a personalized player shell.
- **Audio artwork options** – choose between the matte fallback, reusing the background image, or uploading art just for audio tracks.
- **Drag & drop anywhere** – drag media onto the window to enqueue it instantly.
- **No build step** – plain HTML/CSS/JS so you can open `index.html` directly or host it via any static file server.

---

## 🚀 Quick Start

```bash
# clone your repo & enter it
git clone https://github.com/<you>/mini-vlc.git
cd mini-vlc

# serve statically (optional but recommended to avoid browser file restrictions)
npx serve .
# or
python3 -m http.server 4173
```

Then open the reported URL (or double-click `index.html` if you prefer). Drag media files into the window or use the Add Media panel on the right.

### Recommended browsers

| Browser | Tested | Notes |
| --- | --- | --- |
| Chrome / Edge (Chromium) | ✅ | Full IndexedDB + drag & drop support |
| Firefox | ✅ | Works offline, prompts for local file permissions |
| Safari | ⚠️ | Requires running from `http(s)` origin for IndexedDB persistence |

---

## 🧱 Project Structure

```
.
├── index.html        # Layout shell & main UI markup
├── styles.css        # Modern glassy theme, responsive grid, custom controls
├── app.js            # Player logic, playlist management, persistence helpers
└── docs/
    └── ui-preview.jpg (add this screenshot here)
```

---

## 🔐 Persistence Model

- **Playlists & settings:** stored in `localStorage` so names, URLs, loop/shuffle, and background/art selections remain after reloads.
- **Local blobs:** saved in IndexedDB for larger audio/video files so they persist and reload without asking you to pick them again.
- **Custom assets:** background wallpaper + optional audio artwork live in the same IndexedDB store, referenced by stable keys.

> If the browser blocks IndexedDB (private mode, hardened settings) local-file persistence gracefully degrades: playlists still load but the corresponding blobs may need to be reselected.

---

## 🧩 Customization

- **Player background** – upload any image; the gradient fallback is used otherwise.
- **Audio artwork** – switch between:
  - `Default matte` (built-in frame)
  - `Reuse background image`
  - `Custom artwork` (upload once, persists)

You can reset either asset at any time via the Look & Feel card.

---

## 🛠 Development Notes

- No build process—just edit the three core files.
- Uses modern DOM APIs (modules are not required).
- Linting is minimal; run any formatter/linter you prefer before committing.

---

## 🤝 Contributing

1. Fork the repo & create a branch.
2. Make your changes (UI tweaks, new controls, bug fixes, etc.).
3. Open a PR describing the change and any testing steps.

Ideas worth exploring:

- Keyboard shortcuts (space to toggle play/pause, `j/k` seek, etc.)
- Waveform/progress visualizations
- Export/import playlist JSON files
- Multiple playlist tabs or profiles

---

## 📝 License

This project is open source—choose any permissive license you prefer (MIT, Apache-2.0, etc.) before pushing to GitHub. Don’t forget to add the license file next to this README.

Enjoy mixing your library with a lightweight, offline-friendly Mini VLC! 🎶

