// Storage keys and rule metadata for persisting list state.
const STORAGE_KEY = "blacklistEntries";
const DEFAULT_LIST_KEY = "defaultSeedList";
const NEXT_ID_KEY = "nextRuleId";
const RULE_ID_START = 1000;
const SOURCE_SEED = "seed";
const SOURCE_USER = "user";
const ENTRY_TYPE_DOMAIN = "domain";
const ENTRY_TYPE_KEYWORD = "keyword";

// Search engines we apply keyword rules to (main_frame searches only).
const SEARCH_DOMAINS = [
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
  "yandex.com",
  "search.brave.com",
  "startpage.com",
];

// DOM references for lists, forms, and status text.
const form = document.getElementById("add-form");
const input = document.getElementById("site-input");
const keywordForm = document.getElementById("add-keyword-form");
const keywordInput = document.getElementById("keyword-input");
const customList = document.getElementById("custom-site-list");
const keywordList = document.getElementById("custom-keyword-list");
const defaultList = document.getElementById("default-site-list");
const customCount = document.getElementById("custom-count");
const keywordCount = document.getElementById("keyword-count");
const defaultCount = document.getElementById("default-count");
const status = document.getElementById("status");

// Seed domains that ship with the extension.
let defaultDomains = [
  "pornhub.com",
  "xvideos.com",
  "xhamster.com",
  "xnxx.com",
  "youporn.com",
  "redtube.com",
  "tube8.com",
  "spankbang.com",
  "chaturbate.com",
  "livejasmin.com",
  "bongacams.com",
  "stripchat.com",
  "onlyfans.com",
  "manyvids.com",
  "adulttime.com",
  "brazzers.com",
  "bangbros.com",
  "naughtyamerica.com",
  "realitykings.com",
  "mofos.com",
  "porn.com",
  "porntube.com",
  "pornhd.com",
  "eporner.com",
  "thumbzilla.com",
  "tnaflix.com",
  "nudevista.com",
  "fuq.com",
  "sunporno.com",
  "keezmovies.com",
  "pornhubpremium.com",
  "eroprofile.com",
  "literotica.com",
  "imagefap.com",
  "motherless.com",
  "4tube.com",
  "x-art.com",
  "porndoe.com",
  "hclips.com",
  "porn300.com"
];

// Update the status banner with success or error styling.
function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#f07178" : "#f7b44c";
}

// Normalize a user input into a bare hostname.
function normalizeDomain(value) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const hostname = url.hostname.replace(/^www\./, "");
    return hostname;
  } catch (error) {
    return "";
  }
}

// Basic domain validation; accepts localhost for testing.
function isValidDomain(domain) {
  if (!domain) {
    return false;
  }
  if (domain === "localhost") {
    return true;
  }
  const domainPattern = /^[a-z0-9.-]+$/;
  return domainPattern.test(domain) && domain.includes(".");
}

// Normalize keywords by trimming, lowercasing, and collapsing whitespace.
function normalizeKeyword(value) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\s+/g, " ");
}

// Keywords can be a single word or a phrase; empty is invalid.
function isValidKeyword(keyword) {
  return Boolean(keyword);
}

// Escape regex metacharacters so user input is treated literally in a regex.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Convert a keyword/phrase into a regex fragment that matches query text.
// For multi-word phrases, we allow spaces encoded as "+" or "%20" in URLs.
function keywordToRegexFilter(keyword) {
  const parts = keyword.split(" ");
  if (parts.length === 1) {
    return escapeRegex(parts[0]);
  }
  // Non-capturing group that matches one or more URL-encoded spaces.
  // - "\\+" matches a literal '+' in the URL query.
  // - "%20" matches the percent-encoded space.
  // - "+" after the group allows repeated encodings (e.g., multiple spaces).
  const encodedGap = "(?:\\+|%20)+";
  return parts.map(escapeRegex).join(encodedGap);
}

// Convert a domain into a DNR urlFilter pattern ("||" domain boundary + "^").
function toUrlFilter(domain) {
  return `||${domain}^`;
}

// Determine whether an entry belongs to the default seed list.
function isSeedEntry(entry) {
  if (getEntryType(entry) === ENTRY_TYPE_KEYWORD) {
    return false;
  }
  if (entry.source === SOURCE_SEED) {
    return true;
  }
  const domain = normalizeDomain(getEntryValue(entry)) || getEntryValue(entry);
  return defaultDomains.includes(domain);
}

// Normalize entry types (defensive against older stored formats).
function getEntryType(entry) {
  return entry.type === ENTRY_TYPE_KEYWORD ? ENTRY_TYPE_KEYWORD : ENTRY_TYPE_DOMAIN;
}

// Read the stored value consistently across entry shapes.
function getEntryValue(entry) {
  return entry.value || entry.domain || "";
}

// Wrapper to update DNR rules with promise semantics.
function updateDynamicRules(changes) {
  return new Promise((resolve, reject) => {
    if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) {
      reject(new Error("Dynamic rules API not available."));
      return;
    }

    chrome.declarativeNetRequest.updateDynamicRules(changes, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

// Load stored entries and the next available rule id.
async function getStoredEntries() {
  const data = await chrome.storage.local.get([STORAGE_KEY, NEXT_ID_KEY]);
  const entries = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  const nextId = typeof data[NEXT_ID_KEY] === "number" ? data[NEXT_ID_KEY] : RULE_ID_START;
  return { entries, nextId };
}

// Persist entries and the next rule id.
async function saveEntries(entries, nextId) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: entries,
    [NEXT_ID_KEY]: nextId,
  });
}

// Render a placeholder line when a list is empty.
function renderEmpty(list, message) {
  const empty = document.createElement("li");
  empty.className = "list-group-item bg-dark text-secondary border-secondary small";
  empty.textContent = message;
  list.appendChild(empty);
}

// Render user-managed lists for domains and keywords.
function renderCustomEntries(entries) {
  customList.innerHTML = "";
  keywordList.innerHTML = "";
  const userEntries = entries.filter((entry) => !isSeedEntry(entry));
  const domainEntries = userEntries.filter((entry) => getEntryType(entry) === ENTRY_TYPE_DOMAIN);
  const keywordEntries = userEntries.filter((entry) => getEntryType(entry) === ENTRY_TYPE_KEYWORD);

  if (!domainEntries.length) {
    renderEmpty(customList, "No custom blocked sites yet.");
    customCount.textContent = "0";
  } else {
    renderEntryList(customList, domainEntries, ENTRY_TYPE_DOMAIN);
    customCount.textContent = String(domainEntries.length);
  }

  if (!keywordEntries.length) {
    renderEmpty(keywordList, "No custom blocked keywords yet.");
    keywordCount.textContent = "0";
  } else {
    renderEntryList(keywordList, keywordEntries, ENTRY_TYPE_KEYWORD);
    keywordCount.textContent = String(keywordEntries.length);
  }
}

// Render entries with newest-first ordering.
function renderEntryList(list, entries, entryType) {
  const sortedEntries = [...entries].sort((a, b) => {
    const timeA = typeof a.addedAt === "number" ? a.addedAt : 0;
    const timeB = typeof b.addedAt === "number" ? b.addedAt : 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return b.id - a.id;
  });

  sortedEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "list-group-item d-flex justify-content-between align-items-center bg-dark text-light border-secondary";

    const label = document.createElement("span");
    label.className = "small text-truncate";
    label.textContent = getEntryValue(entry);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-outline-danger btn-sm";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeEntry(entry.id));

    item.append(label, removeBtn);
    list.appendChild(item);
  });
}

// Render the default seed list (from storage or hardcoded defaults).
function renderDefaultEntries(entries) {
  defaultList.innerHTML = "";
  const defaultEntries = entries
    .filter((entry) => isSeedEntry(entry))
    .map((entry) => getEntryValue(entry));
  const domains = defaultDomains.length ? defaultDomains : defaultEntries;

  if (!domains.length) {
    renderEmpty(defaultList, "No default sites configured.");
    defaultCount.textContent = "0";
    return;
  }

  domains
    .sort((a, b) => a.localeCompare(b))
    .forEach((domain) => {
      const item = document.createElement("li");
      item.className = "list-group-item d-flex align-items-center bg-dark text-info border-secondary";

      const label = document.createElement("span");
      label.className = "small text-truncate";
      label.textContent = domain;

      const badge = document.createElement("span");
      badge.className = "badge text-bg-info text-dark default-badge";
      badge.textContent = "Default";

      item.append(label, badge);
      defaultList.appendChild(item);
    });

  defaultCount.textContent = String(domains.length);
}

// Add a domain rule, update storage, and refresh UI.
async function addEntry(domain) {
  const { entries, nextId } = await getStoredEntries();

  if (entries.some((entry) => getEntryType(entry) === ENTRY_TYPE_DOMAIN && getEntryValue(entry) === domain)) {
    setStatus("Already on the blacklist.", true);
    return;
  }

  const ruleId = nextId;
  const rule = buildDomainRule(ruleId, domain);

  await updateDynamicRules({
    addRules: [rule],
    removeRuleIds: [],
  });

  const updatedEntries = [
    { id: ruleId, type: ENTRY_TYPE_DOMAIN, value: domain, source: SOURCE_USER, addedAt: Date.now() },
    ...entries,
  ];
  await saveEntries(updatedEntries, ruleId + 1);
  renderCustomEntries(updatedEntries);
  setStatus("Added to blacklist.");
}

// Add a keyword rule targeted at search queries.
async function addKeyword(keyword) {
  const { entries, nextId } = await getStoredEntries();

  if (entries.some((entry) => getEntryType(entry) === ENTRY_TYPE_KEYWORD && getEntryValue(entry) === keyword)) {
    setStatus("Keyword already blocked.", true);
    return;
  }

  const ruleId = nextId;
  const rule = buildKeywordRule(ruleId, keyword);

  await updateDynamicRules({
    addRules: [rule],
    removeRuleIds: [],
  });

  const updatedEntries = [
    { id: ruleId, type: ENTRY_TYPE_KEYWORD, value: keyword, source: SOURCE_USER, addedAt: Date.now() },
    ...entries,
  ];
  await saveEntries(updatedEntries, ruleId + 1);
  renderCustomEntries(updatedEntries);
  setStatus("Keyword blocked.");
}

// Build a DNR rule that redirects matching domains to emergency.html.
function buildDomainRule(ruleId, domain) {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: "/emergency.html" },
    },
    condition: {
      urlFilter: toUrlFilter(domain),
      isUrlFilterCaseSensitive: false,
      resourceTypes: ["main_frame"],
    },
  };
}

// Build a DNR rule that redirects when a search URL contains the keyword(s).
function buildKeywordRule(ruleId, keyword) {
  // Full regex behavior:
  // - We surround the fragment with ".*" so the keyword can appear anywhere
  //   in the URL (path or query string).
  // - keywordToRegexFilter() escapes the user's words to be literal.
  // - For phrases, it inserts an encoded-gap regex so "foo bar" matches:
  //     "foo+bar", "foo%20bar", or "foo++bar" in the URL.
  // - This prevents regex injection while still catching URL-encoded spaces.
  const regexFilter = `.*${keywordToRegexFilter(keyword)}.*`;
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: "/emergency.html" },
    },
    condition: {
      regexFilter,
      isUrlFilterCaseSensitive: false,
      resourceTypes: ["main_frame"],
      requestDomains: SEARCH_DOMAINS,
    },
  };
}

// Remove a rule from DNR and storage, except for seed entries.
async function removeEntry(id) {
  const { entries, nextId } = await getStoredEntries();
  const entry = entries.find((item) => item.id === id);
  if (entry && isSeedEntry(entry)) {
    setStatus("Default entries cannot be removed.", true);
    return;
  }

  const updatedEntries = entries.filter((entry) => entry.id !== id);

  await updateDynamicRules({
    addRules: [],
    removeRuleIds: [id],
  });

  await saveEntries(updatedEntries, nextId);
  renderCustomEntries(updatedEntries);
  setStatus("Removed from blacklist.");
}

// Handle adding a custom domain via the form.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  const domain = normalizeDomain(input.value);
  if (!isValidDomain(domain)) {
    setStatus("Enter a valid domain like example.com.", true);
    return;
  }

  try {
    await addEntry(domain);
    input.value = "";
    input.focus();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    setStatus(`Failed to add rule: ${message}`, true);
  }
});

// Handle adding a custom keyword via the form.
keywordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  const keyword = normalizeKeyword(keywordInput.value);
  if (!isValidKeyword(keyword)) {
    setStatus("Enter a keyword or phrase.", true);
    return;
  }

  try {
    await addKeyword(keyword);
    keywordInput.value = "";
    keywordInput.focus();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    setStatus(`Failed to add keyword: ${message}`, true);
  }
});

// Initial load: seed defaults, then render stored entries.
(async () => {
  const data = await chrome.storage.local.get([DEFAULT_LIST_KEY]);
  const storedDefaults = data[DEFAULT_LIST_KEY];
  if (Array.isArray(storedDefaults) && storedDefaults.length) {
    defaultDomains = storedDefaults;
  } else {
    await chrome.storage.local.set({ [DEFAULT_LIST_KEY]: defaultDomains });
  }

  const { entries } = await getStoredEntries();
  renderCustomEntries(entries);
  renderDefaultEntries(entries);
})();
