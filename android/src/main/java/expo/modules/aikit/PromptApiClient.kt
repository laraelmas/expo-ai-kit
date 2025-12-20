package expo.modules.aikit

import android.os.Build
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext

class PromptApiClient {

  private val model by lazy { Generation.getClient() }

  /**
   * Check if on-device AI is available.
   * Returns true if device supports Prompt API (AVAILABLE, DOWNLOADABLE, or DOWNLOADING).
   * Returns false if unsupported or on API < 26.
   */
  suspend fun isAvailable(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false

    return try {
      when (model.checkStatus()) {
        FeatureStatus.AVAILABLE,
        FeatureStatus.DOWNLOADABLE,
        FeatureStatus.DOWNLOADING -> true
        else -> false
      }
    } catch (_: Throwable) {
      false
    }
  }

  /**
   * Non-suspend wrapper for Expo module compatibility.
   */
  fun isAvailableBlocking(): Boolean = runBlocking { isAvailable() }

  /**
   * Generate text from a prompt.
   * On Android, we concatenate system prompt + user message since ML Kit
   * doesn't have a separate system prompt API.
   */
  suspend fun generateText(prompt: String, systemPrompt: String): String =
    withContext(Dispatchers.IO) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@withContext ""

      try {
        val status = model.checkStatus()
        if (status != FeatureStatus.AVAILABLE) {
          return@withContext ""
        }

        // Prepend system prompt as context if provided
        val fullPrompt = if (systemPrompt.isNotBlank()) {
          "$systemPrompt\n\nUser: $prompt"
        } else {
          prompt
        }

        val response = model.generateContent(fullPrompt)
        response.candidates.firstOrNull()?.text.orEmpty()
      } catch (_: Throwable) {
        ""
      }
    }
}
