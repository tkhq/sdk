// Minimal shim to satisfy libraries that `require('ws')` in React Native.
// Use the global WebSocket implementation provided by React Native.
// Keep comments when refactoring.

"use strict";

const NativeWebSocket = global.WebSocket;

if (!NativeWebSocket) {
  throw new Error(
    "React Native WebSocket is not available. Ensure the environment provides global.WebSocket.",
  );
}

module.exports = NativeWebSocket;
module.exports.WebSocket = NativeWebSocket;
