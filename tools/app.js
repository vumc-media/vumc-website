const GAS_URL = "https://script.google.com/macros/s/AKfycbzHpOIjWgX-jiOMGwiCBrONrmym-9kMJDOQ4DA15re8d-_MUidnpXbIGCZYTqM_gAJV/exec";
const SESSION_KEY = "vumc_staff_token";

const authScreen = document.getElementById("authScreen");
const staffPortal = document.getElementById("staffPortal");
const loginForm = document.getElementById("loginForm");
const passkeyInput = document.getElementById("passkeyInput");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const signedInUser = document.getElementById("signedInUser");
const authMessage = document.getElementById("authMessage");

document
  .querySelectorAll(".tool-card.disabled")
  .forEach(card => {
    card.addEventListener("click", event => {
      event.preventDefault();
    });
  });

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

const FORM_TIMEOUT_MS = 45000;
const pendingGasRequests = new Map();
let gasTransportFrame = null;

function ensureGasTransportFrame() {
  if (gasTransportFrame) return gasTransportFrame;

  gasTransportFrame = document.createElement("iframe");
  gasTransportFrame.name = "vumcGasTransport";
  gasTransportFrame.title = "VUMC Staff Tools Transport";
  gasTransportFrame.setAttribute("aria-hidden", "true");

  Object.assign(gasTransportFrame.style, {
    position: "fixed",
    left: "-10000px",
    top: "-10000px",
    width: "1px",
    height: "1px",
    border: "0",
    opacity: "0",
    pointerEvents: "none"
  });

  document.body.appendChild(gasTransportFrame);
  return gasTransportFrame;
}

function makeGasRequestId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function postToGas(values) {
  ensureGasTransportFrame();

  const action = String(values.action || "");
  const payload = { ...values };
  delete payload.action;

  const requestId = makeGasRequestId();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingGasRequests.delete(requestId);
      reject(new Error("The Staff Tools request timed out."));
    }, FORM_TIMEOUT_MS);

    pendingGasRequests.set(requestId, { resolve, reject, timeout });

    const form = document.createElement("form");
    form.method = "POST";
    form.action = GAS_URL;
    form.target = gasTransportFrame.name;
    form.style.display = "none";

    const fields = {
      requestId,
      action,
      payload: JSON.stringify(payload)
    };

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    form.remove();
  });
}

window.addEventListener("message", event => {
  const message = event.data;

  if (!message || message.type !== "vumc-gas-form-response") return;

  if (
    gasTransportFrame &&
    event.source !== gasTransportFrame.contentWindow
  ) {
    return;
  }

  const pending = pendingGasRequests.get(message.requestId);
  if (!pending) return;

  clearTimeout(pending.timeout);
  pendingGasRequests.delete(message.requestId);
  pending.resolve(message.result || {
    success: false,
    error: "The Staff Tools service returned no result."
  });
});

async function refreshSession() {
  const token = sessionStorage.getItem(SESSION_KEY);

  if (!token) {
    showSignedOutState();
    return;
  }

  try {
    const data = await postToGas({
      action: "verifyStaffSession",
      token
    });

    if (data.success === true) {
      showSignedInState();
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      showSignedOutState();
    }
  } catch (error) {
    console.error("Session verification error:", error);
    showSignedOutState();
    showAuthMessage(
      "Unable to verify the staff session. Please try again.",
      true
    );
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
    const data = await postToGas({
      action: "staffLogin",
      passkey
    });

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

  logoutButton.disabled = true;
  logoutButton.textContent = "Signing out…";

  try {
    if (token) {
      await postToGas({
        action: "staffLogout",
        token
      });
    }
  } catch (error) {
    console.error("Sign-out request failed:", error);
  }

  sessionStorage.removeItem(SESSION_KEY);
  logoutButton.disabled = false;
  logoutButton.textContent = "Sign out";
  showSignedOutState();
});

ensureGasTransportFrame();
refreshSession();
