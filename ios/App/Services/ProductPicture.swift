import Foundation

/// The picture creator screens show for a product (T122 R1). The AI mockup re-draws the art and
/// changes its proportions, so it is never used here (it stays on the buyer side): a sticker shows
/// its bordered preview (`previewUrl`), a tote bag the cut-out art on the card; each falls back to
/// the art when the server has no preview yet.
enum ProductPicture {
  static func url(type: ProductType?, product: Product?, artwork: Artwork?) -> URL? {
    let art = artwork?.cleanedUrl.flatMap(URL.init(string:)) ?? artwork?.displayURL
    guard type != .tote, let preview = product?.previewUrl, !preview.isEmpty else { return art }
    return URL(string: preview) ?? art
  }
}
