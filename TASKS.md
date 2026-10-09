# Implementation Plan: CodexBar GNOME

## Overview

GNOME 46 Shell extension inspired by CodexBar for macOS. It lives in the top panel and shows AI coding-provider usage, limits, cost, reset countdowns, provider health, and quick actions. The first version should be privacy-first and local-source-first: read known CLI/config/log locations and optional user-provided API keys/tokens, never store passwords, and make all network integrations explicit.

## Requirements Map

- **R1 — GNOME extension foundation:** GNOME 46 compatible extension structure, metadata, styles, settings schema.
- **R2 — Panel indicator:** Top bar icon/label/meter with merged-provider display and refresh status.
- **R3 — Popup UI:** CodexBar-like provider switcher, usage sections, costs, actions, settings/about/quit.
- **R4 — Transparency/theming:** Adjustable popup opacity, compact/comfortable density, dark/light/system colors where feasible.
- **R5 — Provider abstraction:** Common provider interface for usage, cost, status, reset windows, auth requirements.
- **R6 — Provider connections:** CLI/local files, OAuth/device flow, API keys, browser cookies/manual cookie headers, HTTP APIs.
- **R7 — Privacy/security:** Restrictive config permissions, opt-in cookie/API integrations, no passwords, clear source labels.
- **R8 — Refresh loop:** Manual and timed refresh intervals, stale/error states, provider-specific timeouts.
- **R9 — Notifications:** Optional quota warnings, reset alerts, incident badges.
- **R10 — Tests:** Metadata/schema/script validation plus provider parser unit tests.
- **R11 — Packaging/install:** One-command local install script, enable/reload instructions, zip packaging later.
- **R12 — Documentation:** README install/run/dev/test/provider instructions.

## Tasks

- [x] 1. Project foundation
  - [x] 1.1 Create GNOME extension folder structure
  - [x] 1.2 Add `metadata.json` for GNOME 46
  - [x] 1.3 Add initial `extension.js`, stylesheet, GSettings schema
  - [x] 1.4 Add README, task plan, scripts, and test harness
  - _Requirements: R1, R10, R11, R12_

- [x] 2. Panel indicator
  - [x] 2.1 Implement panel button with provider icon/label
  - [x] 2.2 Add tiny usage meter in panel
  - [x] 2.3 Add stale/error/incident visual states
  - [x] 2.4 Add merge-icons mode: one indicator for selected/highest usage provider
  - _Requirements: R2, R3_

- [x] 3. Popup UI
  - [x] 3.1 Implement provider tabs/switcher row
  - [x] 3.2 Implement selected-provider header: name, updated time, plan
  - [x] 3.3 Implement usage rows: session, weekly, monthly/model-specific
  - [x] 3.4 Implement cost section: today, last 30 days, tokens
  - [x] 3.5 Add menu actions: add account, dashboard, status page, settings, about, quit/disable
  - _Requirements: R3_

- [x] 4. Transparency and design system
  - [x] 4.1 Add opacity setting with GSettings key `popup-opacity`
  - [x] 4.2 Apply translucent popup/card styles using RGBA
  - [x] 4.3 Add compact vs comfortable density setting
  - [x] 4.4 Add reduce-motion-safe transitions only where GNOME supports them
  - _Requirements: R4_

- [x] 5. Provider abstraction
  - [x] 5.1 Define provider result shape
  - [x] 5.2 Define provider capabilities: usage, cost, reset, status, dashboard URL
  - [x] 5.3 Define auth source shape: none, api-key, cli, local-file, oauth, browser-cookie, manual-cookie
  - [x] 5.4 Add provider registry and settings toggles
  - _Requirements: R5, R6, R7_

- [x] 6. Initial providers
  - [x] 6.1 Codex/OpenAI: local Codex CLI/session files first, optional API/dashboard extras later
  - [x] 6.2 Claude: local Claude logs/config first, optional OAuth/API later
  - [x] 6.3 Gemini: gcloud/Gemini CLI OAuth files or API key
  - [x] 6.4 Cursor: manual cookie/API source later due cookie sensitivity
  - [x] 6.5 OpenRouter: API key balance/usage
  - _Requirements: R5, R6, R7_

- [x] 7. Refresh loop
  - [x] 7.1 Manual refresh action
  - [x] 7.2 Refresh cadence settings: manual, 1m, 2m, 5m, 15m
  - [x] 7.3 Per-provider timeout and error isolation
  - [x] 7.4 Stale data markers and last-updated labels
  - _Requirements: R8_

- [x] 8. Settings UI
  - [x] 8.1 Add preferences window using GNOME extension prefs API
  - [x] 8.2 Provider enable/disable toggles
  - [x] 8.3 API key/manual token entry guidance
  - [x] 8.4 Transparency/density/refresh controls
  - [x] 8.5 Privacy panel listing exact files/APIs each enabled provider uses
  - _Requirements: R4, R6, R7, R8_

- [x] 9. Tests
  - [x] 9.1 Add Node test harness for metadata/schema/script validation
  - [x] 9.2 Add provider parser tests with fixture data
  - [ ] 9.3 Add shellcheck-compatible script checks if shellcheck is installed
  - [ ] 9.4 Add CI workflow later
  - _Requirements: R10_

- [x] 10. Install/package
  - [x] 10.1 Add `scripts/install-local.sh`
  - [x] 10.2 Add zip packaging script
  - [x] 10.3 Add nested GNOME Shell dev runner instructions
  - [x] 10.4 Add uninstall script
  - _Requirements: R11, R12_

## Provider Connection Options

1. **Local CLI/config/log source** — safest first step. Examples: Codex CLI files, Claude logs, Gemini/gcloud credentials. No extra auth stored by the extension.
2. **API key/token** — user pastes a provider key into GNOME settings or config. Best for OpenRouter, DeepSeek, OpenAI API billing, etc. Store in GNOME keyring later; MVP can store config with `0600` permissions only if unavoidable.
3. **OAuth/device flow** — extension launches provider login and stores refresh tokens securely. Best UX but more work and security review.
4. **Manual cookie/header** — user pastes a cookie/header for providers with no public API. Explicitly opt-in, show expiry/security warnings.
5. **Browser cookie import** — possible on Linux, but browser encryption/profile formats vary. Treat as advanced/opt-in after MVP.
6. **Provider companion CLI** — run a helper binary/script that returns normalized JSON. Good escape hatch for complex providers.

## Transparency Answer

Yes: GNOME Shell CSS can use translucent colors such as `rgba(245, 242, 255, 0.76)` and `backdrop-filter`-like blur is limited/not generally available in Shell CSS. We can support adjustable opacity for popup surfaces, but true macOS-style frosted blur may depend on GNOME Shell/theme capabilities and should be treated as best-effort.
