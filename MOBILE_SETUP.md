# MyCloud Mobile App Setup

This guide explains how to build and run MyCloud as a native Android/iOS mobile app using Capacitor.

## Prerequisites

### For Android Development:
- Node.js 16+ and npm
- Android Studio (latest version)
- Java Development Kit (JDK) 11 or later
- Android SDK (installed via Android Studio)

### For iOS Development (macOS only):
- Node.js 16+ and npm
- Xcode 14+ (from Mac App Store)
- CocoaPods (`sudo gem install cocoapods`)
- iOS SDK (installed via Xcode)

## Initial Setup

### 1. Install Dependencies

```bash
# Navigate to the client directory
cd client

# Install all dependencies including Capacitor packages
npm install
```

### 2. Build the Web App

```bash
# From the root directory
npm run build
```

This creates an optimized production build in `client/dist` with PWA support.

**Note:** `capacitor.config.ts` is already configured, so you can skip `cap init` and go straight to adding platforms.

## Android Setup

### 3. Add Android Platform

```bash
# From the root project directory
npx cap add android
```

This creates an `android/` directory with a native Android project.

### 4. Sync Web Assets to Android

```bash
# Copy web build to native project
npm run sync

# Or use Capacitor CLI directly:
npx cap sync android
```

### 5. Configure Server URL

**Server configuration happens within the app - no code changes needed!**

When you first launch the mobile app, you'll be prompted to enter your MyCloud server URL:

1. The settings dialog appears automatically on first launch
2. Enter your server URL (e.g., `http://192.168.1.100:6868`)
3. Tap "Save & Reload"

You can change the server URL anytime by tapping the settings icon (⚙️) on the login screen.

**Note:** The server URL is stored in the app's local storage and persists across app restarts. No configuration files need to be edited - everything is user-configurable within the app.

### 6. Open Android Studio

```bash
npm run android
# This opens Android Studio with the project
```

Or manually:
```bash
npx cap open android
```

### 7. Run on Device/Emulator

In Android Studio:
1. Wait for Gradle sync to complete
2. Connect an Android device via USB (with USB debugging enabled) or start an emulator
3. Click the "Run" button (green play icon) or press Shift+F10
4. Select your device from the list

The app will install and launch on your device.

## iOS Setup (macOS only)

### 3. Add iOS Platform

```bash
# From the root project directory
npx cap add ios
```

This creates an `ios/` directory with a native iOS Xcode project.

### 4. Sync Web Assets to iOS

```bash
npm run sync

# Or use Capacitor CLI directly:
npx cap sync ios
```

### 5. Install CocoaPods Dependencies

```bash
cd ios/App
pod install
cd ../..
```

### 6. Configure Server URL

**Same as Android** - server configuration happens automatically within the app. The settings dialog appears on first launch, and you can access it anytime via the settings icon (⚙️) on the login screen.

### 7. Open Xcode

```bash
npm run ios
# This opens Xcode with the project
```

Or manually:
```bash
npx cap open ios
```

### 8. Run on Device/Simulator

In Xcode:
1. Select your development team in the "Signing & Capabilities" tab
2. Select a target device or simulator
3. Click the "Run" button (play icon) or press Cmd+R

The app will install and launch on your device/simulator.

## Development Workflow

### Making Changes

After modifying the web app code:

1. **Rebuild the web app:**
   ```bash
   cd client
   npm run build
   ```

2. **Sync changes to native projects:**
   ```bash
   npm run sync
   ```

3. **Rerun the app** in Android Studio or Xcode

### Live Reload (Advanced)

For faster development, you can use Capacitor's live reload feature:

1. Start the Vite dev server on your development machine:
   ```bash
   cd client
   npm run dev
   ```

2. Find your computer's local IP address:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr`

3. Edit `capacitor.config.ts`:
   ```typescript
   server: {
     url: 'http://192.168.1.XXX:6869', // Your dev machine IP + Vite port
     cleartext: true
   }
   ```

4. Sync and run:
   ```bash
   npm run sync
   ```

Now the app will load from your dev server and auto-refresh on changes.

## Server Configuration

### Network Access

Your MyCloud server must be accessible from mobile devices:

1. **Local Network**: Use your server's local IP (e.g., `192.168.1.100:6868`)
2. **Remote Access**: Set up port forwarding or use a VPN
3. **HTTPS**: For production, use HTTPS with a valid certificate

### CORS Configuration

The server already includes CORS configuration to accept requests from mobile apps. Verify that `server/index.js` has:

```javascript
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## Building for Production

### Android APK/AAB

1. **Open Android Studio** and load the project
2. **Navigate to**: Build → Generate Signed Bundle / APK
3. **Select**: Android App Bundle (AAB) for Play Store, or APK for sideloading
4. **Configure signing**: Create or select a keystore
5. **Choose build variant**: Release
6. **Build**: Click "Create" and wait for the build to complete

The APK/AAB will be in `android/app/release/`

### iOS IPA

1. **Open Xcode** and load the project
2. **Select**: Any iOS Device (arm64) as the target
3. **Navigate to**: Product → Archive
4. **Wait** for the archive to complete
5. **Distribute**: Choose distribution method (App Store, Ad Hoc, Enterprise, Development)
6. **Configure signing** and export the IPA

## Troubleshooting

### "Cannot connect to server"
- Verify server URL in settings (including http:// prefix and port)
- Check that your mobile device is on the same network as the server
- Test server accessibility: Open `http://your-server:6868` in mobile browser
- Check firewall settings on the server

### "Network request failed"
- Ensure CORS is properly configured on the server
- Verify the server is running
- Check if BASE_PATH is configured correctly for your deployment

### Android Studio Gradle errors
- Update Android Studio to the latest version
- File → Invalidate Caches → Invalidate and Restart
- Ensure you have the latest Android SDK tools installed

### iOS build errors
- Run `cd ios/App && pod install` to update CocoaPods dependencies
- Clean build: Product → Clean Build Folder in Xcode
- Ensure your Apple Developer account is properly configured

### App crashes on launch
- Check Android Logcat or Xcode Console for error messages
- Verify all Capacitor plugins are properly installed
- Ensure the web build completed successfully before syncing

## App Features

The mobile app includes:

- ✅ Full MyCloud functionality (upload, download, share, organize files)
- ✅ Native file picker and camera integration
- ✅ Offline detection and graceful error handling
- ✅ Native splash screen and app icon
- ✅ PWA support (also installable as web app)
- ✅ Configurable server URL for flexible deployment
- ✅ Theme support (light/dark/midnight)
- ✅ Multi-language support (English/German)

## App Icons

To customize app icons:

1. Create icon images:
   - `icon-192.png` (192x192)
   - `icon-512.png` (512x512)
   
2. Place them in `client/public/`

3. For native icons, use Android Studio and Xcode asset catalogs:
   - **Android**: `android/app/src/main/res/` (various `mipmap-*` folders)
   - **iOS**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

4. Rebuild and sync

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)

## Support

For issues specific to MyCloud mobile features, check:
- Server logs for API errors
- Browser DevTools (for web app debugging)
- Android Logcat or Xcode Console (for native errors)
