# Login Screen Implementation Plan

## Overview
Implementation of Turnkey-style login screen for React Native application with email, passkey, and OAuth authentication options.

## Core UI Components Checklist
- [ ] **Logo Section**: Text placeholder "Turnkey" at the top (no Demo pill)
- [ ] **Title**: "Log in or sign up" centered below logo
- [ ] **Email Input Field**: With placeholder "Enter your email"
- [ ] **Primary Passkey Button**: Purple button with HSL color (241.31deg 100% 64.12%)
- [ ] **Secondary Email Button**: Text button "Continue with email"
- [ ] **Divider**: Single "OR" divider (since wallet option is removed)
- [ ] **OAuth Buttons**: Google, Apple, and Facebook sign-in options

## File Structure
```
app/
  login.tsx                 # Main login screen
components/
  auth/
    EmailInput.tsx          # Email input component
    PasskeyButton.tsx       # Primary passkey button
    EmailButton.tsx         # Secondary email button
    OAuthButton.tsx         # Reusable OAuth button component
    AuthDivider.tsx         # OR divider component
constants/
  Colors.ts                 # Update with new purple primary color
```

## Implementation Phases

### Phase 1: Email Authentication ✅
- [ ] Create `components/auth/` directory structure
- [ ] Update `constants/Colors.ts` with purple primary color (hsl(241.31, 100%, 64.12%))
- [ ] Create `EmailInput.tsx` component
  - [ ] Add text input with proper styling
  - [ ] Implement email validation regex
  - [ ] Add focus/blur states
  - [ ] Handle keyboard types and return key
- [ ] Create `EmailButton.tsx` component
  - [ ] Style as secondary text button
  - [ ] Add touch feedback
  - [ ] Connect to email input state
- [ ] Create `app/index.tsx` main screen (renamed from login.tsx)
  - [ ] Setup basic layout structure
  - [ ] Add Turnkey text logo
  - [ ] Add "Log in or sign up" title
  - [ ] Integrate EmailInput component
  - [ ] Add state management for email
  - [ ] Implement form submission handling
- [ ] Update navigation to include login screen
  - [ ] Add login route to app navigation (now index.tsx)
  - [ ] Setup initial route logic (renamed (tabs) to (main))
  - [ ] Fix routing to show login screen first
- [ ] Test email input functionality
  - [ ] Verify validation works
  - [ ] Test keyboard behavior
  - [ ] Ensure proper layout on different screen sizes

### Phase 2: Passkey Authentication 📱
- [ ] Install required dependencies
  - [ ] `expo-local-authentication`
  - [ ] `expo-secure-store`
- [ ] Create `PasskeyButton.tsx` component
  - [ ] Apply purple gradient styling (hsl(241.31, 100%, 64.12%))
  - [ ] Add white text styling
  - [ ] Implement pressed/active states
  - [ ] Add loading indicator
- [ ] Implement biometric authentication
  - [ ] Check device biometric capabilities
  - [ ] Request biometric permissions
  - [ ] Handle authentication flow
  - [ ] Implement fallback for devices without biometrics
- [ ] Add passkey registration flow
  - [ ] Create registration UI flow
  - [ ] Store passkey credentials securely
  - [ ] Handle registration errors
- [ ] Add passkey authentication flow
  - [ ] Retrieve stored credentials
  - [ ] Authenticate with biometrics
  - [ ] Handle authentication success/failure
- [ ] Error handling and user feedback
  - [ ] Add error messages for failed attempts
  - [ ] Implement retry logic
  - [ ] Add success feedback
- [ ] Test passkey functionality
  - [ ] Test on devices with Face ID
  - [ ] Test on devices with Touch ID
  - [ ] Test fallback scenarios

### Phase 3: OAuth Integration 🔐
- [ ] Install OAuth dependencies
  - [ ] `expo-auth-session`
  - [ ] `expo-apple-authentication`
  - [ ] `expo-web-browser`
- [ ] Create `AuthDivider.tsx` component
  - [ ] Style horizontal lines
  - [ ] Add "OR" text in center
  - [ ] Ensure proper spacing
- [ ] Create reusable `OAuthButton.tsx` component
  - [ ] Accept icon, text, and onPress props
  - [ ] Style with white background and border
  - [ ] Add icon positioning
  - [ ] Implement touch feedback
- [ ] Implement Google Sign-In
  - [ ] Setup Google OAuth credentials
  - [ ] Configure expo-auth-session for Google
  - [ ] Handle authentication response
  - [ ] Store tokens securely
  - [ ] Add Google icon/branding
- [ ] Implement Apple Sign-In
  - [ ] Configure Apple authentication
  - [ ] Implement Apple ID button
  - [ ] Handle Apple auth response
  - [ ] Store user info and tokens
  - [ ] Add Apple icon/branding
- [ ] Implement Facebook Sign-In
  - [ ] Setup Facebook app credentials
  - [ ] Configure expo-auth-session for Facebook
  - [ ] Handle Facebook auth response
  - [ ] Store access token
  - [ ] Add Facebook icon/branding
- [ ] OAuth callback handling
  - [ ] Setup deep linking configuration
  - [ ] Handle redirect URIs
  - [ ] Process authentication tokens
  - [ ] Navigate to app on success
- [ ] Test OAuth flows
  - [ ] Test Google sign-in flow
  - [ ] Test Apple sign-in flow
  - [ ] Test Facebook sign-in flow
  - [ ] Verify token storage

## Styling Specifications

### Colors
- [ ] Primary purple: `hsl(241.31, 100%, 64.12%)`
- [ ] Background: White (`#FFFFFF`)
- [ ] Primary text: Dark gray (`#1A1A1A`)
- [ ] Secondary text: Light gray (`#6B7280`)
- [ ] Input borders: Light gray (`#E5E5E5`)
- [ ] Button borders: Light gray (`#E5E5E5`)

### Typography
- [ ] Logo: 32px, bold, center-aligned
- [ ] Title: 24px, semi-bold, center-aligned
- [ ] Input text: 16px, regular
- [ ] Button text: 16px, medium
- [ ] Divider text: 14px, regular

### Spacing
- [ ] Screen padding: 24px horizontal
- [ ] Component spacing: 16px vertical gaps
- [ ] Button padding: 16px vertical, 24px horizontal
- [ ] Input padding: 12px all sides

## Additional Setup

### Navigation Configuration
- [ ] Add login screen to navigation stack
- [ ] Setup authentication flow routing
- [ ] Implement protected routes
- [ ] Configure deep linking for OAuth

### State Management
- [ ] Create authentication context
- [ ] Implement user session management
- [ ] Add token refresh logic
- [ ] Handle authentication persistence

### Error Handling
- [ ] Network error handling
- [ ] Invalid credentials handling
- [ ] Biometric failure handling
- [ ] OAuth error handling

## Testing Checklist

### Unit Tests
- [ ] Email validation logic
- [ ] Form submission logic
- [ ] Authentication state management
- [ ] Token storage/retrieval

### Integration Tests
- [ ] Complete email auth flow
- [ ] Complete passkey auth flow
- [ ] Complete OAuth flows
- [ ] Navigation after authentication

### E2E Tests
- [ ] Full login journey
- [ ] Sign up journey
- [ ] Error scenarios
- [ ] Deep linking

## Future Considerations

### Wallet Connection (Future Phase)
- [ ] Web3 integration planning
- [ ] Wallet provider selection modal
- [ ] WalletConnect protocol integration
- [ ] Ethereum/multi-chain support

### Additional Features
- [ ] SMS authentication
- [ ] Magic link authentication
- [ ] Remember me functionality
- [ ] Password reset flow
- [ ] Multi-factor authentication

### Improvements
- [ ] Internationalization (i18n)
- [ ] Accessibility enhancements
- [ ] Animation and transitions
- [ ] Offline support
- [ ] Analytics integration

## Dependencies Summary

### Required Now
```json
{
  "expo-auth-session": "~5.5.2",
  "expo-apple-authentication": "~6.4.2", 
  "expo-local-authentication": "~14.0.1",
  "expo-secure-store": "~13.0.2",
  "expo-web-browser": "~13.0.3",
  "react-hook-form": "^7.52.0"
}
```

### Future Dependencies
```json
{
  "web3": "For wallet integration",
  "walletconnect": "For wallet connection protocol",
  "react-native-keychain": "Alternative secure storage"
}
```

## Progress Tracking

### Phase Completion
- [ ] Phase 1: Email Authentication
- [ ] Phase 2: Passkey Authentication  
- [ ] Phase 3: OAuth Integration

### Overall Status
- [ ] All UI components created
- [ ] All authentication methods functional
- [ ] Testing complete
- [ ] Ready for production

---

**Note**: Check off items as they are completed. Update this document with any changes or discoveries during implementation.