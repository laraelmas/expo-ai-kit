package expo.modules.aikit

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import kotlinx.coroutines.Job
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.cancel

class ExpoAiKitModule : Module() {

  private val promptClient by lazy { PromptApiClient() }
  private val activeStreamJobs = mutableMapOf<String, Job>()
  private val streamScope = CoroutineScope(Dispatchers.IO)

  override fun definition() = ModuleDefinition {
    Name("ExpoAiKit")

    // Declare events that can be sent to JavaScript
    Events("onStreamToken")

    Function("isAvailable") {
      promptClient.isAvailableBlocking()
    }

    AsyncFunction("sendMessage") Coroutine { messages: List<Map<String, Any>>, fallbackSystemPrompt: String ->
      // Extract system prompt from messages, or use fallback
      val systemPrompt = messages
        .firstOrNull { it["role"] == "system" }
        ?.get("content") as? String
        ?: fallbackSystemPrompt.ifBlank { "You are a helpful, friendly assistant." }

      // Build conversation history prompt from all non-system messages
      // On-device models are stateless, so we must include full history in each request
      val conversationPrompt = messages
        .filter { it["role"] != "system" }
        .joinToString("\n") { msg ->
          val role = (msg["role"] as? String ?: "user").uppercase()
          val content = msg["content"] as? String ?: ""
          "$role: $content"
        } + "\nASSISTANT:"

      val text = promptClient.generateText(conversationPrompt, systemPrompt)
      mapOf("text" to text)
    }

    AsyncFunction("startStreaming") { messages: List<Map<String, Any>>, fallbackSystemPrompt: String, sessionId: String ->
      // Extract system prompt from messages, or use fallback
      val systemPrompt = messages
        .firstOrNull { it["role"] == "system" }
        ?.get("content") as? String
        ?: fallbackSystemPrompt.ifBlank { "You are a helpful, friendly assistant." }

      // Build conversation history prompt from all non-system messages
      // On-device models are stateless, so we must include full history in each request
      val conversationPrompt = messages
        .filter { it["role"] != "system" }
        .joinToString("\n") { msg ->
          val role = (msg["role"] as? String ?: "user").uppercase()
          val content = msg["content"] as? String ?: ""
          "$role: $content"
        } + "\nASSISTANT:"

      // Launch streaming in a coroutine that can be cancelled
      val job = streamScope.launch {
        promptClient.generateTextStream(conversationPrompt, systemPrompt) { token, accumulatedText, isDone ->
          sendEvent("onStreamToken", mapOf(
            "sessionId" to sessionId,
            "token" to token,
            "accumulatedText" to accumulatedText,
            "isDone" to isDone
          ))

          if (isDone) {
            activeStreamJobs.remove(sessionId)
          }
        }
      }

      activeStreamJobs[sessionId] = job
    }

    AsyncFunction("stopStreaming") { sessionId: String ->
      activeStreamJobs[sessionId]?.cancel()
      activeStreamJobs.remove(sessionId)
    }
  }
}
