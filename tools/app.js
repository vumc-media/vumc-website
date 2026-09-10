const GAS_URL = "https://script.google.com/macros/s/AKfycbzHpOIjWgX-jiOMGwiCBrONrmym-9kMJDOQ4DA15re8d-_MUidnpXbIGCZYTqM_gAJV/exec";
const SESSION_KEY = "vumc_staff_token";
const FORM_TIMEOUT_MS = 45000;
const POLL_INTERVAL_MS = 500;

function makeRequestId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function submitHiddenPost(action, payload, requestId) {
  let frame = document.getElementById("vumcGasPostFrame");

  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = "vumcGasPostFrame";
    frame.name = "vumcGasPostFrame";
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, {
      position: "fixed",
      left: "-10000px",
      top: "-10000px",
      width: "1px",
      height: "1px",
      border: "0",
      opacity: "0",
      pointerEvents: "none"
    });
    document.body.appendChild(frame);
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = GAS_URL;
  form.target = frame.name;
  form.style.display = "none";

  const fields = {
    requestId,
    action,
    payload: JSON.stringify(payload || {})
  };

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

function jsonpPoll(requestId) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "__vumcJsonp_" +
      requestId.replace(/[^A-Za-z0-9_$]/g, "_");

    const script = document.createElement("script");
    const cleanup = () => {
      try { delete window[callbackName]; } catch (e) {}
      script.remove();
    };

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not read the Staff Tools response."));
    };

    const url = new URL(GAS_URL);
    url.searchParams.set("api", "1");
    url.searchParams.set("requestId", requestId);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("_", String(Date.now()));

    script.src = url.toString();
    document.head.appendChild(script);
  });
}

async function gasRequest(action, payload = {}, timeoutMs = FORM_TIMEOUT_MS) {
  const requestId = makeRequestId();
  submitHiddenPost(action, payload, requestId);

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    const envelope = await jsonpPoll(requestId);

    if (envelope && envelope.ready) {
      return envelope.result || {
        success: false,
        error: "No result returned."
      };
    }
  }

  throw new Error("The Staff Tools request timed out.");
}

const authScreen = document.getElementById("authScreen");
const staffPortal = document.getElementById("staffPortal");
const loginForm = document.getElementById("loginForm");
const passkeyInput = document.getElementById("passkeyInput");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const signedInUser = document.getElementById("signedInUser");
const authMessage = document.getElementById("authMessage");

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.hidden = false;
  authMessage.classList.toggle("error", isError);
}

function clearAuthMessage() {
  authMessage.hidden = true;
  authMessage.textContent = "";
  authMessage.classList.remove("error");
}

function showSignedOutState() {
  authScreen.hidden = false;
  staffPortal.hidden = true;
  logoutButton.hidden = true;
  signedInUser.hidden = true;
}

function showSignedInState() {
  authScreen.hidden = true;
  staffPortal.hidden = false;
  logoutButton.hidden = false;
  signedInUser.hidden = false;
  signedInUser.textContent = "Authorized staff";
  passkeyInput.value = "";
  clearAuthMessage();
}

async function refreshSession() {
  const token = sessionStorage.getItem(SESSION_KEY);

  if (!token) {
    showSignedOutState();
    return;
  }

  try {
    const data = await gasRequest(
      "verifyStaffSession",
      { token }
    );

    if (data.success === true) {
      showSignedInState();
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      showSignedOutState();
    }
  } catch (error) {
    console.error("Session verification error:", error);
    sessionStorage.removeItem(SESSION_KEY);
    showSignedOutState();
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearAuthMessage();

  const passkey = passkeyInput.value;

  if (!passkey) {
    showAuthMessage("Enter the staff passkey.", true);
    passkeyInput.focus();
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Checking…";

  try {
    const data = await gasRequest(
      "staffLogin",
      { passkey }
    );

    if (!data.success || !data.token) {
      showAuthMessage(
        data.error || "The staff passkey was not accepted.",
        true
      );
      passkeyInput.select();
      return;
    }

    sessionStorage.setItem(SESSION_KEY, data.token);
    showSignedInState();

  } catch (error) {
    console.error("Sign-in error:", error);
    showAuthMessage(
      error.message || "The Staff Tools service could not be reached.",
      true
    );
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Enter Staff Tools";
  }
});

logoutButton.addEventListener("click", async () => {
  const token = sessionStorage.getItem(SESSION_KEY);

  try {
    if (token) {
      await gasRequest("staffLogout", { token });
    }
  } catch (error) {
    console.error("Sign-out request failed:", error);
  }

  sessionStorage.removeItem(SESSION_KEY);
  showSignedOutState();
});

document.querySelectorAll(".tool-card.disabled").forEach(card => {
  card.addEventListener("click", event => event.preventDefault());
});

refreshSession();
