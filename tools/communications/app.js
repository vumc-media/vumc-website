const GAS_URL = "https://script.google.com/macros/s/AKfycbzHpOIjWgX-jiOMGwiCBrONrmym-9kMJDOQ4DA15re8d-_MUidnpXbIGCZYTqM_gAJV/exec";
const SESSION_KEY = "vumc_staff_token";

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

function updatePreview() {
  previewTitle.textContent =
    titleInput.value.trim() || "Your announcement title";

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
  } catch {
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
        reject(new Error(`The image "${file.name}" could not be read.`));
        return;
      }

      resolve({
        name: file.name || "announcement-image",
        mimeType: file.type,
        base64: result.slice(commaIndex + 1)
      });
    };

    reader.onerror = () => {
      reject(new Error(`The image "${file.name}" could not be read.`));
    };

    reader.readAsDataURL(file);
  });
}

function revokeImagePreviewUrls() {
  selectedImages.forEach(image => {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
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
    preview.alt = image.name || `Selected image ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-image-button";
    removeButton.textContent = `Remove image ${index + 1}`;
    removeButton.addEventListener("click", () => {
      removeSelectedImage(index);
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
    setStatus(`You may select up to ${MAX_IMAGES} images.`, "error");
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
      setStatus(`"${file.name}" must be smaller than 8 MB.`, "error");
      return;
    }
  }

  try {
    const preparedImages = [];

    for (const file of files) {
      const imageData = await readImageFile(file);

      preparedImages.push({
        ...imageData,
        previewUrl: URL.createObjectURL(file)
      });
    }

    selectedImages = [...selectedImages, ...preparedImages];
    imageInput.value = "";
    renderImagePreviews();
  } catch (error) {
    imageInput.value = "";
    setStatus(
      error.message || "One or more images could not be prepared.",
      "error"
    );
  }
}

function removeSelectedImage(index) {
  const image = selectedImages[index];

  if (image && image.previewUrl) {
    URL.revokeObjectURL(image.previewUrl);
  }

  selectedImages.splice(index, 1);
  renderImagePreviews();
}

function removeAllSelectedImages() {
  revokeImagePreviewUrls();
  selectedImages = [];
  imageInput.value = "";
  renderImagePreviews();
}

async function gasPost(action, extra = {}) {
  const token = sessionStorage.getItem(SESSION_KEY);
  const form = new URLSearchParams();

  form.set("action", action);

  if (token) {
    form.set("token", token);
  }

  Object.entries(extra).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    form.set(
      key,
      typeof value === "string" ? value : JSON.stringify(value)
    );
  });

  const response = await fetch(GAS_URL, {
    method: "POST",
    body: form
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    console.error("Invalid GAS response:", text);
    throw new Error(
      "The Communications service returned an invalid response."
    );
  }

  if (data.success === false) {
    if (data.authRequired) {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.replace("../");
      throw new Error("Your Staff Tools session has expired.");
    }

    throw new Error(
      data.error || "The Communications service returned an error."
    );
  }

  return data;
}

async function loadConfiguration() {
  const data = await gasPost("getConfig");

  defaultAudience =
    data.defaultAudience || "All VUMC Contacts Group";

  configBox.textContent =
    `Email: ${data.emailConfigured ? "ready" : "not configured"} · ` +
    `Facebook: ${data.facebookConfigured ? "configured" : "not configured"}`;
}

async function loadAudiences() {
  audienceSelect.innerHTML =
    `<option value="">Loading Google Contacts labels…</option>`;

  const data = await gasPost("getGroups");
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
    option.textContent =
      group.count ? `${group.name} (${group.count})` : group.name;

    if (group.name === defaultAudience) option.selected = true;

    audienceSelect.appendChild(option);
  });
}

async function initializeApp() {
  const token = sessionStorage.getItem(SESSION_KEY);

  if (!token) {
    window.location.replace("../");
    return;
  }

  try {
    const auth = await gasPost("verifyStaffSession");

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
      "The Communications backend is not connected yet.";

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

    const data = await gasPost("publish", {
      payload: {
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

    if (data.result?.archive?.success) {
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
      error.message || "The announcement could not be published.",
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

  removeAllSelectedImages();
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
  const token = sessionStorage.getItem(SESSION_KEY);

  try {
    if (token) {
      await gasPost("staffLogout");
    }
  } catch (error) {
    console.error("Logout request failed:", error);
  }

  sessionStorage.removeItem(SESSION_KEY);
  window.location.replace("../");
});

initializeApp();
