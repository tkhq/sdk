const localStorageMock = (() => {
  let store = {};
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = value.toString();
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

const navigatorCredentialsMock = (() => {
  return {
    credentials: {
      get: (_) => {
        return {
          toJSON: () => {
            return {
              id: "credential-id",
              response: {
                authenticatorData: "authenticator-data",
                clientDataJSON: "client-data-json",
                signature: "the-signature",
              },
            };
          },
        };
      },
    },
  };
})();

Object.defineProperty(window, "navigator", {
  value: navigatorCredentialsMock,
});
