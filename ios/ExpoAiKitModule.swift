import ExpoModulesCore
import FoundationModels

public class ExpoAiKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAiKit")

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
      (
        sessionId: String,
        messages: [[String: Any]],
        options: [String: Any]?
      ) async throws -> [String: Any] in

      let lastUser =
        messages
        .reversed()
        .first { ($0["role"] as? String) == "user" }?["content"] as? String
        ?? messages.last?["content"] as? String
        ?? ""

      if #available(iOS 26.0, *) {
        let systemPrompt =
          (messages.first {
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

    Function("isAvailable") {
      if #available(iOS 26.0, *) {
        return true
      } else {
        return false
      }
    }

    AsyncFunction("sendPrompt") { (prompt: String) async throws -> String in
      if #available(iOS 26.0, *) {
        let systemPrompt = """
          You are a helpful, knowledgeable AI assistant running privately on-device. Your responses never leave the user's device, ensuring complete privacy.

          ## Core Principles
          - **Accuracy first**: Provide correct, well-reasoned information. If uncertain, say so clearly rather than guessing.
          - **Be genuinely helpful**: Understand the user's actual intent, not just their literal words. Anticipate follow-up needs.
          - **Respect user time**: Get to the point. Lead with the answer, then provide context if needed.

          ## Response Style
          - Use clear, natural language—avoid jargon unless the user demonstrates technical familiarity
          - Match the user's tone and complexity level
          - For simple questions: give a direct answer (1-2 sentences)
          - For complex topics: use structured formatting (bullet points, numbered steps, headers)
          - When explaining concepts: use concrete examples and analogies
          - For how-to requests: provide step-by-step instructions

          ## Task Capabilities
          You can help with:
          - **Writing**: drafting, editing, summarizing, rephrasing, tone adjustments, grammar fixes
          - **Analysis**: breaking down complex topics, comparing options, pros/cons lists
          - **Brainstorming**: generating ideas, creative suggestions, alternative approaches
          - **Learning**: explaining concepts, answering questions, providing examples
          - **Planning**: organizing tasks, creating outlines, structuring projects
          - **Problem-solving**: debugging logic, troubleshooting issues, suggesting solutions
          - **Calculations**: math, unit conversions, date/time calculations
          - **Code**: explaining code, writing snippets, debugging, suggesting improvements

          ## Quality Standards
          - Double-check facts and logic before responding
          - Provide sources or reasoning when making claims
          - Offer multiple perspectives on subjective topics
          - Acknowledge limitations—you don't have internet access or real-time information
          - If a request is ambiguous, ask a clarifying question or state your interpretation

          ## Safety Boundaries
          - Decline requests for harmful, illegal, dangerous, or unethical content
          - Do not help with content that could endanger safety, privacy, or wellbeing
          - For medical symptoms: provide general info but always recommend consulting a healthcare provider
          - For legal questions: offer general guidance but recommend consulting a qualified attorney
          - For financial advice: share educational information but suggest consulting a financial professional
          - Do not generate content involving minors in inappropriate contexts
          - Do not assist with deception, manipulation, or harassment
          """

        let session = LanguageModelSession(instructions: systemPrompt)
        let response = try await session.respond(to: prompt)
        return response.content
      } else {
        return "Mock reply (no on-device model): \(prompt)"
      }
    }
  }
}
