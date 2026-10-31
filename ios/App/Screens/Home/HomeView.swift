import SwiftUI

enum OrderRoute: Hashable {
  case detail(String)
  case thankYou(String)
}

struct HomeView: View {
  @Environment(AppState.self) private var app
  var body: some View {
    @Bindable var app = app
    TabView(selection: $app.selectedTab) {
      NavigationStack(path: $app.createPath) {
        PickProductView()
          .navigationDestination(for: CreateRoute.self) { CreateDestination(route: $0) }
      }
      .toolbar(.hidden, for: .tabBar)
      .safeAreaInset(edge: .bottom, spacing: 0) { tabBar }
      .tag(HomeTab.create)

      NavigationStack(path: $app.designsPath) {
        MyDesignsView()
          .navigationDestination(for: DesignRoute.self) { DesignDestination(route: $0) }
      }
      .toolbar(.hidden, for: .tabBar)
      .safeAreaInset(edge: .bottom, spacing: 0) { tabBar }
      .tag(HomeTab.designs)

      NavigationStack {
        OrdersView()
          .navigationDestination(for: OrderRoute.self) { OrderDestination(route: $0) }
      }
      .toolbar(.hidden, for: .tabBar)
      .safeAreaInset(edge: .bottom, spacing: 0) { tabBar }
      .tag(HomeTab.orders)

      NavigationStack {
        MessagesView()
          .navigationDestination(for: OrderRoute.self) { OrderDestination(route: $0) }
      }
      .toolbar(.hidden, for: .tabBar)
      .safeAreaInset(edge: .bottom, spacing: 0) { tabBar }
      .tag(HomeTab.messages)
    }
    .onAppear { app.orders.start() }
  }

  /// The Sky tab bar replaces the system one (decision T103). Each tab carries it as a bottom
  /// inset, so screens (and their bottom actions) end above it on every pushed screen too; the
  /// TabView underneath keeps each tab's navigation stack and screen state while another is shown.
  private var tabBar: some View {
    @Bindable var app = app
    return HomeTabBar(selection: $app.selectedTab, ordersBadge: app.orders.unread,
                      messagesBadge: app.orders.orders.reduce(0) { $0 + ($1.unreadMessages ?? 0) })
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
