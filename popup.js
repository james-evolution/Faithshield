// Storage keys for persistent blacklist data and rule IDs.
const STORAGE_KEY = "blacklistEntries";
const NEXT_ID_KEY = "nextRuleId";
const RULE_ID_START = 1000;
const MODE_KEY = "emergencyMode";
const MESSAGE_KEY = "customEmergencyMessage";
const DEFAULT_MODE = "default";

const form = document.getElementById("add-form");
const input = document.getElementById("site-input");
const list = document.getElementById("site-list");
const count = document.getElementById("count");
const status = document.getElementById("status");
const modeDefault = document.getElementById("mode-default");
const modeCustom = document.getElementById("mode-custom");
const messageInput = document.getElementById("message-input");
const saveMessageButton = document.getElementById("save-message");

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

// Render the current blacklist into the popup UI.
function renderEntries(entries) {
    list.innerHTML = "";
    if (!entries.length) {
        const empty = document.createElement("li");
        empty.textContent = "No blocked sites yet.";
        empty.style.color = "#9fb0c0";
        empty.style.fontSize = "12px";
        list.appendChild(empty);
    } else {
        entries.forEach((entry) => {
            const item = document.createElement("li");
            const label = document.createElement("span");
            label.textContent = entry.domain;

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "remove-btn";
            removeBtn.textContent = "Remove";
            removeBtn.addEventListener("click", () => removeEntry(entry.id));

            item.append(label, removeBtn);
            list.appendChild(item);
        });
    }

    count.textContent = String(entries.length);
}

// Load emergency page settings for mode and custom text.
async function getEmergencySettings() {
    const data = await chrome.storage.local.get([MODE_KEY, MESSAGE_KEY]);
    return {
        mode: typeof data[MODE_KEY] === "string" ? data[MODE_KEY] : DEFAULT_MODE,
        message: typeof data[MESSAGE_KEY] === "string" ? data[MESSAGE_KEY] : "",
    };
}

// Persist emergency page settings.
async function saveEmergencySettings(mode, message) {
    await chrome.storage.local.set({
        [MODE_KEY]: mode,
        [MESSAGE_KEY]: message,
    });
}

// Sync the emergency settings UI with stored values.
function applyEmergencySettings(mode, message) {
    const isCustom = mode === "custom";
    modeDefault.checked = !isCustom;
    modeCustom.checked = isCustom;
    messageInput.value = message || "";
    messageInput.disabled = !isCustom;
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

    const updatedEntries = [...entries, { id: ruleId, domain }];
    await saveEntries(updatedEntries, ruleId + 1);
    renderEntries(updatedEntries);
    setStatus("Added to blacklist.");
}

// Remove a domain by ID from storage and dynamic redirect rules.
async function removeEntry(id) {
    const { entries, nextId } = await getStoredEntries();
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

// Handle emergency page setting changes.
saveMessageButton.addEventListener("click", async () => {
    const mode = modeCustom.checked ? "custom" : "default";
    const message = messageInput.value.trim();

    if (mode === "custom" && !message) {
        setStatus("Enter a custom message or switch to default.", true);
        return;
    }

    try {
        await saveEmergencySettings(mode, message);
        applyEmergencySettings(mode, message);
        setStatus("Emergency page settings saved.");
    } catch (error) {
        const messageText = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Failed to save settings: ${messageText}`, true);
    }
});

modeDefault.addEventListener("change", () => {
    messageInput.disabled = true;
});

modeCustom.addEventListener("change", () => {
    messageInput.disabled = false;
});

// Initial render on popup load.
(async () => {
        const [{ entries }, { mode, message }] = await Promise.all([
                getStoredEntries(),
                getEmergencySettings(),
        ]);
        renderEntries(entries);
        applyEmergencySettings(mode, message);
})();
