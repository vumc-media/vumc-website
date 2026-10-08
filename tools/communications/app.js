
"use strict";

/* VUMC Communications Hub */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzHpOIjWgX-jiOMGwiCBrONrmym-9kMJDOQ4DA15re8d-_MUidnpXbIGCZYTqM_gAJV/exec";

const BRIDGE_URL = GAS_URL + "?bridge=1";
const REQUEST_TIMEOUT = 90000;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = [
  "image/jpeg", "image/png", "image/webp"
];

let defaultAudience = "All VUMC Contacts Group";
let selectedImages = [];
let publishingEnabled = false;
let busy = false;

/* ---------- Bridge connection ---------- */

let bridgeFrame = null;
let bridgeWindow = null;
let bridgeOrigin = null;
let readyResolve;
let readyReject;
let readyTimer;

const pendingRequests = new Map();

const bridgeReady = new Promise((resolve, reject) => {
  readyResolve = resolve;
  readyReject = reject;
});

function isGoogleOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (
      url.hostname === "script.google.com" ||
      url.hostname === "script.googleusercontent.com" ||
      url.hostname.endsWith(".googleusercontent.com")
    );
  } catch (_) {
    return false;
  }
}

window.addEventListener("message", event => {
  if (!isGoogleOrigin(event.origin)) return;

  const message = event.data;
  if (!message || typeof message !== "object") return;

  if (message.type === "vumc-bridge-ready") {
    if (!bridgeFrame || !event.source) return;

    bridgeWindow = event.source;
    bridgeOrigin = event.origin;

    clearTimeout(readyTimer);
    readyResolve();
    return;
  }

  if (message.type !== "vumc-bridge-response") return;

  if (
    event.source !== bridgeWindow ||
    event.origin !== bridgeOrigin
  ) return;

  const id = String(message.requestId || "");
  const pending = pendingRequests.get(id);
  if (!pending) return;

  pendingRequests.delete(id);
  clearTimeout(pending.timer);

  pending.resolve(message.result || {
    success: false,
    error: "No result returned by Communications."
  });
});

function startBridge() {
  if (bridgeFrame) return;

  bridgeFrame = document.createElement("iframe");
  bridgeFrame.title = "Communications connection";
  bridgeFrame.setAttribute("aria-hidden", "true");

  bridgeFrame.style.cssText = [
    "position:absolute",
    "width:1px",
    "height:1px",
    "border:0",
    "opacity:0",
    "pointer-events:none",
    "left:-9999px"
  ].join(";");

  readyTimer = setTimeout(() => {
    readyReject(new Error(
      "The Google Apps Script bridge did not connect."
    ));
  }, 20000);

  bridgeFrame.src = BRIDGE_URL;
  document.body.appendChild(bridgeFrame);
}

function requestId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return Date.now().toString(36) +
    "-" + Math.random().toString(36).slice(2);
}

async function gasRequest(action, payload = {}) {
  startBridge();
  await bridgeReady;

  if (!bridgeWindow || !bridgeOrigin) {
    throw new Error("Communications bridge unavailable.");
  }

  const id = requestId();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(
        "Communications request timed out. Check whether the announcement was sent before trying again."
      ));
    }, REQUEST_TIMEOUT);

    pendingRequests.set(id, { resolve, reject, timer });

    try {
      bridgeWindow.postMessage({
        type: "vumc-bridge-request",
        requestId: id,
        action,
        payload
      }, bridgeOrigin);
    } catch (error) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(error);
    }
  });
}

async function communicationsRequest(action, payload = {}) {
  const result = await gasRequest(action, payload);

  if (!result || result.success === false) {
    throw new Error(
      result?.error || "Communications request failed."
    );
  }

  return result;
}

/* ---------- Page elements ---------- */

const el = id => document.getElementById(id);

const loadingScreen = el("loadingScreen");
const app = el("app");
const titleInput = el("title");
const bodyInput = el("body");
const linkUrlInput = el("linkUrl");
const imageInput = el("imageInput");
const imagePreviewWrap = el("imagePreviewWrap");
const audienceSelect = el("audience");
const audienceWrap = el("audienceWrap");
const sendEmailCheckbox = el("sendEmail");
const postFacebookCheckbox = el("postFacebook");
const publishButton = el("publishButton");
const clearButton = el("clearButton");
const previewTitle = el("previewTitle");
const previewBody = el("previewBody");
const configBox = el("configBox");
const statusBox = el("status");

/* ---------- Status and preview ---------- */

function setStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = "status " + type;
  statusBox.hidden = false;
}

function clearStatus() {
  statusBox.textContent = "";
  statusBox.className = "status";
  statusBox.hidden = true;
}

function updatePreview() {
  previewTitle.textContent =
    titleInput.value.trim() || "Your announcement title";

  previewBody.textContent = [
    bodyInput.value.trim(),
    linkUrlInput.value.trim()
  ].filter(Boolean).join("\n\n") ||
    "Your announcement message will appear here.";
}

function updateAudienceVisibility() {
  audienceWrap.hidden = !sendEmailCheckbox.checked;
}

function setBusy(value) {
  busy = value;
  publishButton.disabled = busy || !publishingEnabled;
  clearButton.disabled = busy;
  imageInput.disabled = busy;

  publishButton.textContent =
    busy ? "Publishing…" : "Publish";
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid protocol");
    }
    return url.href;
  } catch (_) {
    throw new Error(
      "The optional link must begin with http:// or https://."
    );
  }
}

/* ---------- Images ---------- */

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || "");
      const comma = text.indexOf(",");

      if (comma < 0) {
        reject(new Error(
          `The image "${file.name}" could not be read.`
        ));
        return;
      }

      resolve({
        name: file.name || "announcement-image",
        mimeType: file.type,
        base64: text.slice(comma + 1)
      });
    };

    reader.onerror = () => reject(new Error(
      `The image "${file.name}" could not be read.`
    ));

    reader.readAsDataURL(file);
  });
}

function renderImagePreviews() {
  imagePreviewWrap.innerHTML = "";

  if (!selectedImages.length) {
    imagePreviewWrap.hidden = true;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "image-preview-grid";

  selectedImages.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = "image-preview-item";

    const preview = document.createElement("img");
    preview.className = "image-preview";
    preview.src = image.previewUrl;
    preview.alt = image.name || `Image ${index + 1}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-image-button";
    remove.textContent = `Remove image ${index + 1}`;

    remove.addEventListener("click", () => {
      URL.revokeObjectURL(image.previewUrl);
      selectedImages.splice(index, 1);
      renderImagePreviews();
    });

    item.append(preview, remove);
    grid.appendChild(item);
  });

  imagePreviewWrap.appendChild(grid);
  imagePreviewWrap.hidden = false;
}

async function handleImageSelection() {
  clearStatus();

  const files = Array.from(imageInput.files || []);
  if (!files.length) return;

  if (selectedImages.length + files.length > MAX_IMAGES) {
    imageInput.value = "";
    setStatus(
      `You may select up to ${MAX_IMAGES} images.`,
      "error"
    );
    return;
  }

  for (const file of files) {
    if (!IMAGE_TYPES.includes(file.type)) {
      imageInput.value = "";
      setStatus(
        `"${file.name}" is not a JPG, PNG, or WebP image.`,
        "error"
      );
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      imageInput.value = "";
      setStatus(
        `"${file.name}" must be smaller than 8 MB.`,
        "error"
      );
      return;
    }
  }

  const prepared = [];

  try {
    for (const file of files) {
      const data = await readImageFile(file);

      prepared.push({
        ...data,
        previewUrl: URL.createObjectURL(file)
      });
    }

    selectedImages.push(...prepared);
    renderImagePreviews();

  } catch (error) {
    prepared.forEach(image => {
      URL.revokeObjectURL(image.previewUrl);
    });
    setStatus(error.message, "error");

  } finally {
    imageInput.value = "";
  }
}

/* ---------- Configuration ---------- */

async function loadConfiguration() {
  const data = await communicationsRequest("getConfig");

  // Publishing is protected by the staff password
  // and the server-side pinPublish function.
  publishingEnabled = true;

  defaultAudience =
    data.defaultAudience || "All VUMC Contacts Group";

  let facebookText = data.facebookConfigured
    ? "checking…"
    : "not configured";

  if (data.facebookConfigured) {
    try {
      const facebook =
        await communicationsRequest("testFacebook");

      facebookText = facebook.connected
        ? `connected (${facebook.pageName || "Page"})`
        : `connection failed — ${facebook.error || "Unknown error"}`;
    } catch (error) {
      facebookText = `connection failed — ${error.message}`;
    }
  }

  configBox.textContent =
    `Publishing: staff password required · Email: ${
      data.emailConfigured ? "ready" : "not configured"
    } · Facebook: ${facebookText}`;
}

/* ---------- Google Contacts ---------- */

async function loadAudiences() {
  audienceSelect.innerHTML =
    '<option value="">Loading Google Contacts labels…</option>';

  const data = await communicationsRequest("getGroups");
  const groups = Array.isArray(data.groups) ? data.groups : [];

  audienceSelect.innerHTML = "";

  if (!groups.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No Google Contacts labels found";
    audienceSelect.appendChild(option);
    return;
  }

  groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.name;

    option.textContent = group.count
      ? `${group.name} (${group.count})`
      : group.name;

    if (group.name === defaultAudience) {
      option.selected = true;
    }

    audienceSelect.appendChild(option);
  });
}

/* ---------- Publishing ---------- */

async function publishAnnouncement() {
  clearStatus();

  if (busy || !publishingEnabled) return;

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const audience = audienceSelect.value;
  const sendEmail = sendEmailCheckbox.checked;
  const postFacebook = postFacebookCheckbox.checked;

  let linkUrl;

  try {
    linkUrl = normalizeUrl(linkUrlInput.value);
  } catch (error) {
    setStatus(error.message, "error");
    linkUrlInput.focus();
    return;
  }

  if (!title) {
    setStatus("Add an announcement title.", "error");
    titleInput.focus();
    return;
  }

  if (!body) {
    setStatus("Add an announcement message.", "error");
    bodyInput.focus();
    return;
  }

  if (!sendEmail && !postFacebook) {
    setStatus("Choose Email, Facebook, or both.", "error");
    return;
  }

  if (sendEmail && !audience) {
    setStatus("Choose an email audience.", "error");
    return;
  }

  /*
   * Ask for the password only when publishing.
   * Cancel leaves the announcement untouched.
   */
  const pin = window.prompt(
    "Enter your VUMC staff password to publish:"
  );

  if (pin === null) return;

  if (pin.length < 6 || pin.length > 64) {
    setStatus(
      "Staff password must contain 6 to 64 characters.",
      "error"
    );
    return;
  }

  const destinations = [
    sendEmail ? "Email" : "",
    postFacebook ? "Facebook" : ""
  ].filter(Boolean).join(" and ");

  const confirmed = window.confirm(
    `Publish "${title}" to ${destinations}?` +
    (sendEmail ? `\nAudience: ${audience}` : "")
  );

  if (!confirmed) return;

  setBusy(true);

  try {
    const images = selectedImages.map(image => ({
      name: image.name,
      mimeType: image.mimeType,
      base64: image.base64
    }));

    const data = await communicationsRequest("publish", {
      pin,
      announcement: {
        title,
        body,
        linkUrl,
        images,
        audience,
        sendEmail,
        postFacebook
      }
    });

    const completed = [];

    if (data.result?.email?.success) {
      completed.push(
        `email sent to ${data.result.email.recipients} contacts`
      );
    }

    if (data.result?.facebook?.success) {
      completed.push("Facebook post published");
    }

    setStatus(
      completed.length
        ? `Success: ${completed.join(" · ")}.`
        : "Announcement completed."
    );

  } catch (error) {
    console.error("Publish error:", error);
    setStatus(
      error.message ||
      "The announcement could not be published.",
      "error"
    );

  } finally {
    setBusy(false);
  }
}

/* ---------- Clear form ---------- */

function clearComposer() {
  if (busy) return;

  titleInput.value = "";
  bodyInput.value = "";
  linkUrlInput.value = "";

  sendEmailCheckbox.checked = false;
  postFacebookCheckbox.checked = true;

  selectedImages.forEach(image => {
    URL.revokeObjectURL(image.previewUrl);
  });

  selectedImages = [];
  imageInput.value = "";

  renderImagePreviews();
  updateAudienceVisibility();
  updatePreview();
  clearStatus();
}

/* ---------- Initialization ---------- */

async function initializeApp() {
  loadingScreen.hidden = true;
  app.hidden = false;

  updateAudienceVisibility();
  updatePreview();
  renderImagePreviews();

  publishButton.disabled = true;
  publishButton.title =
    "Connecting to Communications backend.";

  try {
    await loadConfiguration();
    await loadAudiences();

    publishButton.disabled = !publishingEnabled;
    publishButton.title = publishingEnabled
      ? "Publish with staff password"
      : "Publishing unavailable.";

  } catch (error) {
    console.error("Initialization error:", error);

    publishingEnabled = false;

    configBox.textContent =
      "The Communications backend could not be reached.";

    setStatus(
      error.message ||
      "The Communications Hub could not finish loading.",
      "error"
    );
  }
}

/* ---------- Events ---------- */

titleInput.addEventListener("input", updatePreview);
bodyInput.addEventListener("input", updatePreview);
linkUrlInput.addEventListener("input", updatePreview);

sendEmailCheckbox.addEventListener(
  "change",
  updateAudienceVisibility
);

imageInput.addEventListener(
  "change",
  handleImageSelection
);

publishButton.addEventListener(
  "click",
  publishAnnouncement
);

clearButton.addEventListener(
  "click",
  clearComposer
);

initializeApp();
