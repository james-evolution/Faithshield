const MODE_KEY = "emergencyMode";
const MESSAGE_KEY = "customEmergencyMessage";
const BG_MODE_KEY = "emergencyBackgroundMode";
const BG_URL_KEY = "emergencyBackgroundUrl";
const BG_FIT_KEY = "emergencyBackgroundFit";
const CARD_OPACITY_KEY = "emergencyCardOpacity";
const AUDIO_MODE_KEY = "emergencyAudioMode";
const AUDIO_URL_KEY = "emergencyAudioUrl";
const DEFAULT_MESSAGE = "Take a moment to pause and choose a better path.";
const DEFAULT_BG_MODE = "default";
const DEFAULT_BG_URL = "https://images.unsplash.com/photo-1485470733090-0aae1788d5af?q=80&w=1217&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
const DEFAULT_BG_FIT = "cover";
const DEFAULT_CARD_OPACITY = 40;
const DEFAULT_AUDIO_MODE = "default";
const DEFAULT_AUDIO_URL = "https://soundcloud.com/danielmp3-music/gods-creation";
const DEFAULT_AUDIO_EMBED = "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A1308570070&color=%23597db5&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true";

const defaultMessage = document.getElementById("default-message");
const customMessage = document.getElementById("custom-message");
const customText = document.getElementById("custom-text");
const soundcloudPlayer = document.getElementById("soundcloud-player");

function buildSoundcloudEmbedUrl(trackUrl) {
  const baseUrl = "https://w.soundcloud.com/player/";
  const params = new URLSearchParams({
    url: trackUrl,
    color: "#597db5",
    auto_play: "false",
    hide_related: "false",
    show_comments: "true",
    show_user: "true",
    show_reposts: "false",
    show_teaser: "true",
    visual: "true",
  });
  return `${baseUrl}?${params.toString()}`;
}

function getEmergencySettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        MODE_KEY,
        MESSAGE_KEY,
        BG_MODE_KEY,
        BG_URL_KEY,
        BG_FIT_KEY,
        CARD_OPACITY_KEY,
        AUDIO_MODE_KEY,
        AUDIO_URL_KEY,
      ],
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
        audioMode:
          typeof data[AUDIO_MODE_KEY] === "string" ? data[AUDIO_MODE_KEY] : DEFAULT_AUDIO_MODE,
        audioUrl: typeof data[AUDIO_URL_KEY] === "string" ? data[AUDIO_URL_KEY] : DEFAULT_AUDIO_URL,
      });
      }
    );
  });
}

function applySettings(
  mode,
  message,
  backgroundMode,
  backgroundUrl,
  backgroundFit,
  cardOpacity,
  audioMode,
  audioUrl
) {
  const useCustom = mode === "custom";
  defaultMessage.hidden = useCustom;
  customMessage.hidden = !useCustom;
  if (useCustom) {
    customText.textContent = message || DEFAULT_MESSAGE;
  }

  if (backgroundMode === "custom" && backgroundUrl) {
    document.body.style.backgroundImage = `url("${backgroundUrl}")`;
  } else {
    document.body.style.backgroundImage = `url("${DEFAULT_BG_URL}")`;
  }
  document.body.style.backgroundSize = backgroundFit || DEFAULT_BG_FIT;
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";

  const resolvedOpacity = Number.isFinite(cardOpacity) ? cardOpacity : DEFAULT_CARD_OPACITY;
  document.documentElement.style.setProperty("--card-alpha", String(resolvedOpacity / 100));

  if (soundcloudPlayer) {
    if (audioMode === "custom" && audioUrl) {
      soundcloudPlayer.src = buildSoundcloudEmbedUrl(audioUrl);
    } else {
      soundcloudPlayer.src = DEFAULT_AUDIO_EMBED;
    }
  }
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
    audioMode:
      typeof payload?.audioMode === "string" ? payload.audioMode : DEFAULT_AUDIO_MODE,
    audioUrl: typeof payload?.audioUrl === "string" ? payload.audioUrl : DEFAULT_AUDIO_URL,
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.self !== window.top) {
    document.body.classList.add("preview-mode");
  }
  const { mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity, audioMode, audioUrl } =
    await getEmergencySettings();
  applySettings(mode, message, backgroundMode, backgroundUrl, backgroundFit, cardOpacity, audioMode, audioUrl);
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
    settings.cardOpacity,
    settings.audioMode,
    settings.audioUrl
  );
});