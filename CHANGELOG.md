# Changelog

## 0.2.0

### Added

- **Model abstraction layer** with two-tier model system separating built-in (OS-provided) models from downloadable models
  - `BuiltInModel` type for OS-provided models (Apple Foundation Models, ML Kit)
  - `DownloadableModel` type with full lifecycle tracking (`not-downloaded` -> `downloading` -> `loading` -> `ready`)
- **Model registry** (`src/models.ts`) with metadata for Gemma 4 E2B and E4B models (download URL, SHA256, size, context window, min RAM, supported platforms)
- **Model management API**: `getBuiltInModels()`, `getDownloadableModels()`, `downloadModel()`, `deleteModel()`, `setModel()`, `getActiveModel()`, `unloadModel()`
- **React hooks**: `useModel(modelId)` for managing downloadable model lifecycle (status, progress, download, delete) and `useAvailableModels()` for discovering all models
- **`ModelError`** class with typed error codes (`MODEL_NOT_FOUND`, `MODEL_NOT_DOWNLOADED`, `DOWNLOAD_CORRUPT`, `INFERENCE_OOM`, etc.)
- **Context window support** in `ChatMemoryManager`: new `contextWindow` option and `setContextWindow()` method. History is now trimmed by both turn count and token budget (whichever limit is hit first)

### Note

Native backends for downloadable models (MediaPipe, llama.cpp) are not yet implemented. The new TypeScript APIs are available and fully typed, but `setModel()`, `downloadModel()`, and related native calls will throw until native support lands in a future release. Built-in model behavior is unchanged.
