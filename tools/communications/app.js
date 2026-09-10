const RELAY_URL =
  "https://cnreuxodfrnpyyrbtlmp.supabase.co/functions/v1/communications-relay";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_bzCz7_E6sZTSZOdPpMvc5w_3OdUSndO";

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

async function relay(action, payload = {}) {
  const response = await fetch(RELAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action, payload }),
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("The Communications service returned an invalid response.");
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.error || `Communications request failed (${response.status}).`
    );
  }

  return data;
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
  imageInput.disabled = isBusy;
  publishButton.textContent = isBusy ? "Publishing…" : "Publish";
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
        base64: result.slice(commaIndex + 1),
      });
    };

    reader.onerror = () =>
      reject(new Error(`The image "${file.name}" could not be read.`));

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
    preview.alt = image.name || `Selected image ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-image-button";
    removeButton.textContent = `Remove image ${index + 1}`;

    removeButton.addEventListener("click", () => {
      const removed = selectedImages[index];

      if (removed?.previewUrl) {
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
    setStatus(`You may select up to ${MAX_IMAGES} images.`, "error");
    return;
  }

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      imageInput.value = "";
      setStatus(`"${file.name}" is not a JPG, PNG, or WebP image.`, "error");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      imageInput.value = "";
      setStatus(`"${file.name}" must be smaller than 8 MB.`, "error");
      return;
    }
  }

  try {
    const prepared = [];

    for (const file of files) {
      const imageData = await readImageFile(file);

      prepared.push({
        ...imageData,
        previewUrl: URL.createObjectURL(file),
      });
    }

    selectedImages = [...selectedImages, ...prepared];
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

async function loadConfiguration() {
  const data = await relay("getConfig");

  defaultAudience =
    data.defaultAudience || "All VUMC Contacts Group";

  configBox.textContent =
    `Email: ${data.emailConfigured ? "ready" : "not configured"} · ` +
    `Facebook: ${data.facebookConfigured ? "configured" : "not configured"}`;
}

async function loadAudiences() {
  audienceSelect.innerHTML =
    `<option value="">Loading Google Contacts labels…</option>`;

  const data = await relay("getGroups");
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
  try {
    if (signedInUser) {
      signedInUser.textContent = "Staff Tool";
    }

    if (logoutButton) {
      logoutButton.hidden = true;
    }

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
      error.message || "The Communications Hub could not finish loading.",
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
      base64: image.base64,
    }));

    const data = await relay(
      "publish",
      {
        announcement: {
          title,
          body,
          linkUrl,
          images,
          audience,
          sendEmail,
          postFacebook,
        },
      }
    );

    const completed = [];

    if (data.result?.email?.success) {
      completed.push(`email sent to ${data.result.email.recipients} contacts`);
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

  selectedImages.forEach(image => {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
  });

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

initializeApp();
