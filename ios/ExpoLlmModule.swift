import ExpoModulesCore
import FoundationModels

public class ExpoLlmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoLlm")

    AsyncFunction("prepareModel") { (_: [String: Any]?) async throws in
      if #available(iOS 26.0, *) {
        _ = SystemLanguageModel.default  
      } else {
        //
      }
    }

    AsyncFunction("createSession") { (_: [String: Any]?) -> String in
      UUID().uuidString
    }

    AsyncFunction("sendMessage") {
  (sessionId: String,
   messages: [[String: Any]],
   options: [String: Any]?
  ) async throws -> [String: Any] in

  let lastUser = messages
    .reversed()
    .first { ($0["role"] as? String) == "user" }?["content"] as? String
    ?? messages.last?["content"] as? String
    ?? ""

  if #available(iOS 26.0, *) {
    let systemPrompt = (messages.first {
      ($0["role"] as? String) == "system"
    }?["content"] as? String) ?? """
    You are a helpful, friendly assistant.
    Answer the user's question directly and concisely.
    If the question is unsafe, politely refuse, otherwise just answer.
    """

    let session = LanguageModelSession(instructions: systemPrompt)

    let response = try await session.respond(to: lastUser)

 
    let replyText = response.content   

    return ["reply": replyText]
  } else {
    let replyText = "Mock reply (no on-device model): \(lastUser)"
    return ["reply": replyText]
  }
}
  }
}