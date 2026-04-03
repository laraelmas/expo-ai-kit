/**
 * Model Registry
 *
 * Defines all downloadable models known to expo-ai-kit.
 * getDownloadableModels() reads from this registry and enriches
 * each entry with on-device status from the native layer.
 */

export type ModelRegistryEntry = {
  /** Unique model identifier used in setModel/downloadModel */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Parameter count label */
  parameterCount: string;
  /** Quantization variant */
  quantization: string;
  /** URL to download the GGUF model file */
  downloadUrl: string;
  /** SHA256 hash for integrity verification after download */
  sha256: string;
  /** Download file size in bytes */
  sizeBytes: number;
  /**
   * Practical context window (max tokens) for this model on constrained devices.
   *
   * These are conservative defaults, NOT the base model's theoretical max (128k).
   * On a memory-constrained mobile device running quantized inference, KV cache
   * cannot fit the full 128k context. These values should be benchmarked and
   * adjusted during Phase 2 testing with real devices.
   */
  contextWindow: number;
  /** Minimum device RAM in bytes required to run this model */
  minRamBytes: number;
  /** Platforms this model can run on */
  supportedPlatforms: ('ios' | 'android')[];
};

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    id: 'gemma-e2b',
    name: 'Gemma 4 E2B',
    parameterCount: '2.3B',
    quantization: 'Q4_K_M',
    downloadUrl:
      'https://huggingface.co/google/gemma-4-e2b-it-GGUF/resolve/main/gemma-4-e2b-it-Q4_K_M.gguf',
    sha256: '', // TODO: Fill with actual hash once model file is verified
    sizeBytes: 1_400_000_000, // ~1.4GB
    // Conservative limit for 4GB RAM devices. Base model supports 128k but
    // KV cache won't fit. TODO: Benchmark during Phase 2 testing.
    contextWindow: 8_000,
    minRamBytes: 4_000_000_000, // 4GB
    supportedPlatforms: ['ios', 'android'],
  },
  {
    id: 'gemma-e4b',
    name: 'Gemma 4 E4B',
    parameterCount: '4.5B',
    quantization: 'Q4_K_M',
    downloadUrl:
      'https://huggingface.co/google/gemma-4-e4b-it-GGUF/resolve/main/gemma-4-e4b-it-Q4_K_M.gguf',
    sha256: '', // TODO: Fill with actual hash once model file is verified
    sizeBytes: 2_800_000_000, // ~2.8GB
    // Conservative limit for 6GB RAM devices. Base model supports 128k but
    // KV cache won't fit. TODO: Benchmark during Phase 2 testing.
    contextWindow: 16_000,
    minRamBytes: 6_000_000_000, // 6GB
    supportedPlatforms: ['ios', 'android'],
  },
];

/**
 * Look up a model registry entry by ID.
 * Returns undefined if not found.
 */
export function getRegistryEntry(modelId: string): ModelRegistryEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId);
}
