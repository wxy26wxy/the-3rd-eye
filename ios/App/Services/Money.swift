import Foundation

enum Money {
  /// Creator's share of a sale in cents: price × creator_bps / 10 000, rounded
  /// down to whole cents (the remainder stays with the organization).
  static func creatorShareCents(priceCents: Int, split: Split) -> Int {
    guard priceCents > 0, split.creatorBps > 0 else { return 0 }
    return priceCents * split.creatorBps / 10_000
  }

  static func format(cents: Int, currencyCode: String = "USD") -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = currencyCode
    return formatter.string(from: NSNumber(value: Double(cents) / 100)) ?? "$\(cents / 100)"
  }

  /// Parses "5", "5.5", "$5.50" into cents.
  static func cents(from text: String) -> Int? {
    let cleaned = text.filter { $0.isNumber || $0 == "." || $0 == "," }.replacingOccurrences(of: ",", with: ".")
    guard let value = Double(cleaned), value >= 0 else { return nil }
    return Int((value * 100).rounded())
  }
}
