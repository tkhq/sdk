---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
---

Support activity polling (e.g. for awaiting consensus)

- Add an `activityPoller` parameter for configuring polling behavior
- Polling continues until either a max number of retries is reached, or if the activity hits a terminal status
