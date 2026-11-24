// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenAuditSpec",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [.library(name: "OpenAuditSpec", targets: ["OpenAuditSpec"])],
    targets: [.target(name: "OpenAuditSpec")]
)
