package expo.modules.aikit

import android.os.Build
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext

class PromptApiClient {

  private val model by lazy { Generation.getClient() }

  // ✅ suspend version (matches ML Kit's checkStatus usage)
  // Returns true if device supports Prompt API (AVAILABLE, DOWNLOADABLE, or DOWNLOADING)
  // Returns false if unsupported or on API < 26
  suspend fun isAvailable(): Boolean {
    // Prompt API requires API 26+
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false

    return try {
      when (model.checkStatus()) {
        FeatureStatus.AVAILABLE,
        FeatureStatus.DOWNLOADABLE,
        FeatureStatus.DOWNLOADING -> true
        else -> false
      }
    } catch (_: Throwable) {
      // Covers: missing AICore / Gemini Nano not supported / config not fetched / etc.
      false
    }
  }

  // ✅ non-suspend wrapper so Expo Module can call it without Coroutine DSL ambiguity
  fun isAvailableBlocking(): Boolean = runBlocking {
    isAvailable()
  }

  suspend fun generateText(prompt: String): String = withContext(Dispatchers.IO) {
    // Prompt API requires API 26+
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@withContext ""

    try {
      val status = model.checkStatus()
      if (status != FeatureStatus.AVAILABLE) {
        return@withContext ""
      }

      // safest + simplest API across ML Kit alpha versions
      val response = model.generateContent(prompt)
      response.candidates.firstOrNull()?.text.orEmpty()
    } catch (_: Throwable) {
      ""
    }
  }
}
