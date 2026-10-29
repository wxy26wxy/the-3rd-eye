import Foundation

/// Tiny interpreter for spoken approvals ("yes", "yes please", "list it").
enum VoiceIntent {
  static func isYes(_ transcript: String) -> Bool {
    let words = transcript.lowercased()
      .components(separatedBy: CharacterSet.letters.inverted)
      .filter { !$0.isEmpty }
    if words.contains(where: { ["no", "not", "don", "dont", "stop", "wait", "nope"].contains($0) }) { return false }
    let yes: Set<String> = ["yes", "yeah", "yep", "yup", "sure", "ok", "okay", "approve", "list", "publish"]
    return words.contains(where: yes.contains)
  }
}
