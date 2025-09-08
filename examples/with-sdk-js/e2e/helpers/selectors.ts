export const withSdkJsSelectors = {
  managedState: {
    authStateValue: "auth-state-value",
    clientStateValue: "client-state-value",
  },
  createMethods: {
    createWallet: "create-wallet",
  },
  modals: {
    authModal: "show-auth-modal",
    signingModal: "show-signing-modal",
    exportWalletModal: "show-export-wallet-modal",
    exportWalletAccountModal: "show-export-wallet-account-modal",
    importWalletModal: "show-import-wallet-modal",
    updateUserEmailModal: "show-update-user-email-modal",
    updateUserPhoneModal: "show-update-user-phone-modal",
    addEmailModal: "show-add-email-modal",
    addPhoneModal: "show-add-phone-modal",
    addPasskeyModal: "show-add-passkey-modal",
    removePasskeyModal: "show-remove-passkey-modal",
    removeUserEmailModal: "show-remove-user-email-modal",
    removeUserPhoneModal: "show-remove-user-phone-modal",
    connectExternalWalletModal: "show-connect-external-wallet-modal",
    xOAuthModal: "show-x-oauth-modal",
    discordOAuthModal: "show-discord-oauth-modal",
    googleOAuthModal: "show-google-oauth-modal",
    appleOAuthModal: "show-apple-oauth-modal",
    facebookOAuthModal: "show-facebook-oauth-modal",
    addGoogleOAuth: "add-google-oauth",
    addAppleOAuth: "add-apple-oauth",
    addFacebookOAuth: "add-facebook-oauth",
    removeOAuthProvider: "remove-oauth-provider",
  },
  authMethods: {
    logoutButton: "logout-button",
  },
  fetchMethods: {
    getWhoami: "get-whoami",
    getActiveSession: "get-active-session",
    fetchUser: "fetch-user",
    fetchWallets: "fetch-wallets",
    fetchWalletAccounts: "fetch-wallet-accounts",
    fetchWalletProviders: "fetch-wallet-providers",
  },
  sessionManagement: {
    getActiveSession2: "get-active-session-2",
    getAllSessions: "get-all-sessions",
    clearActiveSession: "clear-active-session",
    clearAllSessions: "clear-all-sessions",
    refreshActiveSession: "refresh-active-session",
  },
  multiSessionManagement: {
    activeSession: "active-session",
    sessionKeyInput: "session-key-input",
    loginWithSessionKeyButton: "login-with-session-key-button",
  },
  externalWalletMethods: {
    fetchWalletProviders2: "fetch-wallet-providers-2",
    connectWalletAccount: "connect-wallet-account",
    signUpWithWallet: "sign-up-with-wallet",
    loginWithWallet: "login-with-wallet",
    continueWithWallet: "continue-with-wallet",
    connectOrDisconnectWallet: "connect-or-disconnect-wallet",
  },
  signingMethods: {
    signSolTransaction: "sign-sol-transaction",
    signEthTransaction: "sign-eth-transaction",
    signMessage: "sign-message",
    signWithViem: "sign-with-viem",
  },
};

export const walletKitSelectors = {
  authComponent: {
    googleOAuthButton: "oauth-google",
    appleOAuthButton: "oauth-apple",
    facebookOAuthButton: "oauth-facebook",
    xOAuthButton: "oauth-x",
    discordOAuthButton: "oauth-discord",
    emailInput: "email-input",
    emailContinue: "email-continue-icon",
    phoneInput: "phone-input",
    phoneContinue: "phone-continue-icon",
    passkeyLoginButton: "passkey-login-button",
    passkeySignupButton: "passkey-signup-button",
    walletAuthButton: "wallet-auth-button",
  },
  exportComponent: {
    confirmExportButton: "confirm-export-warning-button",
    exportDoneButton: "export-done",
  },
  importComponent: {
    confirmImportButton: "import-button",
    importWalletNameInput: "import-wallet-name-input",
    importErrorMessage: "import-error-message",
  },
  removePasskeyComponent: {
    removePasskeyButton: "remove-passkey-button",
  },
};

export const externalSelectors = {
  test_id_authenticator_selection_laptop:
    "test_id_authenticator_selection_laptop",
  test_id_authenticator_selection_security_key:
    "test_id_authenticator_selection_security_key",
  test_id_authenticator_selection_continue_button:
    "test_id_authenticator_selection_continue_button",
};
