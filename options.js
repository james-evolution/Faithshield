const MODE_KEY = "emergencyMode";
const MESSAGE_KEY = "customEmergencyMessage";
const BG_MODE_KEY = "emergencyBackgroundMode";
const BG_URL_KEY = "emergencyBackgroundUrl";
const BG_FIT_KEY = "emergencyBackgroundFit";
const CARD_OPACITY_KEY = "emergencyCardOpacity";
const AUDIO_MODE_KEY = "emergencyAudioMode";
const AUDIO_URL_KEY = "emergencyAudioUrl";
const DEFAULT_MODE = "default";
const DEFAULT_BG_MODE = "default";
const DEFAULT_BG_FIT = "cover";
const DEFAULT_CARD_OPACITY = 40;
const DEFAULT_AUDIO_MODE = "default";

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
const audioDefault = document.getElementById("audio-default");
const audioCustom = document.getElementById("audio-custom");
const audioUrlInput = document.getElementById("audio-url");
const previewFrame = document.getElementById("preview-frame");
const previewFrameWrap = document.getElementById("preview-frame-wrap");
const previewScaleInput = document.getElementById("preview-scale");
const previewScaleValue = document.getElementById("preview-scale-value");
const status = document.getElementById("status");

function applyPreviewScale(value) {
  const parsed = Number(value);
  const scale = Number.isFinite(parsed) ? parsed : 0.85;
  if (previewFrameWrap) {
    previewFrameWrap.style.setProperty("--preview-scale", String(scale));
  }
  if (previewScaleValue) {
    previewScaleValue.textContent = scale.toFixed(2);
  }
  if (previewScaleInput && previewScaleInput.value !== String(scale)) {
    previewScaleInput.value = String(scale);
  }
}

function collectPreviewSettings() {
  return {
    mode: modeCustom.checked ? "custom" : "default",
    message: messageInput.value.trim(),
    backgroundMode: bgCustom.checked ? "custom" : "default",
    backgroundUrl: bgUrlInput.value.trim(),
    backgroundFit: bgFitSelect.value || DEFAULT_BG_FIT,
    cardOpacity: Number(cardOpacityInput.value),
    audioMode: audioCustom.checked ? "custom" : "default",
    audioUrl: audioUrlInput.value.trim(),
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
    AUDIO_MODE_KEY,
    AUDIO_URL_KEY,
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
    audioMode:
      typeof data[AUDIO_MODE_KEY] === "string" ? data[AUDIO_MODE_KEY] : DEFAULT_AUDIO_MODE,
    audioUrl: typeof data[AUDIO_URL_KEY] === "string" ? data[AUDIO_URL_KEY] : "",
  };
}

async function saveEmergencySettings(
  mode,
  message,
  backgroundMode,
  backgroundUrl,
  backgroundFit,
  cardOpacity,
  audioMode,
  audioUrl
) {
  await chrome.storage.local.set({
    [MODE_KEY]: mode,
    [MESSAGE_KEY]: message,
    [BG_MODE_KEY]: backgroundMode,
    [BG_URL_KEY]: backgroundUrl,
    [BG_FIT_KEY]: backgroundFit,
    [CARD_OPACITY_KEY]: cardOpacity,
    [AUDIO_MODE_KEY]: audioMode,
    [AUDIO_URL_KEY]: audioUrl,
  });
}

function applyEmergencySettings(
  mode,
  message,
  backgroundMode,
  backgroundUrl,
  backgroundFit,
  cardOpacity,
  audioMode,
  audioUrl
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

  const isCustomAudio = audioMode === "custom";
  audioDefault.checked = !isCustomAudio;
  audioCustom.checked = isCustomAudio;
  audioUrlInput.value = audioUrl || "";
  audioUrlInput.disabled = !isCustomAudio;
}

saveMessageButton.addEventListener("click", async () => {
  const {
    mode,
    message,
    backgroundMode,
    backgroundUrl,
    backgroundFit,
    cardOpacity,
    audioMode,
    audioUrl,
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

  if (audioMode === "custom" && !audioUrl) {
    setStatus("Enter a SoundCloud URL or switch to default.", true);
    return;
  }

  try {
    await saveEmergencySettings(
      mode,
      message,
      backgroundMode,
      backgroundUrl,
      backgroundFit,
      cardOpacity,
      audioMode,
      audioUrl
    );
    applyEmergencySettings(
      mode,
      message,
      backgroundMode,
      backgroundUrl,
      backgroundFit,
      cardOpacity,
      audioMode,
      audioUrl
    );
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

audioDefault.addEventListener("change", () => {
  audioUrlInput.disabled = true;
});

audioCustom.addEventListener("change", () => {
  audioUrlInput.disabled = false;
});

cardOpacityInput.addEventListener("input", () => {
  cardOpacityValue.textContent = `${cardOpacityInput.value}%`;
});

if (previewScaleInput) {
  previewScaleInput.addEventListener("input", () => {
    applyPreviewScale(previewScaleInput.value);
  });
}

[modeDefault, modeCustom, messageInput, bgDefault, bgCustom, bgUrlInput, bgFitSelect, cardOpacityInput, audioDefault, audioCustom, audioUrlInput]
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
  const { mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity, audioMode, audioUrl } =
    await getEmergencySettings();
  applyEmergencySettings(
    mode,
    message,
    backgroundMode,
    backgroundUrl,
    backgroundFit,
    cardOpacity,
    audioMode,
    audioUrl
  );
  applyPreviewScale(0.85);
  updatePreview();
})();
