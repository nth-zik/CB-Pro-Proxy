# iOS tun2socks build

This folder builds a static `libtun2socks.a` for the packet tunnel extension.

## Build (device only)

```bash
./build.sh
```

The script outputs `libtun2socks.a` and `libtun2socks.h` into:

```
../CBVVPNProxyExtension/Tun2Socks
```

Notes:
- The script currently targets `iphoneos` (`arm64`) only.
- If you need simulator builds, add a second build step and create a universal library with `lipo`.
