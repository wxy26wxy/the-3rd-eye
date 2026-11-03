import Foundation

/// The picture creator screens show for a product. A sticker shows its bordered die-cut preview
/// (`previewUrl`, T122 R1); a tote bag its Muse Image mockup (`mockupUrl`, user ruling T131: the AI
/// tote photo, proportions caveat accepted). Each falls back to the cut-out art when the server has
/// no picture yet.
enum ProductPicture {
  static func url(type: ProductType?, product: Product?, artwork: Artwork?) -> URL? {
    let art = artwork?.cleanedUrl.flatMap(URL.init(string:)) ?? artwork?.displayURL
    let picture = type == .tote ? product?.mockupUrl : product?.previewUrl
    guard let picture, !picture.isEmpty else { return art }
    return URL(string: picture) ?? art
  }
}
