---
"@turnkey/iframe-stamper": patch
---

Updated `TIframeStamperConfig` to include `clearClipboardOnPaste`. Defaulting to true, this will grant the iframe `clipboard-write` permissions. Allows clipboard to be cleared after pasting in secrets to import.
