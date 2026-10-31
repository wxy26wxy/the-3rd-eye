import AVFoundation
import SwiftUI

/// The mascot (photographic green monster from the Sky boards). Decorative unless given a label.
/// - `.book`: reading a book (`mascot-book`, sticker cut-out).
/// - `.front`: standing, facing front (`mascot-front`).
/// - `.magnifier`: searching with a magnifier, a muted looping video (`mascot-magnifier.mp4`);
///   with Reduce Motion on it is the still `mascot-front` instead.
struct TagMascot: View {
  enum Pose { case book, front, magnifier }

  let pose: Pose
  var size: CGFloat = Theme.Size.record * 1.6
  var label: LocalizedStringKey?
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    Group {
      if pose == .magnifier && !reduceMotion {
        LoopingVideo(resource: Tokens.Asset.mascotMagnifier)
      } else {
        Image(pose == .book ? Tokens.Asset.mascotBook : Tokens.Asset.mascotFront)
          .resizable()
          .scaledToFit()
      }
    }
    .frame(width: size, height: size)
    .accessibilityElement()
    .accessibilityLabel(label.map { Text($0) } ?? Text(""))
    .accessibilityAddTraits(.isImage)
    .accessibilityHidden(label == nil)
  }
}

/// A muted, looping, aspect-filling MP4 from `Resources/Animations` (no controls).
/// Draws nothing if the file is missing.
struct LoopingVideo: UIViewRepresentable {
  let resource: String

  func makeUIView(context: Context) -> PlayerView {
    let view = PlayerView()
    view.isUserInteractionEnabled = false
    guard let url = Bundle.main.url(forResource: resource, withExtension: "mp4") else { return view }
    let player = AVQueuePlayer()
    player.isMuted = true
    player.preventsDisplaySleepDuringVideoPlayback = false
    // The MP4 has no audio track; muted as well so no sound can ever play.
    player.audiovisualBackgroundPlaybackPolicy = .pauses
    context.coordinator.looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url))
    view.playerLayer.player = player
    view.playerLayer.videoGravity = .resizeAspectFill
    player.play()
    return view
  }

  func updateUIView(_ uiView: PlayerView, context: Context) {}

  static func dismantleUIView(_ uiView: PlayerView, coordinator: Coordinator) {
    uiView.playerLayer.player?.pause()
    coordinator.looper = nil
  }

  func makeCoordinator() -> Coordinator { Coordinator() }

  final class Coordinator {
    var looper: AVPlayerLooper?
  }

  final class PlayerView: UIView {
    override static var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
  }
}
