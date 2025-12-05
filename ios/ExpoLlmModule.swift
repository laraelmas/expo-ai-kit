import ExpoModulesCore

public class ExpoLlmModule: Module {
  public func definition() -> ModuleDefinition {
    // 🔴 JS tarafındaki requireNativeModule ile bire bir aynı isim
    Name("ExpoLlm")

    AsyncFunction("prepareModel") { (_: [String: Any]?) in
      // şimdilik boş
    }

    AsyncFunction("createSession") { (_: [String: Any]?) -> String in
      UUID().uuidString
    }

    AsyncFunction("sendMessage") {
      (sessionId: String,
       messages: [[String: Any]],
       options: [String: Any]?
      ) -> [String: Any] in

      let lastUser = messages
        .compactMap { $0["content"] as? String }
        .last ?? ""

      let replyText = "Mock reply (iOS): \(lastUser)"

      return ["reply": replyText]
    }
  }
}