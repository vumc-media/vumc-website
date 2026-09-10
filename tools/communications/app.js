const GAS_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbzHpOIjWgX-jiOMGwiCBrONrmym-9kMJDOQ4DA15re8d-_MUidnpXbIGCZYTqM_gAJV/exec?bridge=1";

const SESSION_KEY = "vumc_staff_token";
const BRIDGE_KEY = "vumc-staff-tools-v2";
const BRIDGE_TIMEOUT_MS = 45000;

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const loadingScreen = document.getElementById("loadingScreen");
const app = document.getElementById("app");
const signedInUser = document.getElementById("signedInUser");
const logoutButton = document.getElementById("logoutButton");
const titleInput = document.getElementById("title");
const bodyInput = document.getElementById("body");
const linkUrlInput = document.getElementById("linkUrl");
const imageInput = document.getElementById("imageInput");
const imagePreviewWrap = document.getElementById("imagePreviewWrap");
const audienceSelect = document.getElementById("audience");
const audienceWrap = document.getElementById("audienceWrap");
const sendEmailCheckbox = document.getElementById("sendEmail");
const postFacebookCheckbox = document.getElementById("postFacebook");
const publishButton = document.getElementById("publishButton");
const clearButton = document.getElementById("clearButton");
const previewTitle = document.getElementById("previewTitle");
const previewBody = document.getElementById("previewBody");
const configBox = document.getElementById("configBox");
const statusBox = document.getElementById("status");

let defaultAudience = "All VUMC Contacts Group";
let selectedImages = [];
let bridgeFrame = null;
let bridgeReady = false;
let bridgeReadyResolve = null;
let bridgeReadyTimer = null;

const pendingBridgeRequests = new Map();

function createBridgeFrame() {
  if (bridgeFrame) return bridgeFrame;

  bridgeFrame = document.createElement("iframe");
  bridgeFrame.src = GAS_BRIDGE_URL;
  bridgeFrame.title = "VUMC Communications Bridge";
  bridgeFrame.setAttribute("aria-hidden", "true");

  Object.assign(bridgeFrame.style, {
    position: "fixed",
    left: "-9999px",
    top: "-9999px",
    width: "1px",
    height: "1px",
    border: "0",
    opacity: "0",
    pointerEvents: "none"
  });

  document.body.appendChild(bridgeFrame);
  return bridgeFrame;
}

function waitForBridge() {
  if (bridgeReady) return Promise.resolve();

  createBridgeFrame();

  return new Promise((resolve, reject) => {
    bridgeReadyResolve = resolve;

    clearTimeout(bridgeReadyTimer);

    bridgeReadyTimer = setTimeout(() => {
      bridgeReadyResolve = null;
      reject(
        new Error(
          "The Communications service did not finish loading."
        )
      );
    }, BRIDGE_TIMEOUT_MS);
  });
}

function markBridgeReady() {
  bridgeReady = true;
  clearTimeout(bridgeReadyTimer);

  if (bridgeReadyResolve) bridgeReadyResolve();
  bridgeReadyResolve = null;
}

function makeRequestId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}

async function bridgeRequest(action, payload = {}) {
  await waitForBridge();

  const requestId = makeRequestId();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingBridgeRequests.delete(requestId);
      reject(
        new Error(
          "The Communications request timed out."
        )
      );
    }, BRIDGE_TIMEOUT_MS);

    pendingBridgeRequests.set(requestId, {
      resolve,
      reject,
      timeout
    });

    bridgeFrame.contentWindow.postMessage(
      {
        type: "vumc-bridge-request",
        bridgeKey: BRIDGE_KEY,
        requestId,
        action,
        payload
      },
      "*"
    );
  });
}

window.addEventListener("message", event => {
  const message = event.data;

  if (!message || typeof message !== "object") return;

  if (message.type === "vumc-bridge-ready") {
    markBridgeReady();
    return;
  }

  if (message.type !== "vumc-bridge-response") return;

  const pending = pendingBridgeRequests.get(message.requestId);
  if (!pending) return;

  clearTimeout(pending.timeout);
  pendingBridgeRequests.delete(message.requestId);
  pending.resolve(
    message.result || {
      success: false,
      error: "The Communications service returned no response."
    }
  );
});

function getToken() {
  return sessionStorage.getItem(SESSION_KEY);
}

async function protectedRequest(action, payload = {}) {
  const token = getToken();

  if (!token) {
    window.location.replace("../");
    throw new Error("Staff authorization required.");
  }

  const result = await bridgeRequest(
    action,
    {
      ...payload,
      token
    }
  );

  if (result && result.authRequired) {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace("../");
    throw new Error(
      result.error || "Your Staff Tools session has expired."
    );
  }

  if (!result || result.success === false) {
    throw new Error(
      result && result.error
        ? result.error
        : "The Communications request failed."
    );
  }

  return result;
}

function updatePreview() {
  previewTitle.textContent =
    titleInput.value.trim() ||
    "Your announcement title";

  const body = bodyInput.value.trim();
  const link = linkUrlInput.value.trim();

  previewBody.textContent =
    [body, link].filter(Boolean).join("\n\n") ||
    "Your announcement message will appear here.";
}

function updateAudienceVisibility() {
  audienceWrap.hidden = !sendEmailCheckbox.checked;
}

function setStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
  statusBox.hidden = false;
}

function clearStatus() {
  statusBox.textContent = "";
  statusBox.className = "status";
  statusBox.hidden = true;
}

function setBusy(isBusy) {
  publishButton.disabled = isBusy;
  clearButton.disabled = isBusy;
  logoutButton.disabled = isBusy;
  imageInput.disabled = isBusy;
  publishButton.textContent =
    isBusy ? "Publishing…" : "Publish";
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }

    return url.href;
  } catch (error) {
    throw new Error(
      "The optional link must begin with http:// or https://."
    );
  }
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");

      if (commaIndex === -1) {
        reject(
          new Error(
            `The image "${file.name}" could not be read.`
          )
        );
        return;
      }

      resolve({
        name: file.name || "announcement-image",
        mimeType: file.type,
        base64: result.slice(commaIndex + 1)
      });
    };

    reader.onerror = () => {
      reject(
        new Error(
          `The image "${file.name}" could not be read.`
        )
      );
    };

    reader.readAsDataURL(file);
  });
}

function revokeImagePreviewUrls() {
  selectedImages.forEach(image => {
    if (image.previewUrl) {
      URL.revokeObjectURL(image.previewUrl);
    }
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
    preview.alt =
      image.name || `Selected image ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-image-button";
    removeButton.textContent =
      `Remove image ${index + 1}`;

    removeButton.addEventListener("click", () => {
      const removed = selectedImages[index];
      if (removed && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      selectedImages.splice(index, 1);
      renderImagePreviews();
    });

    item.appendChild(preview);
    item.appendChild(removeButton);
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
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
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

  try {
    const prepared = [];

    for (const file of files) {
      const imageData = await readImageFile(file);

      prepared.push({
        ...imageData,
        previewUrl: URL.createObjectURL(file)
      });
    }

    selectedImages = [
      ...selectedImages,
      ...prepared
    ];

    imageInput.value = "";
    renderImagePreviews();
  } catch (error) {
    imageInput.value = "";
    setStatus(
      error.message ||
        "One or more images could not be prepared.",
      "error"
    );
  }
}

async function loadConfiguration() {
  const data = await protectedRequest("getConfig");

  defaultAudience =
    data.defaultAudience ||
    "All VUMC Contacts Group";

  configBox.textContent =
    `Email: ${data.emailConfigured ? "ready" : "not configured"} · ` +
    `Facebook: ${data.facebookConfigured ? "configured" : "not configured"}`;
}

async function loadAudiences() {
  audienceSelect.innerHTML =
    `<option value="">Loading Google Contacts labels…</option>`;

  const data = await protectedRequest("getGroups");

  const groups =
    Array.isArray(data.groups)
      ? data.groups
      : [];

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
    option.textContent =
      group.count
        ? `${group.name} (${group.count})`
        : group.name;

    if (group.name === defaultAudience) {
      option.selected = true;
    }

    audienceSelect.appendChild(option);
  });
}

async function initializeApp() {
  const token = getToken();

  if (!token) {
    window.location.replace("../");
    return;
  }

  try {
    const auth = await bridgeRequest(
      "verifyStaffSession",
      { token }
    );

    if (auth.success !== true) {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.replace("../");
      return;
    }

    signedInUser.textContent = "Authorized staff";
    loadingScreen.hidden = true;
    app.hidden = false;

    updateAudienceVisibility();
    updatePreview();
    renderImagePreviews();

    await loadConfiguration();
    await loadAudiences();
  } catch (error) {
    console.error("Initialization error:", error);
    loadingScreen.hidden = true;
    app.hidden = false;
    configBox.textContent =
      "The Communications backend could not be reached.";

    setStatus(
      error.message ||
        "The Communications Hub could not finish loading.",
      "error"
    );
  }
}

async function publishAnnouncement() {
  clearStatus();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  let linkUrl = "";

  try {
    linkUrl = normalizeUrl(linkUrlInput.value);
  } catch (error) {
    setStatus(error.message, "error");
    linkUrlInput.focus();
    return;
  }

  const audience = audienceSelect.value;
  const sendEmail = sendEmailCheckbox.checked;
  const postFacebook = postFacebookCheckbox.checked;

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

  setBusy(true);

  try {
    const images = selectedImages.map(image => ({
      name: image.name,
      mimeType: image.mimeType,
      base64: image.base64
    }));

    const data = await protectedRequest(
      "publish",
      {
        announcement: {
          title,
          body,
          linkUrl,
          images,
          audience,
          sendEmail,
          postFacebook
        }
      }
    );

    const completed = [];

    if (data.result && data.result.email && data.result.email.success) {
      completed.push(
        `email sent to ${data.result.email.recipients} contacts`
      );
    }

    if (data.result && data.result.facebook && data.result.facebook.success) {
      completed.push("Facebook post published");
    }

    if (data.result && data.result.archive && data.result.archive.success) {
      completed.push("announcement archived");
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

function clearComposer() {
  titleInput.value = "";
  bodyInput.value = "";
  linkUrlInput.value = "";
  sendEmailCheckbox.checked = false;
  postFacebookCheckbox.checked = true;

  revokeImagePreviewUrls();
  selectedImages = [];
  imageInput.value = "";
  renderImagePreviews();

  updateAudienceVisibility();
  updatePreview();
  clearStatus();
}

titleInput.addEventListener("input", updatePreview);
bodyInput.addEventListener("input", updatePreview);
linkUrlInput.addEventListener("input", updatePreview);
sendEmailCheckbox.addEventListener("change", updateAudienceVisibility);
imageInput.addEventListener("change", handleImageSelection);
publishButton.addEventListener("click", publishAnnouncement);
clearButton.addEventListener("click", clearComposer);

logoutButton.addEventListener("click", async () => {
  const token = getToken();

  try {
    if (token) {
      await bridgeRequest("staffLogout", { token });
    }
  } catch (error) {
    console.error("Logout request failed:", error);
  }

  sessionStorage.removeItem(SESSION_KEY);
  window.location.replace("../");
});

createBridgeFrame();
initializeApp();
