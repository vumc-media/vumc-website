const SUPABASE_URL =
  "https://cnreuxodfrnpyyrbtlmp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_bzCz7_E6sZTSZOdPpMvc5w_3OdUSndO";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const loadingScreen =
  document.getElementById("loadingScreen");

const app =
  document.getElementById("app");

const signedInUser =
  document.getElementById("signedInUser");

const logoutButton =
  document.getElementById("logoutButton");

const titleInput =
  document.getElementById("title");

const bodyInput =
  document.getElementById("body");

const audienceSelect =
  document.getElementById("audience");

const audienceWrap =
  document.getElementById("audienceWrap");

const sendEmailCheckbox =
  document.getElementById("sendEmail");

const postFacebookCheckbox =
  document.getElementById("postFacebook");

const publishButton =
  document.getElementById("publishButton");

const clearButton =
  document.getElementById("clearButton");

const previewTitle =
  document.getElementById("previewTitle");

const previewBody =
  document.getElementById("previewBody");

const configBox =
  document.getElementById("configBox");

const statusBox =
  document.getElementById("status");

let currentUser = null;
let defaultAudience = "All VUMC Contacts Group";

function updatePreview() {
  previewTitle.textContent =
    titleInput.value.trim() ||
    "Your announcement title";

  previewBody.textContent =
    bodyInput.value.trim() ||
    "Your announcement message will appear here.";
}

function updateAudienceVisibility() {
  audienceWrap.hidden =
    !sendEmailCheckbox.checked;
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

  publishButton.textContent =
    isBusy ? "Publishing…" : "Publish";
}

async function invokeRelay(action, payload = {}) {
  const {
    data,
    error
  } = await supabaseClient.functions.invoke(
    "communications-relay",
    {
      body: {
        action,
        ...payload
      }
    }
  );

  if (error) {
    throw new Error(
      error.message ||
      "The Communications service could not be reached."
    );
  }

  if (!data || data.success === false) {
    throw new Error(
      data?.error ||
      "The Communications service returned an error."
    );
  }

  return data;
}

async function loadConfiguration() {
  const data = await invokeRelay("getConfig");

  defaultAudience =
    data.defaultAudience ||
    "All VUMC Contacts Group";

  configBox.textContent =
    `Email: ${data.emailConfigured ? "ready" : "not configured"} · ` +
    `Facebook: ${data.facebookConfigured ? "configured" : "not configured"}`;
}

async function loadAudiences() {
  const data = await invokeRelay("getGroups");

  const groups = Array.isArray(data.groups)
    ? data.groups
    : [];

  audienceSelect.innerHTML = "";

  if (!groups.length) {
    const option =
      document.createElement("option");

    option.value = "";
    option.textContent =
      "No Google Contacts labels found";

    audienceSelect.appendChild(option);
    return;
  }

  groups.forEach(group => {
    const option =
      document.createElement("option");

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

async function initializeApp() {
  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

  if (error || !session?.user) {
    window.location.replace("../");
    return;
  }

  currentUser = session.user;

  signedInUser.textContent =
    currentUser.email || "Authorized staff";

  loadingScreen.hidden = true;
  app.hidden = false;

  try {
    await loadConfiguration();
    await loadAudiences();
  } catch (error) {
    console.error(error);

    configBox.textContent =
      "The Communications backend is not connected yet.";

    setStatus(
      error.message,
      "error"
    );
  }
}

async function publishAnnouncement() {
  clearStatus();

  const title =
    titleInput.value.trim();

  const body =
    bodyInput.value.trim();

  const audience =
    audienceSelect.value;

  const sendEmail =
    sendEmailCheckbox.checked;

  const postFacebook =
    postFacebookCheckbox.checked;

  if (!title) {
    setStatus(
      "Add an announcement title.",
      "error"
    );

    titleInput.focus();
    return;
  }

  if (!body) {
    setStatus(
      "Add an announcement message.",
      "error"
    );

    bodyInput.focus();
    return;
  }

  if (!sendEmail && !postFacebook) {
    setStatus(
      "Choose Email, Facebook, or both.",
      "error"
    );

    return;
  }

  if (sendEmail && !audience) {
    setStatus(
      "Choose an email audience.",
      "error"
    );

    return;
  }

  setBusy(true);

  try {
    const data = await invokeRelay(
      "publish",
      {
        payload: {
          title,
          body,
          audience,
          sendEmail,
          postFacebook
        }
      }
    );

    const completed = [];

    if (data.result?.email?.success) {
      completed.push(
        `email sent to ${data.result.email.recipients} contacts`
      );
    }

    if (data.result?.facebook?.success) {
      completed.push("Facebook posted");
    }

    if (data.result?.archive?.success) {
      completed.push("archived");
    }

    setStatus(
      completed.length
        ? `Success: ${completed.join(", ")}.`
        : "Announcement completed.",
      "success"
    );
  } catch (error) {
    console.error(error);

    setStatus(
      error.message ||
      "The announcement could not be published.",
      "error"
    );
  } finally {
    setBusy(false);
  }
}

function clearForm() {
  titleInput.value = "";
  bodyInput.value = "";

  sendEmailCheckbox.checked = false;
  postFacebookCheckbox.checked = true;

  updateAudienceVisibility();
  updatePreview();
  clearStatus();

  titleInput.focus();
}

titleInput.addEventListener(
  "input",
  updatePreview
);

bodyInput.addEventListener(
  "input",
  updatePreview
);

sendEmailCheckbox.addEventListener(
  "change",
  updateAudienceVisibility
);

publishButton.addEventListener(
  "click",
  publishAnnouncement
);

clearButton.addEventListener(
  "click",
  clearForm
);

logoutButton.addEventListener(
  "click",
  async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("../");
  }
);

supabaseClient.auth.onAuthStateChange(
  (_event, session) => {
    if (!session?.user) {
      window.location.replace("../");
    }
  }
);

updatePreview();
updateAudienceVisibility();
initializeApp();
