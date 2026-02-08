// Storage keys for persistent blacklist data and rule IDs.
const STORAGE_KEY = "blacklistEntries";
const NEXT_ID_KEY = "nextRuleId";
const RULE_ID_START = 1000;
const SOURCE_SEED = "seed";
const SOURCE_USER = "user";
const DEFAULT_BLACKLIST =
    [
        "xvideos.com",
        "xhamster.com",
        "xnxx.com",
        "youporn.com",
        "redtube.com",
        "tub8e.com",
        "ixxx.com",
        "porn.com",
        "spankbang.com",
        "beeg.com",
        "eporner.com",
        "youjizz.com",
        "pornhubpremium.com",
        "chaturbate.com",
        "stripchat.com",
        "onlyfans.com",
        "manyvids.com",
        "tnaflix.com",
        "pornhubthumbnails.com"
    ];
const form = document.getElementById("add-form");
const input = document.getElementById("site-input");
const list = document.getElementById("site-list");
const defaultList = document.getElementById("default-site-list");
const count = document.getElementById("count");
const status = document.getElementById("status");
const openSettingsButton = document.getElementById("open-settings");

// Surface user-facing status in the popup.
function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? "#f07178" : "#f7b44c";
}

// Wrap dynamic rule updates so we can surface runtime errors in the UI.
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

// Accept a URL or hostname and normalize to a bare domain.
/*
Normalizing a domain means taking whatever the user typed (full URL or hostname) and converting it into a consistent, canonical form that you can store and compare reliably. In popup.js:26-41, normalizeDomain() does this by:

Trimming whitespace and lowercasing.
Accepting either a full URL or a bare domain by forcing a scheme when missing.
Extracting just the hostname from the URL.
Stripping a leading www. so www.example.com and example.com are treated the same.
Returning an empty string if parsing fails.
This keeps storage consistent, prevents duplicates, and ensures the URL filter rule is generated from a clean domain.
*/
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

// Ensure we only add reasonable hostnames to the blacklist.
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

// Declarative Net Request expects URL filters in this format.
function toUrlFilter(domain) {
    return `||${domain}^`;
}

// Load stored entries plus the next available rule ID.
async function getStoredEntries() {
    const data = await chrome.storage.local.get([STORAGE_KEY, NEXT_ID_KEY]);
    const entries = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    const nextId = typeof data[NEXT_ID_KEY] === "number" ? data[NEXT_ID_KEY] : RULE_ID_START;
    return { entries, nextId };
}

// Persist blacklist data and the next rule ID.
async function saveEntries(entries, nextId) {
    await chrome.storage.local.set({
        [STORAGE_KEY]: entries,
        [NEXT_ID_KEY]: nextId,
    });
}

async function seedDefaultBlacklist() {
    const { entries, nextId } = await getStoredEntries();
    if (DEFAULT_BLACKLIST.length === 0) {
        return { entries, nextId };
    }

    const domains = DEFAULT_BLACKLIST
        .map((domain) => normalizeDomain(domain))
        .filter((domain) => isValidDomain(domain));
    const uniqueDomains = [...new Set(domains)];
    if (!uniqueDomains.length) {
        return { entries, nextId };
    }

    const defaultDomainSet = new Set(uniqueDomains);
    const normalizedEntries = entries.map((entry) => {
        const normalizedDomain = normalizeDomain(entry.domain) || entry.domain;
        const source = entry.source || (defaultDomainSet.has(normalizedDomain) ? SOURCE_SEED : SOURCE_USER);
        return {
            ...entry,
            domain: normalizedDomain,
            source,
            addedAt: typeof entry.addedAt === "number" ? entry.addedAt : 0,
        };
    });

    const existingDomains = new Set(normalizedEntries.map((entry) => entry.domain));
    const domainsToAdd = uniqueDomains.filter((domain) => !existingDomains.has(domain));
    if (!domainsToAdd.length && normalizedEntries === entries) {
        return { entries: normalizedEntries, nextId };
    }

    let currentId = nextId;
    const rules = [];
    const newEntries = [];

    domainsToAdd.forEach((domain) => {
        rules.push({
            id: currentId,
            priority: 1,
            action: {
                type: "redirect",
                redirect: { extensionPath: "/emergency.html" },
            },
            condition: {
                urlFilter: toUrlFilter(domain),
                resourceTypes: ["main_frame"],
            },
        });
        newEntries.push({
            id: currentId,
            domain,
            source: SOURCE_SEED,
            addedAt: 0,
        });
        currentId += 1;
    });

    await updateDynamicRules({
        addRules: rules,
        removeRuleIds: [],
    });

    const updatedEntries = [...normalizedEntries, ...newEntries];
    await saveEntries(updatedEntries, currentId);
    return { entries: updatedEntries, nextId: currentId };
}

function isSeedEntry(entry) {
    if (entry.source === SOURCE_SEED) {
        return true;
    }

    const domain = normalizeDomain(entry.domain) || entry.domain;
    return DEFAULT_BLACKLIST
        .map((seed) => normalizeDomain(seed))
        .filter((seed) => seed)
        .includes(domain);
}

// Render the current blacklist into the popup UI.
function renderEntries(entries) {
    list.innerHTML = "";
    if (!entries.length) {
        const empty = document.createElement("li");
        empty.className = "list-group-item bg-dark text-secondary border-secondary small";
        empty.textContent = "No blocked sites yet.";
        list.appendChild(empty);
    } else {
        const userEntries = entries.filter((entry) => !isSeedEntry(entry));
        if (!userEntries.length) {
            const empty = document.createElement("li");
            empty.className = "list-group-item bg-dark text-secondary border-secondary small";
            empty.textContent = "No custom blocked sites yet.";
            list.appendChild(empty);
        }

        const sortedEntries = userEntries.sort((a, b) => {
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
            list.appendChild(item);
        });
    }

    const userCount = entries.filter((entry) => !isSeedEntry(entry)).length;
    count.textContent = String(userCount) + " sites blacklisted";
    renderDefaultEntries(entries);
}

function renderDefaultEntries(entries) {
    if (!defaultList) {
        return;
    }

    defaultList.innerHTML = "";
    const defaultEntries = entries
        .filter((entry) => isSeedEntry(entry))
        .sort((a, b) => a.domain.localeCompare(b.domain));

    if (!defaultEntries.length) {
        const empty = document.createElement("li");
        empty.className = "list-group-item bg-dark text-secondary border-secondary small";
        empty.textContent = "No default sites configured.";
        defaultList.appendChild(empty);
        return;
    }

    defaultEntries.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "list-group-item d-flex align-items-center bg-dark text-info border-secondary";

        const label = document.createElement("span");
        label.className = "small text-truncate";
        label.textContent = entry.domain;

        const badge = document.createElement("span");
        badge.className = "badge text-bg-info text-dark default-badge";
        badge.textContent = "Default";

        item.append(label, badge);
        defaultList.appendChild(item);
    });
}

// Add a new domain to storage and to dynamic redirect rules.
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
    renderEntries(updatedEntries);
    setStatus("Added to blacklist.");
}

// Remove a domain by ID from storage and dynamic redirect rules.
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
    renderEntries(updatedEntries);
    setStatus("Removed from blacklist.");
}

// Handle adding new blacklist entries from the popup form.
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

// Open the extension options page for emergency settings.
if (openSettingsButton) {
    openSettingsButton.addEventListener("click", () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        }
    });
}

// Initial render on popup load.
(async () => {
    const { entries } = await seedDefaultBlacklist();
    renderEntries(entries);
})();
