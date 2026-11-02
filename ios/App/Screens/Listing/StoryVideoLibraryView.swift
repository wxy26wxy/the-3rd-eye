import AVFoundation
import AVKit
import SwiftUI

/// The creator's story video as the Create tab shows it (T122 R6).
enum StoryVideoState: Equatable {
  case none
  /// `GET /creators/me` `storyVideoUrl`, served through `/media`.
  case recorded(URL)

  static func of(_ creator: Creator?) -> StoryVideoState {
    guard let pathname = creator?.storyVideoUrl, let url = AppConfig.mediaURL(pathname: pathname) else { return .none }
    return .recorded(url)
  }

  var url: URL? {
    if case .recorded(let url) = self { return url }
    return nil
  }

  /// The row's second line: "Recorded 2 Nov 2026", "Recorded" when the date is not known yet, or
  /// "No story video yet".
  func detail(recorded date: Date?) -> String {
    switch self {
    case .none: return String(localized: "No story video yet")
    case .recorded:
      guard let date else { return String(localized: "Recorded") }
      return String(localized: "Recorded \(date.formatted(date: .abbreviated, time: .omitted))")
    }
  }
}

/// WebVTT cues (`Creator.storyVideoVtt`, the captions the server wrote from the soundtrack), shown
/// under the player as it plays.
struct Captions: Equatable {
  struct Cue: Equatable {
    let start: Double
    let end: Double
    let text: String
  }

  let cues: [Cue]

  init(cues: [Cue]) { self.cues = cues }

  /// Reads `00:00:01.000 --> 00:00:03.500` (or `00:01.000`) timing lines and the text lines under
  /// each; cue ids, settings after the times and `<…>` tags are dropped. Anything unreadable is skipped.
  init(vtt: String?) {
    var cues: [Cue] = []
    let blocks = (vtt ?? "").replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n\n")
    for block in blocks {
      let lines = block.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
      guard let timing = lines.firstIndex(where: { $0.contains("-->") }) else { continue }
      let parts = lines[timing].components(separatedBy: "-->")
      guard parts.count == 2,
            let start = Self.seconds(parts[0]),
            let end = Self.seconds(parts[1].split(separator: " ", omittingEmptySubsequences: true).first.map(String.init) ?? "") else { continue }
      let text = lines[(timing + 1)...]
        .joined(separator: " ")
        .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        .trimmingCharacters(in: .whitespaces)
      if !text.isEmpty { cues.append(Cue(start: start, end: end, text: text)) }
    }
    self.cues = cues
  }

  /// The cue showing at `time` seconds, if any.
  func text(at time: Double) -> String? {
    cues.first { time >= $0.start && time < $0.end }?.text
  }

  /// `hh:mm:ss.mmm` or `mm:ss.mmm` → seconds.
  static func seconds(_ raw: String) -> Double? {
    let fields = raw.trimmingCharacters(in: .whitespaces).split(separator: ":").map { Double($0.replacingOccurrences(of: ",", with: ".")) }
    guard (2...3).contains(fields.count), fields.allSatisfy({ $0 != nil }) else { return nil }
    return fields.compactMap { $0 }.reduce(0) { $0 * 60 + $1 }
  }
}

/// First frame and recording date of a story video (`AVAssetImageGenerator`, the movie's
/// creation date); nil for what cannot be read.
enum StoryVideoPreview {
  static func load(_ url: URL) async -> (frame: UIImage?, date: Date?) {
    let asset = AVURLAsset(url: url)
    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.maximumSize = CGSize(width: Theme.Size.record * 3, height: Theme.Size.record * 3)
    let frame = (try? await generator.image(at: .zero).image).map { UIImage(cgImage: $0) }
    let item = try? await asset.load(.creationDate)
    let date = try? await item?.load(.dateValue)
    return (frame, date)
  }
}

/// Create tab row under the product choice: the video's first frame, "My story video" and when it
/// was recorded (or "No story video yet"), a chevron; opens My story video. One VoiceOver button.
struct StoryVideoRow: View {
  let state: StoryVideoState
  let open: () -> Void
  @Environment(\.themeColors) private var colors
  @State private var frame: UIImage?
  @State private var date: Date?

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
    Button(action: open) {
      HStack(spacing: Theme.Space.m) {
        thumbnail
        VStack(alignment: .leading, spacing: Theme.Space.xs) {
          Text("My story video").themeFont(.titleM).foregroundStyle(colors.text)
          Text(state.detail(recorded: date)).themeFont(.bodyS).foregroundStyle(colors.textMuted)
        }
        .multilineTextAlignment(.leading)
        .fixedSize(horizontal: false, vertical: true)
        Spacer(minLength: 0)
        Image(Tokens.Asset.iconChevronRight)
          .renderingMode(.template)
          .resizable()
          .scaledToFit()
          .frame(width: ThemeEffects.iconGlyph, height: ThemeEffects.iconGlyph)
          .foregroundStyle(colors.text)
          .accessibilityHidden(true)
      }
      .padding(Theme.Space.m)
      .frame(maxWidth: .infinity, minHeight: Theme.Size.minTarget, alignment: .leading)
      .background(shape.fill(colors.surface))
      .overlay(shape.strokeBorder(colors.border, lineWidth: Theme.Border.thin))
      .contentShape(shape)
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text("My story video") + Text(verbatim: ", ") + Text(state.detail(recorded: date)))
    .accessibilityHint(Text("Watch it or record it again"))
    .accessibilityAddTraits(.isButton)
    .accessibilityIdentifier("story-video-row")
    .task(id: state) {
      frame = nil
      date = nil
      guard let url = state.url else { return }
      let preview = await StoryVideoPreview.load(url)
      frame = preview.frame
      date = preview.date
    }
  }

  private var thumbnail: some View {
    let shape = RoundedRectangle(cornerRadius: ThemeEffects.thumbRadius, style: .continuous)
    return ZStack {
      shape.fill(colors.surfaceAlt)
      if let frame {
        Image(uiImage: frame).resizable().scaledToFill()
      } else {
        Image(systemName: state == .none ? "video.badge.plus" : "play.fill")
          .font(TextRole.titleL.font)
          .foregroundStyle(colors.textMuted)
      }
    }
    .frame(width: Theme.Size.iconButton + Theme.Space.l, height: Theme.Size.iconButton + Theme.Space.l)
    .clipShape(shape)
    .accessibilityHidden(true)
  }
}

/// "My story video" (T122 R6, board B2): the video with its captions, whether the story mentions the
/// creator's disability, and "Record again" (Story video in its redo mode, which comes back here;
/// the new video replaces the old one on every product). Without a video: the sky card and
/// "Record my video".
struct StoryVideoLibraryView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var player: AVPlayer?
  @State private var caption: String?

  private var state: StoryVideoState { .of(app.creator) }
  private var captions: Captions { Captions(vtt: app.creator?.storyVideoVtt) }

  var body: some View {
    FlowScreen(title: "My story video", subtitle: "Buyers see it when they tap the story tag on your products.") {
      VStack(alignment: .leading, spacing: Theme.Space.l) {
        if state.url != nil {
          playerCard
          if let caption {
            Text(caption)
              .themeFont(.bodyL)
              .foregroundStyle(colors.text)
              .frame(maxWidth: .infinity, alignment: .center)
              .multilineTextAlignment(.center)
              .accessibilityIdentifier("story-caption")
          }
          disabilityCard
          if app.flow.storyVideoTrimmed {
            Text("Your video was longer than 30 seconds, so we kept the first 30.")
              .themeFont(.body)
              .foregroundStyle(colors.text)
          }
        } else {
          SkyCard(pose: .front)
          Text("No story video yet").themeFont(.titleL).foregroundStyle(colors.text)
          Text("Record a short video, about 30 seconds, so buyers can meet you.")
            .themeFont(.body)
            .foregroundStyle(colors.textMuted)
        }
      }
    } actions: {
      PillButton(state.url != nil ? "Record again" : "Record my video",
                 hint: state.url != nil ? "Replaces your story video on every product" : "Opens the camera for up to 30 seconds") {
        player?.pause()
        app.push(.recordStoryAgain)
      }
    }
    .task { await app.refreshCreator() }
    .task(id: state) { await play(state.url) }
    .onDisappear { player?.pause() }
  }

  private var playerCard: some View {
    let shape = RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
    return Group {
      if let player {
        VideoPlayer(player: player)
      } else {
        colors.surfaceAlt
      }
    }
    .aspectRatio(ThemeEffects.storyVideoAspect, contentMode: .fit)
    .frame(maxWidth: .infinity, maxHeight: Theme.photoMaxHeight)
    .clipShape(shape)
    .overlay(shape.strokeBorder(colors.border, lineWidth: Theme.Border.thin))
    .accessibilityLabel(Text("Your story video"))
    .accessibilityIdentifier("story-player")
  }

  /// Figma `Toggle row` as a read-only line: the setting chosen when the video was recorded.
  private var disabilityCard: some View {
    let on = app.creator?.mentionDisability == true
    return Card(padding: Theme.Space.l) {
      HStack(alignment: .top, spacing: Theme.Space.m) {
        VStack(alignment: .leading, spacing: Theme.Space.xs) {
          Text("Mention my disability").themeFont(.titleM).foregroundStyle(colors.text)
          Text(on ? "Your story may say it. Record again to change this." : "Your story never says it. Record again to change this.")
            .themeFont(.bodyS)
            .foregroundStyle(colors.textMuted)
        }
        Spacer(minLength: 0)
        Text(on ? "On" : "Off").themeFont(.titleM).foregroundStyle(colors.text)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("story-disability")
  }

  /// A new player for `url`, and the caption under it kept in step with the playhead.
  private func play(_ url: URL?) async {
    player?.pause()
    caption = nil
    guard let url else {
      player = nil
      return
    }
    let next = AVPlayer(url: url)
    player = next
    let cues = captions
    while !Task.isCancelled {
      let time = next.currentTime().seconds
      let text = time.isFinite ? cues.text(at: time) : nil
      if text != caption { caption = text }
      try? await Task.sleep(for: .milliseconds(250))
    }
  }
}
