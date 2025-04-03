# SoulSeer App Publishing Assets

This directory contains assets needed for app store submissions and PWA functionality.

## Directory Structure

- icons/ - Contains all app icons in various sizes for different platforms
  - icon-[SIZE].png - Standard icons in various sizes (72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512)
  - apple-icon-[SIZE].png - iOS specific icons (152x152, 167x167, 180x180)
  - maskable-icon-[SIZE].png - Maskable icons for Android (192x192, 512x512)
  - apple-splash-[WIDTH]-[HEIGHT].png - iOS splash screens for various device sizes
  - shortcut-[FEATURE]-96x96.png - Icons for PWA shortcuts (reading, shop, live)
  - favicon-16x16.png, favicon-32x32.png, favicon.ico - Favicons

- screenshots/ - Contains screenshots for app store listings
  - screenshot[1-4].webp - Mobile screenshots in WebP format (1080x1920)
  - screenshot-wide[1-2].webp - Desktop screenshots in WebP format (1920x1080)

- soulseer-logo.png - Main app logo
- soulseer-banner.png - Banner image for social sharing

## Required Image Assets

For a complete PWA submission, the following assets should be created and placed in these directories:

1. Icons in multiple sizes (at minimum 192x192 and 512x512)
2. Maskable icons that allow for the "squircle" shape on Android
3. Apple-specific icons and splash screens for iOS PWA support
4. Screenshots in both mobile and desktop formats
5. Banner/promotional images for social media sharing

## App Store Guidelines

### Apple App Store
- Requires screenshots in specific sizes for different devices
- App icon must be 1024x1024
- No alpha channel in the App Store icon

### Google Play Store
- Requires feature graphic (1024x500)
- Screenshots for different device sizes
- App icon should be 512x512

### Amazon Appstore
- Similar requirements to Google Play
- Screenshots for tablet and phone

## Notes for Asset Creation

- Use consistent branding and colors across all assets
- Maintain high quality (especially for the App Store icon)
- Test how icons look on different backgrounds
- Test splash screens on actual devices when possible
- Follow platform-specific design guidelines
