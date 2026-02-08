const STORAGE_KEY = "blacklistEntries";
const DEFAULT_LIST_KEY = "defaultSeedList";
const NEXT_ID_KEY = "nextRuleId";
const RULE_ID_START = 1000;
const SOURCE_SEED = "seed";
const SOURCE_USER = "user";

const form = document.getElementById("add-form");
const input = document.getElementById("site-input");
const customList = document.getElementById("custom-site-list");
const defaultList = document.getElementById("default-site-list");
const customCount = document.getElementById("custom-count");
const defaultCount = document.getElementById("default-count");
const status = document.getElementById("status");

let defaultDomains = [];

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#f07178" : "#f7b44c";
}

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

function toUrlFilter(domain) {
  return `||${domain}^`;
}

function isSeedEntry(entry) {
  if (entry.source === SOURCE_SEED) {
    return true;
  }
  const domain = normalizeDomain(entry.domain) || entry.domain;
  return defaultDomains.includes(domain);
}

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

async function getStoredEntries() {
  const data = await chrome.storage.local.get([STORAGE_KEY, NEXT_ID_KEY]);
  const entries = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  const nextId = typeof data[NEXT_ID_KEY] === "number" ? data[NEXT_ID_KEY] : RULE_ID_START;
  return { entries, nextId };
}

async function saveEntries(entries, nextId) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: entries,
    [NEXT_ID_KEY]: nextId,
  });
}

function renderEmpty(list, message) {
  const empty = document.createElement("li");
  empty.className = "list-group-item bg-dark text-secondary border-secondary small";
  empty.textContent = message;
  list.appendChild(empty);
}

function renderCustomEntries(entries) {
  customList.innerHTML = "";
  const userEntries = entries.filter((entry) => !isSeedEntry(entry));

  if (!userEntries.length) {
    renderEmpty(customList, "No custom blocked sites yet.");
    customCount.textContent = "0";
    return;
  }

  const sortedEntries = [...userEntries].sort((a, b) => {
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
    label.textContent = entry.domain;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-outline-danger btn-sm";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeEntry(entry.id));

    item.append(label, removeBtn);
    customList.appendChild(item);
  });

  customCount.textContent = String(sortedEntries.length);
}

function renderDefaultEntries(entries) {
  defaultList.innerHTML = "";
  const defaultEntries = entries
    .filter((entry) => isSeedEntry(entry))
    .map((entry) => entry.domain);
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

async function addEntry(domain) {
  const { entries, nextId } = await getStoredEntries();

  if (entries.some((entry) => entry.domain === domain)) {
    setStatus("Already on the blacklist.", true);
    return;
  }

  const ruleId = nextId;
  const rule = {
    id: ruleId,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: "/emergency.html" },
    },
    condition: {
      urlFilter: toUrlFilter(domain),
      resourceTypes: ["main_frame"],
    },
  };

  await updateDynamicRules({
    addRules: [rule],
    removeRuleIds: [],
  });

  const updatedEntries = [
    { id: ruleId, domain, source: SOURCE_USER, addedAt: Date.now() },
    ...entries,
  ];
  await saveEntries(updatedEntries, ruleId + 1);
  renderCustomEntries(updatedEntries);
  setStatus("Added to blacklist.");
}

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

(async () => {
  const data = await chrome.storage.local.get([DEFAULT_LIST_KEY]);
  defaultDomains = Array.isArray(data[DEFAULT_LIST_KEY]) ? data[DEFAULT_LIST_KEY] : [];

  const { entries } = await getStoredEntries();
  renderCustomEntries(entries);
  renderDefaultEntries(entries);
})();
