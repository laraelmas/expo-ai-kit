import ExpoModulesCore
import FoundationModels

public class ExpoAiKitModule: Module {
  // Track active streaming tasks for cancellation
  private var activeStreamTasks: [String: Task<Void, Never>] = [:]

  public func definition() -> ModuleDefinition {
    Name("ExpoAiKit")

    // Declare events that can be sent to JavaScript
    Events("onStreamToken")

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

    AsyncFunction("startStreaming") {
      (
        messages: [[String: Any]],
        fallbackSystemPrompt: String,
        sessionId: String
      ) in

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
        // Create a task for streaming that can be cancelled
        let task = Task {
          do {
            let session = LanguageModelSession(instructions: systemPrompt)
            let stream = session.streamResponse(to: userPrompt)
            var accumulatedText = ""

            for try await partialResponse in stream {
              // Check for cancellation
              if Task.isCancelled { break }

              let currentText = partialResponse.content
              let newToken = String(currentText.dropFirst(accumulatedText.count))
              accumulatedText = currentText

              // Send token event to JavaScript
              self.sendEvent("onStreamToken", [
                "sessionId": sessionId,
                "token": newToken,
                "accumulatedText": accumulatedText,
                "isDone": false
              ])
            }

            // Send final event
            if !Task.isCancelled {
              self.sendEvent("onStreamToken", [
                "sessionId": sessionId,
                "token": "",
                "accumulatedText": accumulatedText,
                "isDone": true
              ])
            }
          } catch {
            // Send error as final event
            self.sendEvent("onStreamToken", [
              "sessionId": sessionId,
              "token": "",
              "accumulatedText": "[Error: \(error.localizedDescription)]",
              "isDone": true
            ])
          }

          // Clean up
          self.activeStreamTasks.removeValue(forKey: sessionId)
        }

        self.activeStreamTasks[sessionId] = task
      } else {
        // Fallback for older iOS versions - send single response
        self.sendEvent("onStreamToken", [
          "sessionId": sessionId,
          "token": "[On-device AI requires iOS 26+]",
          "accumulatedText": "[On-device AI requires iOS 26+]",
          "isDone": true
        ])
      }
    }

    AsyncFunction("stopStreaming") { (sessionId: String) in
      if let task = self.activeStreamTasks[sessionId] {
        task.cancel()
        self.activeStreamTasks.removeValue(forKey: sessionId)
      }
    }
  }
}
