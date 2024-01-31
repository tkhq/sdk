// Polyfill TextEncoder: needed for @noble/hashes/sha256 to work properly
import "text-encoding-polyfill";
// Polyfill for crypto.getRandomValues: needed for random challenge generation
import "react-native-get-random-values";
