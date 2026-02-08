# Faithshield

Faithshield is a Manifest V3 browser extension that redirects users away from adult websites to a calming "emergency" page. It ships with a default block list, lets you add custom domains and search keywords, and supports a custom emergency message.

## What It Does

- Redirects blocked sites to an emergency page.
- Blocks search queries containing selected keywords on common search engines.
- Lets you manage a default seed list plus your own custom rules.
- Supports a custom emergency message in place of the default text.

## How It Works

### High-Level Flow

1. The extension stores domains and keywords in `chrome.storage.local`.
2. When you add a domain or keyword, the extension creates a dynamic DNR rule.
3. Matching requests are redirected to `emergency.html`.
4. The emergency page reads settings to show either a default message or your custom message.

### Dynamic Rule Engine (DNR)

Faithshield uses `chrome.declarativeNetRequest.updateDynamicRules` to manage redirect rules at runtime.

- Domain rules: If a request matches a blocked domain, the main page navigation is redirected to `emergency.html`.
- Keyword rules: If a search URL contains a blocked keyword or phrase, the navigation is redirected to `emergency.html`.

### Keyword Matching

Keyword rules apply only to main-frame requests for common search engines:

- `google.com`, `bing.com`, `duckduckgo.com`, `yahoo.com`, `yandex.com`, `search.brave.com`, `startpage.com`

The rule is generated as a regex filter that matches the keyword anywhere in the URL. For multi-word phrases, the regex allows URL-encoded spaces (either `+` or `%20`).

### Emergency Page Settings

The emergency page reads these stored keys:

- `emergencyMode`: `default` or `custom`
- `customEmergencyMessage`: user-provided text

If `custom` is selected, the emergency page displays the custom message instead of the default text.

## Project Structure

- `manifest.json`: Extension manifest (MV3, permissions, entry points).
- `background.js`: Opens the options page when the extension icon is clicked.
- `options.html`: Settings landing page with navigation.
- `blacklist.html` / `blacklist.js`: Manage blocked domains and keywords.
- `emergency.html` / `emergency.js` / `emergency.css`: Emergency redirect page and styling.
- `audioplayer.html` + `audioplayerengine/`: Embedded audio player shown on the emergency page.

## Permissions

Faithshield requires:

- `storage`: Persist custom settings and block entries.
- `declarativeNetRequest`: Add and remove redirect rules.
- `declarativeNetRequestWithHostAccess`: Apply rules to all URLs.
- `host_permissions`: `<all_urls>` to evaluate requests across the web.

## Manual Installation (Chrome / Edge)

1. Open your browser and go to the extensions page.
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the extension folder:
   - `faithshield_extension`
5. Confirm the extension is installed.
6. Click the extension icon to open settings and manage your blacklist.

## Usage

- Open the options page via the extension icon.
- Use the **Blacklist** page to add custom domains or keywords.
- Use the **Emergency Page** settings to set a custom message.
- Visiting a blocked site will redirect to the emergency page.

## Notes

- Keyword rules only apply to search engine URLs, not arbitrary websites.
- Domain rules are case-insensitive and target main-frame navigations only.
- The default seed list cannot be removed from the UI.
