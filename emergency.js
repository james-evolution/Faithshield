const MODE_KEY = "emergencyMode";
const MESSAGE_KEY = "customEmergencyMessage";
const BG_MODE_KEY = "emergencyBackgroundMode";
const BG_URL_KEY = "emergencyBackgroundUrl";
const BG_FIT_KEY = "emergencyBackgroundFit";
const CARD_OPACITY_KEY = "emergencyCardOpacity";
const DEFAULT_MESSAGE = "Take a moment to pause and choose a better path.";
const DEFAULT_BG_MODE = "default";
const DEFAULT_BG_FIT = "cover";
const DEFAULT_CARD_OPACITY = 40;

const defaultMessage = document.getElementById("default-message");
const customMessage = document.getElementById("custom-message");
const customText = document.getElementById("custom-text");

function getEmergencySettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [MODE_KEY, MESSAGE_KEY, BG_MODE_KEY, BG_URL_KEY, BG_FIT_KEY, CARD_OPACITY_KEY],
      (data) => {
      resolve({
        mode: typeof data[MODE_KEY] === "string" ? data[MODE_KEY] : "default",
        message: typeof data[MESSAGE_KEY] === "string" ? data[MESSAGE_KEY] : "",
        backgroundMode:
          typeof data[BG_MODE_KEY] === "string" ? data[BG_MODE_KEY] : DEFAULT_BG_MODE,
        backgroundUrl: typeof data[BG_URL_KEY] === "string" ? data[BG_URL_KEY] : "",
        backgroundFit:
          typeof data[BG_FIT_KEY] === "string" ? data[BG_FIT_KEY] : DEFAULT_BG_FIT,
        cardOpacity:
          typeof data[CARD_OPACITY_KEY] === "number" ? data[CARD_OPACITY_KEY] : DEFAULT_CARD_OPACITY,
      });
      }
    );
  });
}

function applySettings(mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity) {
  const useCustom = mode === "custom";
  defaultMessage.hidden = useCustom;
  customMessage.hidden = !useCustom;
  if (useCustom) {
    customText.textContent = message || DEFAULT_MESSAGE;
  }

  if (backgroundMode === "custom" && backgroundUrl) {
    document.body.style.backgroundImage = `url("${backgroundUrl}")`;
    document.body.style.backgroundSize = backgroundFit || DEFAULT_BG_FIT;
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
  } else {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundRepeat = "";
  }

  const resolvedOpacity = Number.isFinite(cardOpacity) ? cardOpacity : DEFAULT_CARD_OPACITY;
  document.documentElement.style.setProperty("--card-alpha", String(resolvedOpacity / 100));
}

function normalizePreviewSettings(payload) {
  return {
    mode: typeof payload?.mode === "string" ? payload.mode : "default",
    message: typeof payload?.message === "string" ? payload.message : "",
    backgroundMode:
      typeof payload?.backgroundMode === "string" ? payload.backgroundMode : DEFAULT_BG_MODE,
    backgroundUrl: typeof payload?.backgroundUrl === "string" ? payload.backgroundUrl : "",
    backgroundFit: typeof payload?.backgroundFit === "string" ? payload.backgroundFit : DEFAULT_BG_FIT,
    cardOpacity:
      typeof payload?.cardOpacity === "number" ? payload.cardOpacity : DEFAULT_CARD_OPACITY,
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.self !== window.top) {
    document.body.classList.add("preview-mode");
  }
  const { mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity } =
    await getEmergencySettings();
  applySettings(mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity);
  if (window.bootstrap && window.bootstrap.Tooltip) {
    document
      .querySelectorAll("[data-bs-toggle=\"tooltip\"]")
      .forEach((element) => new bootstrap.Tooltip(element, { trigger: "hover focus" }));
  }
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }
  if (!event.data || event.data.type !== "emergencyPreview") {
    return;
  }
  document.body.classList.add("preview-mode");
  const settings = normalizePreviewSettings(event.data.payload);
  applySettings(
    settings.mode,
    settings.message,
    settings.backgroundMode,
    settings.backgroundUrl,
    settings.backgroundFit,
    settings.cardOpacity
  );
});