# React Native Wallet Kit Implementation Roadmap

This document provides a comprehensive mapping of all components, providers, methods, and functionality from `@turnkey/react-wallet-kit` that need to be implemented in `@turnkey/react-native-wallet-kit` for feature parity.

## Priority Levels
- **P0 (Critical)** - Must have for basic functionality
- **P1 (High)** - Core features for production use
- **P2 (Medium)** - Advanced features and UX improvements  
- **P3 (Low)** - Nice-to-have features and polish

---

## Provider Architecture

### Core Providers
- [x] **P0** `TurnkeyProvider` - Root provider combining all sub-providers
- [x] **P0** `ClientProvider` - Main business logic and API client container
- [x] **P1** `ModalProvider` - Stack-based modal/screen navigation system
- [ ] **P2** `ThemeProvider` - Theme and styling system

### Provider Features
- [x] **P0** Provider configuration merging and validation
- [x] **P0** Client initialization and error handling
- [ ] **P1** Session state synchronization across providers
- [x] **P1** Callback system for custom event handling
- [ ] **P2** Development mode warnings and debugging

---

## Client Provider Methods (40+ methods)

### Core Session Management
- [ ] **P0** `logout(params?)` - Session termination
- [ ] **P0** `refreshUser()` - Update user state
- [ ] **P0** `refreshWallets()` - Update wallet list
- [ ] **P0** Session validation and expiry handling
- [ ] **P1** Multi-session support (`allSessions`)
- [ ] **P1** Session refresh and auto-renewal

### Authentication Flows (Primary Methods)
- [ ] **P0** `loginWithPasskey(params?)` - WebAuthn login
- [ ] **P0** `signUpWithPasskey(params?)` - WebAuthn registration
- [ ] **P0** `loginWithWallet(params)` - External wallet authentication
- [ ] **P0** `signUpWithWallet(params)` - Wallet-based signup
- [ ] **P0** `loginOrSignupWithWallet(params)` - Combined wallet flow
- [ ] **P1** `loginWithOtp(params)` - OTP-based login
- [ ] **P1** `signUpWithOtp(params)` - OTP-based signup
- [ ] **P1** `completeOtp(params)` - Combined OTP flow
- [ ] **P1** `loginWithOauth(params)` - OAuth login
- [ ] **P1** `signUpWithOauth(params)` - OAuth signup
- [ ] **P1** `completeOauth(params)` - Combined OAuth flow

### Authentication Support Methods
- [ ] **P0** `createPasskey(params?)` - WebAuthn credential creation
- [ ] **P1** `initOtp(params)` - OTP initialization
- [ ] **P1** `verifyOtp(params)` - OTP verification
- [ ] **P1** `fetchWalletProviders(chain?)` - Available wallet discovery
- [ ] **P1** `connectWalletAccount(walletProvider)` - Connect external wallet
- [ ] **P1** `disconnectWalletAccount(walletProvider)` - Disconnect wallet
- [ ] **P2** `switchWalletAccountChain(params)` - Chain switching

### Modal-Driven UI Methods
- [ ] **P1** `handleLogin()` - Open authentication modal
- [ ] **P1** `handleSignMessage(params)` - Message signing modal
- [ ] **P2** `handleGoogleOauth()` - Google OAuth modal flow
- [ ] **P2** `handleAppleOauth()` - Apple OAuth modal flow
- [ ] **P2** `handleFacebookOauth()` - Facebook OAuth modal flow
- [ ] **P2** `handleXOauth()` - Twitter/X OAuth modal flow
- [ ] **P2** `handleDiscordOauth()` - Discord OAuth modal flow

### User Profile Management
- [ ] **P1** `handleUpdateUserName()` - Username update modal
- [ ] **P1** `handleUpdateUserEmail()` - Email update modal
- [ ] **P1** `handleUpdateUserPhoneNumber()` - Phone update modal
- [ ] **P1** `handleAddEmail()` - Add email address modal
- [ ] **P1** `handleAddPhoneNumber()` - Add phone number modal
- [ ] **P1** `handleRemoveUserEmail()` - Remove email modal
- [ ] **P1** `handleRemoveUserPhoneNumber()` - Remove phone modal

### Authenticator Management
- [ ] **P1** `handleAddPasskey()` - Add WebAuthn authenticator modal
- [ ] **P1** `handleRemovePasskey()` - Remove authenticator modal
- [ ] **P2** `handleAddOauthProvider()` - Link OAuth provider modal
- [ ] **P2** `handleRemoveOauthProvider()` - Unlink OAuth provider modal

### Wallet Operations
- [ ] **P1** `fetchWallets(params?)` - Get user wallets
- [ ] **P1** `fetchWalletAccounts(params)` - Get wallet accounts
- [ ] **P1** `fetchPrivateKeys(params?)` - Get private keys
- [ ] **P1** `signMessage(params)` - Direct message signing
- [ ] **P1** `signTransaction(params)` - Transaction signing
- [ ] **P1** `signAndSendTransaction(params)` - Sign and broadcast
- [ ] **P2** `handleExportWallet()` - Secure wallet export modal
- [ ] **P2** `handleExportPrivateKey()` - Private key export modal
- [ ] **P2** `handleExportWalletAccount()` - Account export modal
- [ ] **P2** `handleImportWallet()` - Wallet import modal
- [ ] **P2** `handleImportPrivateKey()` - Private key import modal
- [ ] **P2** `handleConnectExternalWallet()` - External wallet connection modal

### User Data Methods
- [ ] **P1** `fetchUser(params?)` - Get user profile
- [ ] **P2** `fetchOrCreateP256ApiKeyUser(params)` - API key user management

---

## Authentication Methods & Flows

### Passkey Authentication (WebAuthn)
- [ ] **P0** WebAuthn credential creation flow
- [ ] **P0** WebAuthn authentication flow
- [ ] **P0** Biometric authentication integration (iOS/Android)
- [ ] **P1** Credential management (add/remove)
- [ ] **P2** Cross-platform passkey sync considerations

**React Native Implementation:**
- Use `react-native-passkey` or similar library
- iOS: ASAuthorizationController
- Android: FIDO2 API
- Fallback to device biometrics

### Email OTP Authentication
- [ ] **P1** Email input with validation
- [ ] **P1** OTP generation and sending
- [ ] **P1** OTP input and verification
- [ ] **P1** Resend OTP functionality
- [ ] **P2** Email format validation

**React Native Implementation:**
- React Native TextInput for email
- OTP input component (possibly 6-digit)
- Timer for resend functionality

### SMS OTP Authentication
- [ ] **P1** International phone number input
- [ ] **P1** Phone number validation
- [ ] **P1** SMS OTP generation and sending
- [ ] **P1** OTP input and verification
- [ ] **P2** Country picker integration

**React Native Implementation:**
- `react-native-phone-number-input` or equivalent
- International number formatting
- SMS deep linking for auto-fill

### OAuth Providers (5 total)
- [ ] **P2** Google OAuth flow
- [ ] **P2** Apple OAuth flow (Sign in with Apple)
- [ ] **P3** Facebook OAuth flow
- [ ] **P3** Twitter/X OAuth flow
- [ ] **P3** Discord OAuth flow

**React Native Implementation:**
- `@react-native-async-storage/async-storage` for PKCE storage
- `react-native-app-auth` or similar for OAuth flows
- Deep linking for OAuth redirects
- In-app browser for OAuth (react-native-inappbrowser-reborn)

### Wallet Authentication
- [ ] **P0** External wallet connection
- [ ] **P0** WalletConnect integration
- [ ] **P0** Message signing for authentication
- [ ] **P1** Multi-wallet support
- [ ] **P1** Chain switching
- [ ] **P2** Wallet discovery and selection

**React Native Implementation:**
- `@walletconnect/react-native` for WalletConnect
- Deep linking for wallet connections
- Chain-specific wallet integrations

---

## UI Components & Modal System

### Modal System Architecture
- [ ] **P1** Stack-based navigation system
- [ ] **P1** Push/pop/close navigation methods
- [ ] **P1** Modal state management
- [ ] **P1** Backdrop handling
- [ ] **P2** Modal animations and transitions
- [ ] **P2** Responsive modal sizing

**React Native Implementation:**
- React Navigation for modal stacks
- React Native Modal component
- Animated transitions with React Native Reanimated

### Authentication Components
- [ ] **P0** `AuthComponent` - Main authentication orchestrator
- [ ] **P0** `PasskeyButtons` - Passkey login/signup buttons
- [ ] **P1** `EmailInput` - Email input with validation
- [ ] **P1** `PhoneNumberInput` - International phone input
- [ ] **P1** `OtpVerification` - OTP input and validation
- [ ] **P2** OAuth provider buttons (Google, Apple, Facebook, X, Discord)
- [ ] **P1** `ExternalWalletSelector` - Wallet selection interface
- [ ] **P1** `WalletConnectScreen` - WalletConnect QR/deep link flow

### User Management Components
- [ ] **P1** `UpdateEmail` - Email update flow
- [ ] **P1** `UpdatePhoneNumber` - Phone number update flow
- [ ] **P1** `UpdateUserName` - Username update flow
- [ ] **P1** `RemoveEmail` - Email removal confirmation
- [ ] **P1** `RemovePhoneNumber` - Phone removal confirmation
- [ ] **P1** `RemovePasskey` - Authenticator removal
- [ ] **P2** `RemoveOAuthProvider` - OAuth provider removal
- [ ] **P1** `ConnectWallet` - External wallet connection UI

### Import/Export Components
- [ ] **P2** `ExportComponent` - Secure export interface
- [ ] **P2** `ImportComponent` - Import with decryption
- [ ] **P2** `ExportWarning` - Security warnings
- [ ] **P3** Export format selection
- [ ] **P3** Import file picker integration

**React Native Implementation:**
- `react-native-document-picker` for file selection
- Secure storage for sensitive operations
- Native file system access

### Utility Components
- [ ] **P1** `SignMessageModal` - Message signing interface
- [ ] **P1** `ActionPage` - Loading states for async operations
- [ ] **P1** `SuccessPage` - Success confirmations
- [ ] **P1** `DeveloperError` - Development error display
- [ ] **P1** `Failure` - Error state handling
- [ ] **P2** Loading spinners and indicators
- [ ] **P2** Button components with states
- [ ] **P2** Input components with validation

### Design System Components
- [ ] **P2** Button variants (primary, secondary, outline)
- [ ] **P2** Input components (text, password, OTP)
- [ ] **P2** Loading states and spinners
- [ ] **P2** Success and error states
- [ ] **P2** Icon system integration
- [ ] **P3** Animation components
- [ ] **P3** Theme provider and styling

---

## State Management

### Core State Structure
- [x] **P0** `session: Session | undefined` - Current user session
- [x] **P0** `user: v1User | undefined` - User profile data
- [x] **P0** `wallets: Wallet[]` - User's wallets
- [x] **P0** `clientState: ClientState` - SDK initialization state
- [x] **P0** `authState: AuthState` - Authentication status
- [x] **P1** `allSessions: Record<string, Session>` - Multi-session support
- [ ] **P1** `walletProviders: WalletProvider[]` - Connected wallet providers

### State Management Patterns
- [x] **P0** Provider-based state distribution
- [ ] **P0** State persistence and rehydration
- [ ] **P1** Optimistic updates
- [x] **P1** Error state handling
- [ ] **P2** State migration and versioning

**React Native Implementation:**
- AsyncStorage for persistence
- Context API for state distribution
- Redux Toolkit (optional) for complex state

### Session Management
- [ ] **P0** Session creation and validation
- [ ] **P0** Session expiration handling
- [ ] **P0** Session refresh mechanisms
- [ ] **P1** Multi-session support
- [ ] **P1** Session timeout warnings
- [ ] **P2** Background session refresh

---

## Configuration System

### TurnkeyProviderConfig Interface
- [ ] **P0** Core SDK client configuration
- [ ] **P0** Authentication method toggles
- [ ] **P1** OAuth client IDs and redirect URIs
- [ ] **P1** UI customization options
- [ ] **P1** Session configuration
- [ ] **P2** Import/export iframe URLs (adapt for RN)
- [ ] **P2** Theme configuration
- [ ] **P3** Developer mode settings

### Authentication Configuration
- [ ] **P0** Method enable/disable toggles
- [ ] **P1** Method ordering preferences
- [ ] **P1** OAuth provider ordering
- [ ] **P1** Sub-organization creation parameters
- [ ] **P2** Session expiration settings
- [ ] **P2** Auto-refresh configuration

### UI Configuration
- [ ] **P2** Color scheme customization
- [ ] **P2** Dark mode support
- [ ] **P2** Custom styling options
- [ ] **P3** Animation preferences
- [ ] **P3** Accessibility settings

---

## Utilities & Helper Functions

### Authentication Utilities
- [ ] **P0** `withTurnkeyErrorHandling` - Error wrapper
- [ ] **P0** `generateChallengePair` - Crypto challenge generation
- [ ] **P1** `isValidSession` - Session validation
- [ ] **P1** `parseOAuthRedirect` - OAuth URL parsing
- [ ] **P2** PKCE flow helpers
- [ ] **P2** OAuth popup management (adapt to deep links)

### Session Utilities
- [ ] **P0** `getSession` - Session retrieval
- [ ] **P0** `clearSession` - Session cleanup
- [ ] **P0** `getActiveSessionKey` - Active session identification
- [ ] **P1** `getAllSessions` - Multi-session retrieval
- [ ] **P1** Session timeout scheduling
- [ ] **P2** Session warning system

### Crypto & Formatting Utilities
- [ ] **P1** Address formatting and validation
- [ ] **P1** Message encoding utilities
- [ ] **P1** Hash function helpers
- [ ] **P2** QR code generation for WalletConnect
- [ ] **P2** Phone number formatting
- [ ] **P2** Email validation

### Timer Management
- [ ] **P1** `TimerMap` - Timer collection management
- [ ] **P1** `setCappedTimeoutInMap` - Long delay safe timeouts
- [ ] **P1** `clearKeys` - Timer cleanup
- [ ] **P1** Session expiration scheduling
- [ ] **P2** Warning notification system

---

## React Native Specific Considerations

### Platform APIs
- [ ] **P0** AsyncStorage for persistence
- [ ] **P0** Linking for deep links and OAuth
- [ ] **P0** Alert for native dialogs
- [ ] **P1** Biometric authentication
- [ ] **P1** Secure storage (Keychain/Keystore)
- [ ] **P2** Background task handling
- [ ] **P2** Push notifications
- [ ] **P3** Haptic feedback

### Navigation & Modals
- [ ] **P1** React Navigation integration
- [ ] **P1** Modal presentation styles
- [ ] **P1** Back button handling
- [ ] **P2** Tab navigation support
- [ ] **P2** Deep linking navigation
- [ ] **P3** Gesture-based navigation

### Performance Optimizations
- [ ] **P2** Lazy loading of components
- [ ] **P2** Image optimization and caching
- [ ] **P2** Bundle size optimization
- [ ] **P2** Memory management
- [ ] **P3** Performance monitoring

### Platform-Specific Features
- [ ] **P1** iOS: Face ID/Touch ID integration
- [ ] **P1** Android: Fingerprint/Face unlock
- [ ] **P1** iOS: Sign in with Apple
- [ ] **P2** Android: Google Sign-In
- [ ] **P2** iOS: Keychain services
- [ ] **P2** Android: Keystore integration
- [ ] **P3** Widget support (iOS/Android)

---

## Dependencies & Libraries

### Critical Web Dependencies → React Native Alternatives

#### Modal & UI System
- [ ] `@headlessui/react` → React Navigation + React Native Modal
- [ ] `@fortawesome/react-fontawesome` → `react-native-vector-icons`
- [ ] `qrcode.react` → `react-native-qrcode-svg`
- [ ] `@lottiefiles/react-lottie-player` → `lottie-react-native`
- [ ] `react-international-phone` → `react-native-phone-number-input`

#### Authentication & Crypto
- [ ] WebAuthn APIs → `react-native-passkey` or platform APIs
- [ ] OAuth popup flows → Deep linking + `react-native-inappbrowser-reborn`
- [ ] `sessionStorage` → AsyncStorage
- [ ] PKCE storage → Secure AsyncStorage

#### Styling & Theme
- [ ] Tailwind CSS → StyleSheet + styled-components/emotion
- [ ] CSS custom properties → Theme provider
- [ ] PostCSS → React Native styling system

#### Utility Libraries
- [ ] `@noble/hashes` - Keep (crypto library)
- [ ] `buffer` - Keep with React Native polyfill
- [ ] `libphonenumber-js` - Keep (phone validation)
- [ ] `clsx` - Keep or replace with custom utility

#### Development & Build
- [ ] Rollup configuration → Metro bundler
- [ ] TypeScript configuration → React Native TS config
- [ ] Jest testing → React Native testing

---

## Implementation Phases

### Phase 1: Core Foundation (P0)
- [x] 1. Provider architecture setup
- [ ] 2. Basic client initialization
- [ ] 3. Session management
- [ ] 4. Core authentication methods (Passkey, Wallet)
- [ ] 5. Basic UI components

### Phase 2: Authentication & UI (P1)
- [ ] 1. Complete authentication flows
- [ ] 2. Modal system implementation
- [ ] 3. User management features
- [ ] 4. Wallet operations
- [ ] 5. State management

### Phase 3: Advanced Features (P2)
- [ ] 1. OAuth provider integration
- [ ] 2. Import/export functionality
- [ ] 3. Theme system
- [ ] 4. Platform-specific features
- [ ] 5. Performance optimizations

### Phase 4: Polish & Extras (P3)
- [ ] 1. Animations and transitions
- [ ] 2. Advanced theming
- [ ] 3. Accessibility improvements
- [ ] 4. Developer experience features
- [ ] 5. Additional platform integrations

---

## Testing Strategy

### Unit Testing
- [ ] **P1** Provider functionality tests
- [ ] **P1** Authentication flow tests
- [ ] **P1** State management tests
- [ ] **P1** Utility function tests
- [ ] **P2** Component rendering tests

### Integration Testing
- [ ] **P1** End-to-end authentication flows
- [ ] **P1** Session management integration
- [ ] **P1** Wallet connection flows
- [ ] **P2** Multi-session scenarios
- [ ] **P2** Error handling scenarios

### Platform Testing
- [ ] **P1** iOS device testing
- [ ] **P1** Android device testing
- [ ] **P2** Simulator testing
- [ ] **P2** Performance testing
- [ ] **P3** Accessibility testing

---

## Documentation Requirements

### API Documentation
- [ ] **P1** Complete API reference
- [ ] **P1** Configuration guide
- [ ] **P1** Authentication flow guides
- [ ] **P1** Migration guide from web
- [ ] **P2** Advanced integration examples

### Developer Guides
- [ ] **P1** Getting started guide
- [ ] **P1** Platform-specific setup
- [ ] **P1** Troubleshooting guide
- [ ] **P2** Custom component creation
- [ ] **P2** Theme customization guide

### Example Applications
- [ ] **P1** Basic authentication example
- [ ] **P1** Complete wallet app example
- [ ] **P2** Custom UI example
- [ ] **P2** Multi-platform example
- [ ] **P3** Advanced integration examples

---

This roadmap provides a comprehensive checklist for implementing the React Native Wallet Kit with complete feature parity to the web version. Each item should be checked off as it's completed, with priority levels guiding implementation order.