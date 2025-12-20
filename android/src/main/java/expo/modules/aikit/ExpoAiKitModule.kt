package expo.modules.aikit

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine

class ExpoAiKitModule : Module() {

  private val promptClient by lazy { PromptApiClient() }

  override fun definition() = ModuleDefinition {
    Name("ExpoAiKit")

    Function("isAvailable") {
      promptClient.isAvailableBlocking()
    }

    AsyncFunction("sendMessage") Coroutine { messages: List<Map<String, Any>>, fallbackSystemPrompt: String ->
      // Extract system prompt from messages, or use fallback
      val systemPrompt = messages
        .firstOrNull { it["role"] == "system" }
        ?.get("content") as? String
        ?: fallbackSystemPrompt.ifBlank { "You are a helpful, friendly assistant." }

      // Get the last user message as the prompt
      val userPrompt = messages
        .lastOrNull { it["role"] == "user" }
        ?.get("content") as? String
        ?: ""

      val text = promptClient.generateText(userPrompt, systemPrompt)
      mapOf("text" to text)
    }
  }
}
