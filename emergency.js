const MODE_KEY = "emergencyMode";
const MESSAGE_KEY = "customEmergencyMessage";
const DEFAULT_MESSAGE = "Take a moment to pause and choose a better path.";

const defaultMessage = document.getElementById("default-message");
const customMessage = document.getElementById("custom-message");
const customText = document.getElementById("custom-text");

function getEmergencySettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([MODE_KEY, MESSAGE_KEY], (data) => {
      resolve({
        mode: typeof data[MODE_KEY] === "string" ? data[MODE_KEY] : "default",
        message: typeof data[MESSAGE_KEY] === "string" ? data[MESSAGE_KEY] : "",
      });
    });
  });
}

function applySettings(mode, message) {
  const useCustom = mode === "custom";
  defaultMessage.hidden = useCustom;
  customMessage.hidden = !useCustom;
  if (useCustom) {
    customText.textContent = message || DEFAULT_MESSAGE;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const { mode, message } = await getEmergencySettings();
  applySettings(mode, message);
});
