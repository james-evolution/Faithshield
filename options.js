const MODE_KEY = "emergencyMode";
const MESSAGE_KEY = "customEmergencyMessage";
const DEFAULT_MODE = "default";

const modeDefault = document.getElementById("mode-default");
const modeCustom = document.getElementById("mode-custom");
const messageInput = document.getElementById("message-input");
const saveMessageButton = document.getElementById("save-message");
const status = document.getElementById("status");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#f07178" : "#f7b44c";
}

async function getEmergencySettings() {
  const data = await chrome.storage.local.get([MODE_KEY, MESSAGE_KEY]);
  return {
    mode: typeof data[MODE_KEY] === "string" ? data[MODE_KEY] : DEFAULT_MODE,
    message: typeof data[MESSAGE_KEY] === "string" ? data[MESSAGE_KEY] : "",
  };
}

async function saveEmergencySettings(mode, message) {
  await chrome.storage.local.set({
    [MODE_KEY]: mode,
    [MESSAGE_KEY]: message,
  });
}

function applyEmergencySettings(mode, message) {
  const isCustom = mode === "custom";
  modeDefault.checked = !isCustom;
  modeCustom.checked = isCustom;
  messageInput.value = message || "";
  messageInput.disabled = !isCustom;
}

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

(async () => {
  const { mode, message } = await getEmergencySettings();
  applyEmergencySettings(mode, message);
})();
