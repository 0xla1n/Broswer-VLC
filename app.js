const STORAGE_KEY = "mini-vlc-playlist";
const SETTINGS_KEY = "mini-vlc-settings";
const DEFAULT_BACKGROUND = "radial-gradient(circle at top, #182036, #0f1115 45%)";
const BACKGROUND_IMAGE_KEY = "background-image";
const AUDIO_ART_KEY = "audio-art";

const mediaElement = document.getElementById("mediaElement");
const placeholder = document.getElementById("placeholder");
const audioCover = document.getElementById("audioCover");
const audioCoverImage = document.getElementById("audioCoverImage");
const playlistCount = document.getElementById("playlistCount");
const playlistEl = document.getElementById("playlist");
const urlInput = document.getElementById("urlInput");
const fileInput = document.getElementById("fileInput");
const fileNameLabel = document.getElementById("fileName");
const addForm = document.getElementById("addForm");
const resetFormBtn = document.getElementById("resetFormBtn");
const clearPlaylistBtn = document.getElementById("clearPlaylistBtn");

const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const restartBtn = document.getElementById("restartBtn");
const muteBtn = document.getElementById("muteBtn");
const loopTrackBtn = document.getElementById("loopTrackBtn");
const loopPlaylistBtn = document.getElementById("loopPlaylistBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const volumeSlider = document.getElementById("volumeSlider");
const seekBar = document.getElementById("seekBar");
const currentTimeLabel = document.getElementById("currentTime");
const durationLabel = document.getElementById("duration");

const bgImageInput = document.getElementById("bgImageInput");
const bgResetBtn = document.getElementById("bgResetBtn");
const audioArtSelect = document.getElementById("audioArtSelect");
const audioArtUploadGroup = document.getElementById("audioArtUploadGroup");
const audioArtInput = document.getElementById("audioArtInput");
const audioArtResetBtn = document.getElementById("audioArtResetBtn");

let playlist = [];
let currentIndex = -1;
let loopPlaylist = false;
let shuffleMode = false;
let backgroundSettings = { mode: "default" };
let backgroundImageUrl = null;
let audioArtMode = "default";
let audioArtUrl = null;

const objectUrlRegistry = new Set();
const hasIndexedDb = typeof indexedDB !== "undefined";
let dbPromise = null;

const randomId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `mini-vlc-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "00:00";
  }
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function detectKind(src, file) {
  const extension =
    file?.type ||
    src
      .split("?")[0]
      .split("#")[0]
      .split(".")
      .pop()
      .toLowerCase();

  const audioTypes = ["mp3", "wav", "ogg", "m4a", "flac", "aac"];
  const videoTypes = ["mp4", "webm", "mkv", "mov"];

  if (file?.type?.startsWith?.("audio") || audioTypes.includes(extension)) {
    return "audio";
  }
  if (file?.type?.startsWith?.("video") || videoTypes.includes(extension)) {
    return "video";
  }
  return "media";
}

function deriveTitleFromSource(src) {
  if (!src) return "Untitled Track";
  try {
    const parsed = new URL(src);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(lastSegment || parsed.hostname || "Untitled Track");
  } catch {
    const parts = src.split("/").filter(Boolean);
    return decodeURIComponent(parts.pop() ?? src);
  }
}

function cleanupObjectUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
    objectUrlRegistry.delete(url);
  }
}

function cleanupBackgroundImageUrl() {
  if (backgroundImageUrl) {
    URL.revokeObjectURL(backgroundImageUrl);
    backgroundImageUrl = null;
  }
}

function cleanupAudioArtUrl() {
  if (audioArtUrl) {
    URL.revokeObjectURL(audioArtUrl);
    audioArtUrl = null;
  }
}

function sanitizePlaylistForStorage() {
  return playlist.map((item) => ({
    ...item,
    src: item.hasBlob ? null : item.src,
  }));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizePlaylistForStorage()));
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      loopPlaylist,
      shuffleMode,
      volume: mediaElement.volume,
      muted: mediaElement.muted,
      backgroundSettings,
      audioArtMode,
    }),
  );
}

function getDb() {
  if (!hasIndexedDb) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("mini-vlc", 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("assets")) {
          db.createObjectStore("assets", { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function saveFileBlob(id, blob) {
  const db = await getDb();
  if (!db || !blob) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("files").put({ id, blob });
  });
}

async function deleteFileBlob(id) {
  const db = await getDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("files").delete(id);
  });
}

async function getFileBlob(id) {
  const db = await getDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readonly");
    const request = tx.objectStore("files").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveBackgroundBlob(file) {
  const db = await getDb();
  if (!db || !file) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("assets").put({ id: BACKGROUND_IMAGE_KEY, blob: file });
  });
}

async function getBackgroundBlob() {
  const db = await getDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readonly");
    const request = tx.objectStore("assets").get(BACKGROUND_IMAGE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteBackgroundBlob() {
  const db = await getDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("assets").delete(BACKGROUND_IMAGE_KEY);
  });
}

async function saveAudioArtBlob(file) {
  const db = await getDb();
  if (!db || !file) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("assets").put({ id: AUDIO_ART_KEY, blob: file });
  });
}

async function getAudioArtBlob() {
  const db = await getDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readonly");
    const request = tx.objectStore("assets").get(AUDIO_ART_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteAudioArtBlob() {
  const db = await getDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("assets").delete(AUDIO_ART_KEY);
  });
}

async function restorePlaylistFromStorage() {
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    stored = [];
  }

  const restored = [];
  for (const item of stored) {
    if (item.hasBlob) {
      try {
        const record = await getFileBlob(item.id);
        if (record?.blob) {
          const src = URL.createObjectURL(record.blob);
          objectUrlRegistry.add(src);
          restored.push({ ...item, src, isObjectUrl: true });
          continue;
        }
      } catch {
        // ignore corrupt blobs
      }
    }
    if (item.src) {
      restored.push(item);
    }
  }
  playlist = restored;
}

async function restoreSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {};
    loopPlaylist = Boolean(stored.loopPlaylist);
    shuffleMode = Boolean(stored.shuffleMode);
    backgroundSettings = stored.backgroundSettings ?? { mode: "default" };
    audioArtMode = stored.audioArtMode ?? "default";
    const volume =
      typeof stored.volume === "number" && stored.volume >= 0 && stored.volume <= 1
        ? stored.volume
        : 1;
    mediaElement.volume = volume;
    volumeSlider.value = String(volume);
    mediaElement.muted = Boolean(stored.muted);
  } catch {
    mediaElement.volume = 1;
    volumeSlider.value = "1";
  }

  muteBtn.textContent = mediaElement.muted ? "🔇" : "🔈";
  loopPlaylistBtn.classList.toggle("active", loopPlaylist);
  shuffleBtn.classList.toggle("active", shuffleMode);
  audioArtSelect.value = audioArtMode;
  updateAudioArtControls();

  if (backgroundSettings.mode === "image") {
    const record = await getBackgroundBlob();
    if (record?.blob) {
      cleanupBackgroundImageUrl();
      backgroundImageUrl = URL.createObjectURL(record.blob);
    } else {
      backgroundSettings.mode = "default";
      await deleteBackgroundBlob();
    }
  }

  if (audioArtMode === "custom") {
    const record = await getAudioArtBlob();
    if (record?.blob) {
      cleanupAudioArtUrl();
      audioArtUrl = URL.createObjectURL(record.blob);
    } else {
      audioArtMode = "default";
      audioArtSelect.value = "default";
      await deleteAudioArtBlob();
    }
  }

  applyBackground();
}

function applyBackground() {
  if (backgroundSettings.mode === "image" && backgroundImageUrl) {
    document.body.style.backgroundImage = `url(${backgroundImageUrl})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundColor = "#000";
  } else {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundColor = "";
    document.body.style.background = DEFAULT_BACKGROUND;
  }
  if (audioArtMode === "background") {
    updateAudioCover();
  }
}

function renderPlaylist() {
  playlistEl.innerHTML = "";
  if (playlistCount) {
    const label = playlist.length === 1 ? "item" : "items";
    playlistCount.textContent = `${playlist.length} ${label}`;
  }
  if (!playlist.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Playlist is empty.";
    playlistEl.appendChild(empty);
    updateMediaSurface();
    return;
  }

  playlist.forEach((item, index) => {
    const li = document.createElement("li");
    li.dataset.index = index;
    li.classList.toggle("active", index === currentIndex);

    const details = document.createElement("div");
    details.className = "details";

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = item.title;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = item.kind;

    details.appendChild(title);
    details.appendChild(meta);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "✕";
    removeBtn.className = "remove";
    removeBtn.title = "Remove from playlist";
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      removeTrack(index);
    });

    li.appendChild(details);
    li.appendChild(removeBtn);
    li.addEventListener("click", () => playTrack(index));

    playlistEl.appendChild(li);
  });
}

function updateAudioArtControls() {
  audioArtUploadGroup.hidden = audioArtMode !== "custom";
}

function updateAudioCover() {
  const current = playlist[currentIndex];
  if (!current || current.kind !== "audio") {
    audioCover.hidden = true;
    return;
  }

  let artSrc = null;
  if (audioArtMode === "background" && backgroundImageUrl) {
    artSrc = backgroundImageUrl;
  } else if (audioArtMode === "custom" && audioArtUrl) {
    artSrc = audioArtUrl;
  }

  if (artSrc) {
    audioCoverImage.src = artSrc;
    audioCoverImage.hidden = false;
    audioCover.classList.add("has-art");
  } else {
    audioCoverImage.hidden = true;
    audioCover.classList.remove("has-art");
  }

  audioCover.hidden = false;
}

function updateMediaSurface() {
  const current = playlist[currentIndex];
  if (!current) {
    placeholder.hidden = false;
    mediaElement.style.display = "none";
    audioCover.hidden = true;
    return;
  }

  placeholder.hidden = true;
  if (current.kind === "audio") {
    mediaElement.style.display = "none";
    updateAudioCover();
  } else {
    mediaElement.style.display = "block";
    audioCover.hidden = true;
  }
}

function highlightActive() {
  playlistEl.querySelectorAll("li[data-index]").forEach((node) => {
    node.classList.toggle("active", Number(node.dataset.index) === currentIndex);
  });
}

function updatePlayButton(paused) {
  playPauseBtn.textContent = paused ? "▶" : "⏸";
}

function playPause() {
  if (!mediaElement.src) {
    if (playlist.length) {
      playTrack(0);
    }
    return;
  }
  if (mediaElement.paused) {
    mediaElement.play();
  } else {
    mediaElement.pause();
  }
}

function syncTimingUi() {
  if (!mediaElement.duration) return;
  const progress = (mediaElement.currentTime / mediaElement.duration) * 1000;
  seekBar.value = progress;
  currentTimeLabel.textContent = formatTime(mediaElement.currentTime);
  durationLabel.textContent = formatTime(mediaElement.duration);
}

function addEntry(entry) {
  playlist.push(entry);
  renderPlaylist();
  saveState();
  if (currentIndex === -1) {
    playTrack(playlist.length - 1);
  }
}

async function addLocalFile(file) {
  const id = randomId();
  await saveFileBlob(id, file);
  const src = URL.createObjectURL(file);
  objectUrlRegistry.add(src);
  addEntry({
    id,
    title: file.name,
    src,
    kind: detectKind(src, file),
    isObjectUrl: true,
    hasBlob: true,
  });
}

function addRemoteEntry(src) {
  if (!src) return;
  addEntry({
    id: randomId(),
    title: deriveTitleFromSource(src),
    src,
    kind: detectKind(src),
    isObjectUrl: false,
    hasBlob: false,
  });
}

function removeTrack(index) {
  if (index < 0 || index >= playlist.length) return;
  const [removed] = playlist.splice(index, 1);
  if (removed?.isObjectUrl) {
    cleanupObjectUrl(removed.src);
  }
  if (removed?.hasBlob) {
    deleteFileBlob(removed.id).catch(() => {});
  }
  if (index === currentIndex) {
    mediaElement.pause();
    mediaElement.removeAttribute("src");
    mediaElement.load();
    currentIndex = -1;
    updateMediaSurface();
  } else if (index < currentIndex) {
    currentIndex -= 1;
  }
  renderPlaylist();
  highlightActive();
  updateMediaSurface();
  saveState();
}

function clearPlaylist() {
  playlist.forEach((item) => {
    if (item.isObjectUrl) {
      cleanupObjectUrl(item.src);
    }
    if (item.hasBlob) {
      deleteFileBlob(item.id).catch(() => {});
    }
  });
  playlist = [];
  currentIndex = -1;
  mediaElement.pause();
  mediaElement.removeAttribute("src");
  mediaElement.load();
  updateMediaSurface();
  renderPlaylist();
  saveState();
}

function playTrack(index) {
  if (index < 0 || index >= playlist.length) return;
  currentIndex = index;
  const item = playlist[index];
  mediaElement.src = item.src;
  mediaElement.loop = loopTrackBtn.classList.contains("active");
  mediaElement.load();
  mediaElement.play().catch(() => {
    /* autoplay blocked */
  });
  updateMediaSurface();
  highlightActive();
  saveState();
}

function nextTrack(auto = false) {
  if (!playlist.length) return;

  if (shuffleMode && auto) {
    const candidates = playlist
      .map((_, idx) => idx)
      .filter((idx) => idx !== currentIndex);
    if (candidates.length) {
      playTrack(candidates[Math.floor(Math.random() * candidates.length)]);
      return;
    }
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex < playlist.length) {
    playTrack(nextIndex);
  } else if (loopPlaylist) {
    playTrack(0);
  } else if (!auto) {
    mediaElement.pause();
    mediaElement.currentTime = 0;
    updatePlayButton(true);
  }
}

function previousTrack() {
  if (!playlist.length) return;
  const prevIndex = currentIndex - 1;
  if (prevIndex >= 0) {
    playTrack(prevIndex);
  } else if (loopPlaylist) {
    playTrack(playlist.length - 1);
  }
}

function resetForm() {
  addForm.reset();
  fileNameLabel.textContent = "No files selected";
}

function handleFileSelection(files) {
  if (!files.length) {
    fileNameLabel.textContent = "No files selected";
    return;
  }
  if (files.length === 1) {
    fileNameLabel.textContent = files[0].name;
  } else {
    fileNameLabel.textContent = `${files.length} files selected`;
  }
}

async function handleDrop(event) {
  event.preventDefault();
  const files = Array.from(event.dataTransfer.files).filter((file) =>
    file.type.startsWith("audio/") || file.type.startsWith("video/"),
  );
  for (const file of files) {
    await addLocalFile(file);
  }
}

async function handleBackgroundImageChange(file) {
  if (!file) return;
  await saveBackgroundBlob(file);
  cleanupBackgroundImageUrl();
  backgroundImageUrl = URL.createObjectURL(file);
  backgroundSettings = { ...backgroundSettings, mode: "image" };
  applyBackground();
  saveState();
}

function attachEvents() {
  playPauseBtn.addEventListener("click", playPause);
  prevBtn.addEventListener("click", previousTrack);
  nextBtn.addEventListener("click", () => nextTrack(false));
  restartBtn.addEventListener("click", () => {
    mediaElement.currentTime = 0;
    mediaElement.play();
  });
  muteBtn.addEventListener("click", () => {
    mediaElement.muted = !mediaElement.muted;
    muteBtn.textContent = mediaElement.muted ? "🔇" : "🔈";
    saveState();
  });
  loopTrackBtn.addEventListener("click", () => {
    const isActive = !loopTrackBtn.classList.contains("active");
    loopTrackBtn.classList.toggle("active", isActive);
    mediaElement.loop = isActive;
  });
  loopPlaylistBtn.addEventListener("click", () => {
    loopPlaylist = !loopPlaylist;
    loopPlaylistBtn.classList.toggle("active", loopPlaylist);
    saveState();
  });
  shuffleBtn.addEventListener("click", () => {
    shuffleMode = !shuffleMode;
    shuffleBtn.classList.toggle("active", shuffleMode);
    saveState();
  });
  volumeSlider.addEventListener("input", () => {
    mediaElement.volume = Number(volumeSlider.value);
    mediaElement.muted = mediaElement.volume === 0;
    muteBtn.textContent = mediaElement.muted ? "🔇" : "🔈";
    saveState();
  });
  seekBar.addEventListener("input", () => {
    if (!mediaElement.duration) return;
    mediaElement.currentTime = (seekBar.value / 1000) * mediaElement.duration;
  });
  mediaElement.addEventListener("play", () => {
    updatePlayButton(false);
  });
  mediaElement.addEventListener("pause", () => {
    updatePlayButton(true);
  });
  mediaElement.addEventListener("loadedmetadata", () => {
    durationLabel.textContent = formatTime(mediaElement.duration);
  });
  mediaElement.addEventListener("timeupdate", syncTimingUi);
  mediaElement.addEventListener("ended", () => nextTrack(true));

  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const urlValue = urlInput.value.trim();
    const files = Array.from(fileInput.files ?? []);

    if (!urlValue && !files.length) {
      urlInput.focus();
      return;
    }

    for (const file of files) {
      await addLocalFile(file);
    }

    if (urlValue) {
      addRemoteEntry(urlValue);
    }

    resetForm();
  });

  resetFormBtn.addEventListener("click", resetForm);
  clearPlaylistBtn.addEventListener("click", () => {
    if (
      playlist.length &&
      confirm("Clear the current playlist? This cannot be undone.")
    ) {
      clearPlaylist();
    }
  });

  fileInput.addEventListener("change", () =>
    handleFileSelection(Array.from(fileInput.files ?? [])),
  );

  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => {
    handleDrop(event).catch(() => {});
  });

  bgImageInput.addEventListener("change", async () => {
    const file = bgImageInput.files?.[0];
    if (file) {
      await handleBackgroundImageChange(file);
    }
    bgImageInput.value = "";
  });

  bgResetBtn.addEventListener("click", async () => {
    backgroundSettings = { mode: "default" };
    cleanupBackgroundImageUrl();
    await deleteBackgroundBlob();
    applyBackground();
    saveState();
  });

  audioArtSelect.addEventListener("change", async (event) => {
    audioArtMode = event.target.value;
    updateAudioArtControls();
    if (audioArtMode === "custom" && !audioArtUrl) {
      const record = await getAudioArtBlob();
      if (record?.blob) {
        cleanupAudioArtUrl();
        audioArtUrl = URL.createObjectURL(record.blob);
      } else {
        audioArtMode = "default";
        audioArtSelect.value = "default";
      }
    }
    updateAudioCover();
    saveState();
  });

  audioArtInput.addEventListener("change", async () => {
    const file = audioArtInput.files?.[0];
    if (!file) return;
    await saveAudioArtBlob(file);
    cleanupAudioArtUrl();
    audioArtUrl = URL.createObjectURL(file);
    audioArtMode = "custom";
    audioArtSelect.value = "custom";
    updateAudioArtControls();
    updateAudioCover();
    saveState();
    audioArtInput.value = "";
  });

  audioArtResetBtn.addEventListener("click", async () => {
    cleanupAudioArtUrl();
    await deleteAudioArtBlob();
    if (audioArtMode === "custom") {
      audioArtMode = "default";
      audioArtSelect.value = "default";
    }
    updateAudioArtControls();
    updateAudioCover();
    saveState();
  });
}

async function init() {
  await restorePlaylistFromStorage();
  await restoreSettings();
  renderPlaylist();
  highlightActive();
  updateMediaSurface();
  attachEvents();
}

init();

