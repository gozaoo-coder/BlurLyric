# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

- `npm run tauri dev` — Start development server with hot-reload (runs Vite + Tauri)
- `npm run tauri build` — Build release executable
- `npm run dev` — Run Vite frontend only (without Tauri backend)
- `npm run build` — Build Vite frontend only
- `npm run preview` — Preview Vite production build

## Project Structure

### Frontend (Vue 3 + Vite)

```
src/
  main.js              — App entry: creates Vue app, registers global components, sets up router
  App.vue              — Root component: orchestrates layout (topBar, leftBar, rightBlock, musicInfoPage),
                         manages player state, handles OOBE flow, and stores global reactive data
  style.css            — Global styles
  api/
    manager.js         — Unified API entry: exports sourceManager, Track, Artist, Album, TrackList
    source/
      base.js          — Source abstract base class defining the API interface contract
      index.js         — SourceManager: registers/manages multiple API sources (tauri, web)
      tauri.js         — TauriSource: implements Source for native Tauri backend (local music library)
      web.js           — WebSource: stub for future web/cloud music source
    resources/
      index.js         — Track, Artist, Album, TrackList data classes with lazy resource loading,
                         ref-counted object URL management via Resource/ResourcePool
    lazyLoader.js      — LazyLoader: on-demand loading + caching for album covers and music files
    performanceMonitor.js — Frontend performance tracking (resource load times, cache hit rates)
    tauri.js           — Legacy direct Tauri invoke wrappers (being replaced by TauriSource)
  router/
    index.js           — Vue Router config with routes for home, search, allMusic, musicFolder,
                         musicTrack, setting, dataManager, album/artist detail pages
  components/
    base/              — Reusable primitives: contextMenu, dialog, toggle, suspendingBox, tippy,
                         DropdownMenu, hoverMenu, lazyLoadImage, lazyLoadCoverImage, text-spawn
    topBar/            — Custom title bar (window decorations: false), title component
    titleRegistrater/  — Body title registration mechanism
    tracks/            — Music library views: tracksRow, powerTable, folder, conditioner, toggle-line,
                         link-line, composables (useMusicTable), virtual list utils
    musicInfoPageComponents/ — Now-playing view: lyric, lyric-line-wordbyword, background, buttons,
                         cover art, play mode controls
    WindowControls.vue — Window min/max/close buttons
    leftBar.vue        — Side navigation bar
    rightBlock.vue     — Now playing queue / playlist panel
    musicCard.vue      — Album/artist card component
    album.vue, album_lazyLoad.vue — Album views
    oobe.vue           — First-run setup wizard (Out Of Box Experience)
  js/
    lyricParser.js     — Parses LRC, YRC (NetEase), and BLF (custom JSON) lyric formats
    musicPlayer.js     — Stub for audio playback logic
    drag.js            — Drag-and-drop utilities
    baseMethods.js     — Common utility functions
    loadTauri.js       — Tauri initialization helpers
    search/index.js    — Search utilities
  assets/
    tempMusicTrack.js  — Fallback/demo music track data
```

### Backend (Tauri + Rust) — `src-tauri/src/`

```
lib.rs               — Core backend: Tauri commands, music scanning, Song/Artist/Album models,
                       deduplication by fingerprint, quality scoring, cache rebuild from disk
main.rs              — Entry point, calls blurlyric_lib::run()
music_tag/           — Custom music metadata parser (replaces audiotags crate)
  mod.rs             — Public API: read_metadata(), read_metadata_batch(), is_supported_format()
  parser.rs          — MetadataParser: ID3v2/ID3v1 (MP3), Vorbis Comment (FLAC/OGG), WAV parsing,
                       Symphonia-based audio duration/properties extraction
  types.rs           — Data structures: AudioFormat, MusicMetadata, Artist, Album, Picture, Lyrics
  error.rs           — Error types for metadata parsing
image_processor.rs   — CPU image resizing + WebP encoding with tokio thread pool semaphore
gpu_image_processor.rs — GPU-accelerated image processing via wgpu (compute shaders)
cache_manager.rs     — Multi-level cache: disk persistence with BLAKE3 file fingerprints,
                       memory cache rebuild, cache stats
incremental_scanner.rs — Scans only changed/new/deleted files using file fingerprints
performance_monitor.rs — Backend performance metrics: scan durations, cache hit/miss, resource load times
music_deduplicator.rs — Track deduplication and merging logic
```

### Key Architecture Decisions

- **Two-layer caching**: In-memory (Mutex<HashMap>) for fast access during runtime, disk persistence (JSON via serde) for app restart. Album covers are cached as WebP files.
- **Source abstraction**: The frontend talks to a `Source` interface. Currently only `TauriSource` is active (added in `source/index.js` line 193). The `WebSource` stub exists for future online music providers.
- **Deduplication**: Tracks are deduplicated by a normalized fingerprint (title+artists+album). Multiple files matching the same song are merged into one entry with sorted sources by quality score (bitrate + format + sample rate + duration).
- **Custom title bar**: `decorations: false` in tauri.conf.json. Window controls are handled via `@tauri-apps/api` in `main.js`.
- **Global components**: Several components (iconToClick, iconWithText, toggle, bodytitle, textspawn, iconFlexRow, dialog_custom, suspendingBox, LazyLoadCoverImage) are registered globally in `main.js`.
- **Lazy resource loading**: Album covers and music files are loaded on-demand via `LazyLoader` (frontend) + Tauri commands (backend), with ref-counted object URL management.

## Tauri Commands (Rust -> Frontend)

Defined in `lib.rs` `invoke_handler` (line 1604). Key commands:
- `init_application`, `refresh_music_cache`, `get_music_list`
- `get_all_my_albums`, `get_all_my_artists`, `get_album_by_id`, `get_artist_by_id`
- `get_albums_songs_by_id`, `get_artists_songs_by_id`
- `get_album_cover`, `get_low_quality_album_cover`, `get_music_file`
- `add_music_dirs`, `remove_music_dirs`, `get_all_music_dirs`
- `clear_image_cache`, `get_cache_size_info`, `reset_all_data`
- `close_app`, `add_users_music_dir`, `get_users_music_dir`
- `perform_incremental_scan`, `perform_full_scan`, `get_cache_stats`, `clear_music_cache`, `is_cache_valid`
- `get_performance_stats`, `get_performance_report`, `reset_performance_stats`, `record_resource_load`

## Supported Audio Formats

MP3, FLAC, OGG, WAV, M4A, AAC (detected by extension in `lib.rs:255-259`)

## Lyric Formats

- LRC — Standard timestamped lyrics (`[mm:ss.xx]text`)
- YRC — NetEase word-level timestamped lyrics with per-word timing
- BLF — Custom JSON format with word-level precision
