package expo.modules.aikit

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine

class ExpoAiKitModule : Module() {

  private val promptClient by lazy { PromptApiClient() }

  override fun definition() = ModuleDefinition {
    Name("ExpoAiKit")

    // Returns true if device supports Prompt API (AVAILABLE/DOWNLOADABLE/DOWNLOADING)
    // Returns false on unsupported devices, never crashes
    AsyncFunction("isAvailable") {
      promptClient.isAvailableBlocking()
    }

    AsyncFunction("sendPrompt") Coroutine { prompt: String ->
      promptClient.generateText(prompt)
    }
  }
}
