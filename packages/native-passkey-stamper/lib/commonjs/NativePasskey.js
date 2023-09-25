"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NativePasskey = void 0;
var _reactNative = require("react-native");
const LINKING_ERROR = "The package 'react-native-passkey' doesn't seem to be linked. Make sure: \n\n" + _reactNative.Platform.select({
  ios: "- You have run 'pod install'\n",
  default: ''
}) + '- You rebuilt the app after installing the package\n' + '- You are not using Expo managed workflow\n';
const NativePasskey = _reactNative.NativeModules.Passkey ? _reactNative.NativeModules.Passkey : new Proxy({}, {
  get() {
    throw new Error(LINKING_ERROR);
  }
});
exports.NativePasskey = NativePasskey;
//# sourceMappingURL=NativePasskey.js.map