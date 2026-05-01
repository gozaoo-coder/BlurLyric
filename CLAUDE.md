# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

- `npm run tauri dev` — Start development server with hot-reload (Vite + Tauri)
- `npm run tauri build` — Build release executable
- `npm run dev` — Run Vite frontend only (without Tauri backend)
- `npm run build` — Build Vite frontend only
- `npm run preview` — Preview Vite production build
- `cd src-tauri && cargo test` — Run Rust unit tests (in-source `#[cfg(test)]` only; no separate test directory)
- `cd src-tauri && cargo build` — Build Rust backend only

## Project Structure

### Backend (Tauri + Rust) — `src-tauri/src/`

```
lib.rs                   — Tauri commands, application init, scanning orchestration,
                           global singletons (LIBRARY_MANAGER, SOURCE_MANAGER, FAVOR_MANAGER)
main.rs                  — Entry point, calls blurlyric_lib::run()
image_processor.rs       — CPU image resizing + WebP encoding with tokio thread pool semaphore
gpu_image_processor.rs   — GPU-accelerated image processing via wgpu (compute shaders)
performance_monitor.rs   — Backend performance metrics, Tauri commands exposed for frontend
modules/
  music_tag/             — Custom music metadata parser (replaces audiotags crate)
    mod.rs               — Public API: read_metadata(), read_metadata_batch(), is_supported_format()
    parser/              — MetadataParser: ID3v2/ID3v1 (MP3), Vorbis Comment (FLAC/OGG), WAV,
                           Symphonia-based audio duration/properties extraction
      mod.rs, id3.rs, flac.rs, ogg.rs, wav.rs, symphonia.rs
    types/               — Data structures: AudioFormat, MusicMetadata, Artist, Album, Picture
      mod.rs, metadata.rs, artist.rs, album.rs, picture.rs, audio_format.rs, config.rs
    error.rs             — Error types for metadata parsing
  music_library/         — Complete music library management system
    mod.rs               — Re-exports all public types (ObjectId, Quality, models, manager, etc.)
    object_id.rs         — ULID-based ObjectId with typed prefixes (m_song, m_album, m_artist,
                           r_song, r_album, r_artist)
    object_status.rs     — Object lifecycle status (Active, Deleted, Hidden)
    quality.rs           — Quality enum (HiRes/Lossless/Normal/Standard/Unknown) with media-info
                           based classification; includes unit tests
    error.rs             — MusicLibraryError types
    migration.rs         — Data migration between schema versions
    models/              — Domain model layer: dual-object architecture
      music_object.rs    — MusicObject trait + ObjectKind enum
      master_song/album/artist.rs — Master entities (aggregates from multiple sources)
      source_song/album/artist.rs — Source records (raw data from a specific source)
      trace_link.rs      — TraceLink: source_id + record_id linking source->master
      song_full.rs       — Resolved views: SongFull, AlbumFull, ArtistFull (merged output)
    source/              — Source abstraction layer
      mod.rs             — Source trait (async: get_song_file, get_song_lyric, get_album_picture)
                           + SourceType enum (Storage/Api) + FetchGuard (dedup in-flight requests)
      manager.rs         — SourceManager: register/retrieve sources by ID
      storage.rs         — StorageSource base class: file discovery, scan state tracking,
                           full/incremental chunked scanning, music_tag integration
      local.rs           — LocalStorageSource: user's local music directories
      temp.rs            — Temp source (imported/dragged files)
      favor.rs           — Favorites/likes source
      webdev.rs          — WebDAV cloud storage source
      api.rs             — API source placeholder
    manager/             — Core library manager
      mod.rs             — MusicStorageSourceLibraryManager: heterogeneous object store
                           (HashMap<ObjectId, ObjectEntry>), name_index, external_index
      index.rs           — rebuild_indexes() for startup
      registration.rs    — register_or_merge_song() — core dedup/merge logic; includes tests
      resolution.rs      — resolve_all_songs/albums/artists — build SongFull/AlbumFull/ArtistFull
      routing.rs         — get_best_audio_stream — quality-sorted source selection
      garbage.rs         — GC for orphaned source records
      persistence.rs     — save_to_disk / load_from_disk (JSON via serde)
    merge/               — Merge system: links source records to master entities
      mod.rs             — MergeOverrideTable (force_merges + splits)
      auto_merge.rs      — Automatic merging by fingerprint; includes tests
      manual_override.rs — Manual merge override table
    favor/               — Playlists, favorites, downloads
      mod.rs             — Favor types
      favor_manager.rs   — FavorManager with load/save; includes tests
      playlist.rs        — Playlist data structures
      downloads.rs       — Downloads tracking
```

**Dual-object model**: Master entities (MasterSong/MasterAlbum/MasterArtist) are logical aggregates with ULID-based ObjectIds. Source records (SourceSong/SourceAlbum/SourceArtist) hold raw data from specific sources keyed by `(source_id, external_id)`. TraceLinks connect source records to master entities. The `SongFull`/`AlbumFull`/`ArtistFull` views resolve this graph into flat structures for the frontend.

**Scan flow**: `StorageSource.full_scan_chunked()` / `incremental_scan_chunked()` → discover files → parse metadata via `music_tag` → call `manager.register_or_merge_song()` → auto-merge by title+album+artist into master entities. State tracked via `ScanState` (mtime + size per file path).

**Quality scoring**: Songs are deduplicated across sources by fingerprint. When multiple source files map to one master song, `get_best_audio_stream()` selects the best source by Quality score (HiRes > Lossless > Normal > Standard).

### Frontend (Vue 3 + Vite)

```
src/
  main.js              — App entry: creates Vue app, registers global components, router
  App.vue              — Root component: orchestrates layout, manages player state, OOBE flow
  style.css            — Global styles
  api/
    manager.js         — Unified API entry: exports sourceManager, Track, Artist, Album, TrackList
    source/
      base.js          — Source abstract base class defining the API interface contract
      index.js         — SourceManager: registers/manages multiple API sources (tauri, web)
      tauri.js         — TauriSource: implements Source for native Tauri backend
      web.js           — WebSource: stub for future web/cloud music source
    resources/
      index.js         — Track, Artist, Album, TrackList data classes with lazy resource loading,
                         ref-counted object URL management via Resource/ResourcePool
    lazyLoader.js      — LazyLoader: on-demand loading + caching for album covers and music files
    performanceMonitor.js — Frontend performance tracking (resource load times, cache hit rates)
  router/
    index.js           — Vue Router config with hash history
  components/
    base/              — Reusable primitives: contextMenu, dialog, toggle, suspendingBox, tippy,
                         DropdownMenu, hoverMenu, lazyLoadImage, lazyLoadCoverImage, text-spawn
    topBar/            — Custom title bar (decorations: false), title component
    titleRegistrater/  — Page title registration
    tracks/            — Music library views: tracksRow, powerTable, folder, conditioner,
                         composables (useMusicTable), virtual list utils
    musicInfoPageComponents/ — Now-playing view: lyric, lyric-line-wordbyword, background, buttons,
                         cover art, play mode controls
  js/
    lyricParser.js     — Parses LRC, YRC (NetEase), and BLF (custom JSON) lyric formats
    musicPlayer.js     — Audio playback stub
    drag.js            — Drag-and-drop utilities
    baseMethods.js     — Common utility functions
    loadTauri.js       — Tauri init helpers
    search/index.js    — Search utilities
  router/routers/      — Page components: home, search, allMusic, musicFolder, musicTrack,
                         setting, dataManager, album/artist detail, demo
```

## Key Architecture Decisions

- **Dual-object model (Master/Source)**: Separates logical entities (MasterSong/MasterAlbum/MasterArtist) from source-specific records. Enables multi-source merge (e.g., local file + NetEase metadata for the same song).
- **ULID-based ObjectIds**: Prefixed IDs (`m_song_`, `r_album_`, etc.) enable prefix-based type identification. Source records use `(source_id, external_id)` external_index for dedup.
- **Source abstraction**: Frontend talks to a `Source` interface (`base.js`). Backend has matching `Source` trait with implementations for local, temp, webdev. `SourceManager` routes requests by source ID.
- **Quality-based source selection**: When multiple files represent the same song, `get_best_audio_stream()` picks the best by Quality score. Quality determined from format, sample rate, bit depth, bitrate.
- **Two-layer persistence**: Library state persisted as JSON (`library.json`, `scan_state.json`, `playlists.json`) via serde. Album cover caching via WebP files on disk (handled by `get_album_cover` Tauri command).
- **Custom title bar**: `decorations: false` in tauri.conf.json. Window controls wired in `main.js`.
- **Global components**: Several components registered globally in `main.js`: iconToClick, iconWithText, toggle, bodytitle, textspawn, iconFlexRow, dialog_custom, suspendingBox, LazyLoadCoverImage.
- **Lazy resource loading**: Album covers and music files loaded on-demand via `LazyLoader` (frontend) + Tauri commands (backend), with ref-counted object URL management.

## Tauri Commands (Rust -> Frontend)

Defined in `lib.rs` `invoke_handler`. Key groups:
- **Library**: `init_application`, `get_music_list`, `get_all_my_albums`, `get_all_my_artists`
- **Detail**: `get_album_by_id`, `get_artist_by_id`, `get_albums_songs_by_id`, `get_artists_songs_by_id`
- **Resources**: `get_album_cover`, `get_low_quality_album_cover`, `get_music_file`
- **Directories**: `get_all_music_dirs`, `add_music_dirs`, `remove_music_dirs`, `add_users_music_dir`, `get_users_music_dir`
- **Scan**: `refresh_music_cache`, `perform_incremental_scan`, `perform_full_scan`
- **Cache**: `get_cache_size_info`, `clear_image_cache`, `reset_all_data`, `is_cache_valid`, `get_cache_stats`, `clear_music_cache`
- **Performance**: `get_performance_stats`, `get_performance_report`, `reset_performance_stats`, `record_resource_load`, `start_performance_timer`, `end_performance_timer`
- **Other**: `close_app`

## Supported Audio Formats

MP3, FLAC, OGG, WAV, M4A, AAC (detected by extension in `modules/music_library/source/storage.rs`)

## Lyric Formats

- **LRC** — Standard timestamped lyrics (`[mm:ss.xx]text`)
- **YRC** — NetEase word-level timestamped lyrics with per-word timing
- **BLF** — Custom JSON format with word-level precision
