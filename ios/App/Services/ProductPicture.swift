import Foundation

/// The picture creator screens show for a product (round 3 ruling 1): the AI product photo
/// (`mockupUrl`, the Muse Image mockup) for a sticker and a tote bag alike; the sticker's bordered
/// die-cut preview (`previewUrl`) when there is no mockup yet; the cut-out art when the server has
/// no picture at all.
enum ProductPicture {
  static func url(type: ProductType?, product: Product?, artwork: Artwork?) -> URL? {
    let art = artwork?.cleanedUrl.flatMap(URL.init(string:)) ?? artwork?.displayURL
    let picture = [product?.mockupUrl, product?.previewUrl].compactMap { $0 }.first { !$0.isEmpty }
    guard let picture else { return art }
    return URL(string: picture) ?? art
  }
}
