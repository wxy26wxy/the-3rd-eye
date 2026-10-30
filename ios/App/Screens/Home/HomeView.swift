import SwiftUI

enum OrderRoute: Hashable {
  case detail(String)
  case thankYou(String)
}

struct HomeView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors

  var body: some View {
    @Bindable var app = app
    TabView(selection: $app.selectedTab) {
      NavigationStack(path: $app.createPath) {
        PickProductView()
          .navigationDestination(for: CreateRoute.self) { CreateDestination(route: $0) }
      }
      .tabItem { Label("Create", systemImage: "paintbrush.pointed.fill") }
      .tag(HomeTab.create)

      NavigationStack(path: $app.designsPath) {
        MyDesignsView()
          .navigationDestination(for: DesignRoute.self) { DesignDestination(route: $0) }
      }
      .tabItem { Label("My designs", systemImage: "square.grid.2x2.fill") }
      .tag(HomeTab.designs)

      NavigationStack {
        OrdersView()
          .navigationDestination(for: OrderRoute.self) { OrderDestination(route: $0) }
      }
      .tabItem { Label("Orders", systemImage: "shippingbox.fill") }
      .badge(app.orders.unread)
      .tag(HomeTab.orders)

      NavigationStack {
        MessagesView()
          .navigationDestination(for: OrderRoute.self) { OrderDestination(route: $0) }
      }
      .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right.fill") }
      .badge(app.orders.orders.reduce(0) { $0 + ($1.unreadMessages ?? 0) })
      .tag(HomeTab.messages)
    }
    .onAppear { app.orders.start() }
  }
}

private struct CreateDestination: View {
  let route: CreateRoute

  var body: some View {
    switch route {
    case .chooseMethod: ChooseMethodView()
    case .camera(let source): CameraView(source: source)
    case .findingDrawings: FindingDrawingsView()
    case .adjustCutout: AdjustCutoutView()
    case .speak: SpeakView()
    case .drawingYourIdea: DrawingYourIdeaView()
    case .voiceResult: VoiceResultView()
    case .designReady: DesignReadyView()
    case .listingDetails: ListingDetailsView()
    case .storyVideo: StoryVideoView()
    case .videoSaved: VideoSavedView()
    case .youreLive: YoureLiveView()
    }
  }
}

private struct DesignDestination: View {
  let route: DesignRoute

  var body: some View {
    switch route {
    case .detail(let id): DesignDetailView(artworkId: id)
    case .redoCutout: AdjustCutoutView(origin: .designs)
    }
  }
}

private struct OrderDestination: View {
  let route: OrderRoute

  var body: some View {
    switch route {
    case .detail(let id): OrderDetailView(orderId: id)
    case .thankYou(let id): ThankYouComposerView(orderId: id)
    }
  }
}
