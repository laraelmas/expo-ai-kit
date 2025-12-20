import ExpoModulesCore
import FoundationModels

public class ExpoAiKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAiKit")

    Function("isAvailable") {
      if #available(iOS 26.0, *) {
        return true
      } else {
        return false
      }
    }

    AsyncFunction("sendMessage") {
      (
        messages: [[String: Any]],
        fallbackSystemPrompt: String
      ) async throws -> [String: Any] in

      // Extract system prompt from messages, or use fallback
      let systemPrompt =
        messages
        .first { ($0["role"] as? String) == "system" }?["content"] as? String
        ?? (fallbackSystemPrompt.isEmpty
          ? "You are a helpful, friendly assistant."
          : fallbackSystemPrompt)

      // Get the last user message as the prompt
      let userPrompt =
        messages
        .reversed()
        .first { ($0["role"] as? String) == "user" }?["content"] as? String
        ?? ""

      if #available(iOS 26.0, *) {
        let session = LanguageModelSession(instructions: systemPrompt)
        let response = try await session.respond(to: userPrompt)
        return ["text": response.content]
      } else {
        return ["text": "[On-device AI requires iOS 26+]"]
      }
    }
  }
}
