const MODE_KEY = "emergencyMode";
const MESSAGE_KEY = "customEmergencyMessage";
const BG_MODE_KEY = "emergencyBackgroundMode";
const BG_URL_KEY = "emergencyBackgroundUrl";
const BG_FIT_KEY = "emergencyBackgroundFit";
const CARD_OPACITY_KEY = "emergencyCardOpacity";
const DEFAULT_MODE = "default";
const DEFAULT_BG_MODE = "default";
const DEFAULT_BG_FIT = "cover";
const DEFAULT_CARD_OPACITY = 40;

const modeDefault = document.getElementById("mode-default");
const modeCustom = document.getElementById("mode-custom");
const messageInput = document.getElementById("message-input");
const saveMessageButton = document.getElementById("save-message");
const bgDefault = document.getElementById("bg-default");
const bgCustom = document.getElementById("bg-custom");
const bgUrlInput = document.getElementById("bg-url");
const bgFitSelect = document.getElementById("bg-fit");
const cardOpacityInput = document.getElementById("card-opacity");
const cardOpacityValue = document.getElementById("card-opacity-value");
const previewFrame = document.getElementById("preview-frame");
const status = document.getElementById("status");

function collectPreviewSettings() {
  return {
    mode: modeCustom.checked ? "custom" : "default",
    message: messageInput.value.trim(),
    backgroundMode: bgCustom.checked ? "custom" : "default",
    backgroundUrl: bgUrlInput.value.trim(),
    backgroundFit: bgFitSelect.value || DEFAULT_BG_FIT,
    cardOpacity: Number(cardOpacityInput.value),
  };
}

function updatePreview() {
  if (!previewFrame || !previewFrame.contentWindow) {
    return;
  }
  previewFrame.contentWindow.postMessage(
    {
      type: "emergencyPreview",
      payload: collectPreviewSettings(),
    },
    "*"
  );
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#f07178" : "#f7b44c";
}

async function getEmergencySettings() {
  const data = await chrome.storage.local.get([
    MODE_KEY,
    MESSAGE_KEY,
    BG_MODE_KEY,
    BG_URL_KEY,
    BG_FIT_KEY,
    CARD_OPACITY_KEY,
  ]);
  return {
    mode: typeof data[MODE_KEY] === "string" ? data[MODE_KEY] : DEFAULT_MODE,
    message: typeof data[MESSAGE_KEY] === "string" ? data[MESSAGE_KEY] : "",
    backgroundMode:
      typeof data[BG_MODE_KEY] === "string" ? data[BG_MODE_KEY] : DEFAULT_BG_MODE,
    backgroundUrl: typeof data[BG_URL_KEY] === "string" ? data[BG_URL_KEY] : "",
    backgroundFit:
      typeof data[BG_FIT_KEY] === "string" ? data[BG_FIT_KEY] : DEFAULT_BG_FIT,
    cardOpacity:
      typeof data[CARD_OPACITY_KEY] === "number" ? data[CARD_OPACITY_KEY] : DEFAULT_CARD_OPACITY,
  };
}

async function saveEmergencySettings(
  mode,
  message,
  backgroundMode,
  backgroundUrl,
  backgroundFit,
  cardOpacity
) {
  await chrome.storage.local.set({
    [MODE_KEY]: mode,
    [MESSAGE_KEY]: message,
    [BG_MODE_KEY]: backgroundMode,
    [BG_URL_KEY]: backgroundUrl,
    [BG_FIT_KEY]: backgroundFit,
    [CARD_OPACITY_KEY]: cardOpacity,
  });
}

function applyEmergencySettings(
  mode,
  message,
  backgroundMode,
  backgroundUrl,
  backgroundFit,
  cardOpacity
) {
  const isCustom = mode === "custom";
  modeDefault.checked = !isCustom;
  modeCustom.checked = isCustom;
  messageInput.value = message || "";
  messageInput.disabled = !isCustom;

  const isCustomBackground = backgroundMode === "custom";
  bgDefault.checked = !isCustomBackground;
  bgCustom.checked = isCustomBackground;
  bgUrlInput.value = backgroundUrl || "";
  bgUrlInput.disabled = !isCustomBackground;
  bgFitSelect.value = backgroundFit || DEFAULT_BG_FIT;
  bgFitSelect.disabled = !isCustomBackground;

  const resolvedOpacity = Number.isFinite(cardOpacity) ? cardOpacity : DEFAULT_CARD_OPACITY;
  cardOpacityInput.value = String(resolvedOpacity);
  cardOpacityValue.textContent = `${resolvedOpacity}%`;
}

saveMessageButton.addEventListener("click", async () => {
  const {
    mode,
    message,
    backgroundMode,
    backgroundUrl,
    backgroundFit,
    cardOpacity,
  } = collectPreviewSettings();

  if (mode === "custom" && !message) {
    setStatus("Enter a custom message or switch to default.", true);
    return;
  }

  if (backgroundMode === "custom" && !backgroundUrl) {
    setStatus("Enter a background image URL or switch to default.", true);
    return;
  }

  if (!Number.isFinite(cardOpacity) || cardOpacity < 0 || cardOpacity > 100) {
    setStatus("Card transparency must be between 0% and 100%.", true);
    return;
  }

  try {
    await saveEmergencySettings(mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity);
    applyEmergencySettings(mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity);
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

bgDefault.addEventListener("change", () => {
  bgUrlInput.disabled = true;
  bgFitSelect.disabled = true;
});

bgCustom.addEventListener("change", () => {
  bgUrlInput.disabled = false;
  bgFitSelect.disabled = false;
});

cardOpacityInput.addEventListener("input", () => {
  cardOpacityValue.textContent = `${cardOpacityInput.value}%`;
});

[modeDefault, modeCustom, messageInput, bgDefault, bgCustom, bgUrlInput, bgFitSelect, cardOpacityInput]
  .filter(Boolean)
  .forEach((element) => {
    element.addEventListener("input", updatePreview);
    element.addEventListener("change", updatePreview);
  });

if (previewFrame) {
  previewFrame.src = "emergency.html";
  previewFrame.addEventListener("load", () => {
    updatePreview();
  });
}

(async () => {
  const { mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity } =
    await getEmergencySettings();
  applyEmergencySettings(mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity);
  updatePreview();
})();
