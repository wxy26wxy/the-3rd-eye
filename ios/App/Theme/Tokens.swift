// GENERATED from design/tokens.json — do not edit by hand. Run: pnpm tokens
import SwiftUI

enum Tokens {
  enum Palette {
    static let ground = Color(red: 0.4000, green: 0.7255, blue: 0.3725)
    static let ink = Color(red: 0.1176, green: 0.2275, blue: 0.1412)
    static let inkDeep = Color(red: 0.0588, green: 0.1412, blue: 0.0824)
    static let cream = Color(red: 1.0000, green: 0.9647, blue: 0.7804)
    static let lime = Color(red: 0.8863, green: 0.9412, blue: 0.4941)
    static let white = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let textMuted = Color(red: 0.2980, green: 0.4157, blue: 0.3137)
    static let groundSoft = Color(red: 0.4902, green: 0.7216, blue: 0.4314)
    static let inkSoft = Color(red: 0.1843, green: 0.2314, blue: 0.1882)
    static let sage = Color(red: 0.6627, green: 0.7333, blue: 0.6275)
    static let greenDeep = Color(red: 0.2431, green: 0.5490, blue: 0.2706)
    static let danger = Color(red: 0.7020, green: 0.1490, blue: 0.1176)
    static let focus = Color(red: 0.1176, green: 0.2275, blue: 0.1412)
  }
  enum Semantic {
    static let bg = Color(red: 0.4000, green: 0.7255, blue: 0.3725)
    static let surface = Color(red: 1.0000, green: 0.9647, blue: 0.7804)
    static let surfaceAlt = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let text = Color(red: 0.1176, green: 0.2275, blue: 0.1412)
    static let textOnDark = Color(red: 1.0000, green: 0.9647, blue: 0.7804)
    static let textMuted = Color(red: 0.2980, green: 0.4157, blue: 0.3137)
    static let accent = Color(red: 0.8863, green: 0.9412, blue: 0.4941)
    static let accentInk = Color(red: 0.1176, green: 0.2275, blue: 0.1412)
    static let primary = Color(red: 0.1176, green: 0.2275, blue: 0.1412)
    static let primaryText = Color(red: 1.0000, green: 0.9647, blue: 0.7804)
    static let primaryShadow = Color(red: 0.0588, green: 0.1412, blue: 0.0824)
    static let border = Color(red: 0.1176, green: 0.2275, blue: 0.1412)
    static let selected = Color(red: 0.8863, green: 0.9412, blue: 0.4941)
    static let danger = Color(red: 0.7020, green: 0.1490, blue: 0.1176)
    static let focusRing = Color(red: 0.1176, green: 0.2275, blue: 0.1412)
  }
  enum HighContrast {
    static let bg = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let surface = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let text = Color(red: 0.0000, green: 0.0000, blue: 0.0000)
    static let accent = Color(red: 1.0000, green: 0.8392, blue: 0.0000)
    static let primary = Color(red: 0.0000, green: 0.0000, blue: 0.0000)
    static let primaryText = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let border = Color(red: 0.0000, green: 0.0000, blue: 0.0000)
  }
  enum FontName {
    static let display = "BagelFatOne-Regular"
    static let body = "Rubik"
  }
  enum TypeScale {
    static let displayXL: CGFloat = 48
    static let displayL: CGFloat = 42
    static let displayM: CGFloat = 30
    static let titleL: CGFloat = 22
    static let titleM: CGFloat = 19
    static let bodyL: CGFloat = 18
    static let body: CGFloat = 17
    static let bodyS: CGFloat = 15
    static let caption: CGFloat = 14
    static let eyebrow: CGFloat = 12
    static let step: CGFloat = 13
  }
  enum Space {
    static let xs: CGFloat = 6
    static let s: CGFloat = 10
    static let m: CGFloat = 14
    static let l: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    static let page: CGFloat = 28
    static let section: CGFloat = 36
  }
  enum Radius {
    static let s: CGFloat = 6
    static let m: CGFloat = 20
    static let card: CGFloat = 28
    static let cardL: CGFloat = 30
    static let tile: CGFloat = 36
    static let pill: CGFloat = 999
  }
  enum Border {
    static let card: CGFloat = 3
    static let thin: CGFloat = 2
    static let icon: CGFloat = 1.8
  }
  enum Size {
    static let iconButton: CGFloat = 48
    static let cta: CGFloat = 60
    static let ctaSecondary: CGFloat = 56
    static let record: CGFloat = 84
    static let stepDot: CGFloat = 8
    static let minTarget: CGFloat = 44
    static let avatar: CGFloat = 40
    static let methodIcon: CGFloat = 56
  }
  enum Shadow {
    static let hard = (x: CGFloat(0), y: CGFloat(4), color: Color(red: 0.1176, green: 0.2275, blue: 0.1412))
    static let hardL = (x: CGFloat(0), y: CGFloat(5), color: Color(red: 0.1176, green: 0.2275, blue: 0.1412))
    static let primary = (x: CGFloat(0), y: CGFloat(4), color: Color(red: 0.0588, green: 0.1412, blue: 0.0824))
    static let icon = (x: CGFloat(0), y: CGFloat(3), color: Color(red: 0.1176, green: 0.2275, blue: 0.1412))
  }
  static let displayTilt: Double = -2
  static let grainOpacity: Double = 0.16
}
