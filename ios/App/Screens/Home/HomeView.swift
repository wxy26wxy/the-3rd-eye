import SwiftUI

enum OrderRoute: Hashable {
  case detail(String)
  case thankYou(String)
}

struct HomeView: View {
  @Environment(AppState.self) private var app
  @State private var ordersPath: [OrderRoute] = []
  @State private var messagesPath: [OrderRoute] = []
  var body: some View {
    @Bindable var app = app
    TabView(selection: $app.selectedTab) {
      NavigationStack(path: $app.createPath) {
        PickProductView()
          .navigationDestination(for: CreateRoute.self) { CreateDestination(route: $0) }
      }
      .modifier(TabPage(bar: tabBar))
      .tag(HomeTab.create)

      NavigationStack(path: $app.designsPath) {
        MyDesignsView()
          .navigationDestination(for: DesignRoute.self) { DesignDestination(route: $0) }
      }
      .modifier(TabPage(bar: tabBar))
      .tag(HomeTab.designs)

      NavigationStack(path: $ordersPath) {
        OrdersView()
          .navigationDestination(for: OrderRoute.self) { OrderDestination(route: $0) }
      }
      .modifier(TabPage(bar: tabBar))
      .tag(HomeTab.orders)

      NavigationStack(path: $messagesPath) {
        MessagesView()
          .navigationDestination(for: OrderRoute.self) { OrderDestination(route: $0) }
      }
      .modifier(TabPage(bar: tabBar))
      .tag(HomeTab.messages)
    }
    .onAppear { app.orders.start() }
  }

  /// The Sky tab bar replaces the system one (decision T103); the TabView underneath keeps each
  /// tab's navigation stack and screen state while another tab is shown.
  private var tabBar: some View {
    @Bindable var app = app
    return HomeTabBar(selection: $app.selectedTab, ordersBadge: app.orders.unread,
                      messagesBadge: app.orders.orders.reduce(0) { $0 + ($1.unreadMessages ?? 0) }) { tab in
      // Like the system tab bar: tapping the selected tab goes back to its first screen.
      switch tab {
      case .create: app.createPath = []
      case .designs: app.designsPath = []
      case .orders: ordersPath = []
      case .messages: messagesPath = []
      }
    }
  }
}

/// One tab's page: its navigation stack above the Sky tab bar (stacked, not overlaid, so no screen
/// content sits behind the bar, on pushed screens too). The system bar is hidden; the Sky bar steps
/// aside while the keyboard is up, as the system one did.
private struct TabPage<Bar: View>: ViewModifier {
  let bar: Bar
  @State private var keyboardUp = false

  func body(content: Content) -> some View {
    VStack(spacing: 0) {
      content
      if !keyboardUp { bar }
    }
    .toolbar(.hidden, for: .tabBar)
    .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardUp = true }
    .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardUp = false }
  }
}

private struct CreateDestination: View {
  let route: CreateRoute

  var body: some View {
    switch route {
    case .chooseMethod: ChooseMethodView()
    case .camera(let source): CameraView(source: source)
    case .adjustArea: AdjustAreaView()
    case .changeIt: ChangeItView()
    case .changing: ChangingView()
    case .beforeAfter: BeforeAfterView()
    case .makingCutout(let job): MakingCutoutView(job: job)
    case .yourCutout(let id): YourCutoutView(artworkId: id)
    case .makingProduct: MakingProductView()
    case .listingDetails: ListingDetailsView()
    case .storyVideo: StoryVideoView()
    case .videoSaved: VideoSavedView()
    case .youreLive: YoureLiveView()
    case .storyLibrary: StoryVideoLibraryView()
    case .recordStoryAgain: StoryVideoView(redo: true)
    }
  }
}

private struct DesignDestination: View {
  let route: DesignRoute

  var body: some View {
    switch route {
    case .detail(let id): DesignDetailView(artworkId: id)
    case .yourCutout(let id): YourCutoutView(artworkId: id, origin: .designs)
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
