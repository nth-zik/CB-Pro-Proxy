#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUTPUT_DIR="$ROOT_DIR/../CBVVPNProxyExtension/Tun2Socks"
MIN_IOS_VERSION="13.0"

mkdir -p "$OUTPUT_DIR"

SDK="iphoneos"
SDK_PATH=$(xcrun --sdk "$SDK" --show-sdk-path)
CC=$(xcrun --sdk "$SDK" --find clang)

export CGO_ENABLED=1
export GOOS=ios
export GOARCH=arm64
export CC
export CGO_CFLAGS="-isysroot $SDK_PATH -miphoneos-version-min=$MIN_IOS_VERSION"
export CGO_LDFLAGS="-isysroot $SDK_PATH -miphoneos-version-min=$MIN_IOS_VERSION"

cd "$ROOT_DIR"

go mod download

go build -buildmode=c-archive -o "$OUTPUT_DIR/libtun2socks.a"

if [[ ! -f "$OUTPUT_DIR/libtun2socks.h" ]]; then
  echo "Missing libtun2socks.h after build" >&2
  exit 1
fi

echo "Built $OUTPUT_DIR/libtun2socks.a"
