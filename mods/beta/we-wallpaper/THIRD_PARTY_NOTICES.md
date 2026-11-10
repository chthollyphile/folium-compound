# Third-party notices

## Folia desktop integration

The desktop helper in native/desktop-helper/ and desktop/controller.cjs are adapted from chthollyphile/folia-major (AGPL-3.0), based on Folia 0.7.27 and local integration changes. desktop/presentation.cjs originated in this integration work. Upstream source: https://github.com/chthollyphile/folia-major, tag v0.7.27 (4a545c96229664c0e07d4fb04971264e8d75fdd2). Original comments and provenance notes are retained, including the Seelen-derived WorkerW implementation in attach.rs. The full AGPL-3.0 license is included in LICENSE.

## Rust dependencies

The N-API module is built with napi / napi-derive / napi-build (MIT) and Microsoft windows-rs crates (MIT OR Apache-2.0). Transitive packages and exact checksums are in native/Cargo.lock and native/desktop-helper/Cargo.lock. Their original license files are included in licenses/. The package contains source and a locked build script for both shipped binaries; maintainers may rebuild and replace them.

## Runtime products and wallpaper content

Electron and Wallpaper Engine are not redistributed by this mod. Wallpaper content, scripts, fonts and project files remain in the user's existing installation and retain their respective ownership. The bundled preview.png is an original informational graphic, not an extracted wallpaper asset.
