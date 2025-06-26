---
"@turnkey/http": minor
---

Added `name` field to constructor. `isHttpClient` now uses this new field to complete the check. This fixes a bug where `isHttpClient` would fail the check under certain production environments.

Synced with mono 2025.6.10 to include the following endpoints:

`update_user_email`: Update a User's email in an existing Organization

`update_user_name`: Update a User's name in an existing Organization

`update_user_phone_number`: Update a User's phone number in an existing Organization
