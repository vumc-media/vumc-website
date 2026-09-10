const GAS_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbzHpOIjWgX-jiOMGwiCBrONrmym-9kMJDOQ4DA15re8d-_MUidnpXbIGCZYTqM_gAJV/exec?bridge=1";

const SESSION_KEY = "vumc_staff_token";
const BRIDGE_KEY = "vumc-staff-tools-v2";
const BRIDGE_TIMEOUT_MS = 30000;

const authScreen = document.getElementById("authScreen");
const staffPortal = document.getElementById("staffPortal");
const loginForm = document.getElementById("loginForm");
const passkeyInput = document.getElementById("passkeyInput");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const signedInUser = document.getElementById("signedInUser");
const authMessage = document.getElementById("authMessage");

let bridgeFrame = null;
let bridgeReady = false;
let bridgeReadyResolve = null;
let bridgeReadyReject = null;
let bridgeReadyTimer = null;

const pendingBridgeRequests = new Map();

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

function createBridgeFrame() {
  if (bridgeFrame) return bridgeFrame;

  bridgeFrame = document.createElement("iframe");
  bridgeFrame.src = GAS_BRIDGE_URL;
  bridgeFrame.title = "VUMC Staff Tools Bridge";
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
    bridgeReadyReject = reject;

    clearTimeout(bridgeReadyTimer);

    bridgeReadyTimer = setTimeout(() => {
      bridgeReadyReject = null;
      bridgeReadyResolve = null;
      reject(
        new Error(
          "The Staff Tools service did not finish loading."
        )
      );
    }, BRIDGE_TIMEOUT_MS);
  });
}

function markBridgeReady() {
  bridgeReady = true;

  clearTimeout(bridgeReadyTimer);

  if (bridgeReadyResolve) {
    bridgeReadyResolve();
  }

  bridgeReadyResolve = null;
  bridgeReadyReject = null;
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
          "The Staff Tools request timed out."
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

  // Do not hard-require event.source or event.origin.
  // Apps Script can wrap/sandbox the iframe in ways that make those checks brittle.
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
      error: "The Staff Tools service returned no response."
    }
  );
});

async function refreshSession() {
  const token = sessionStorage.getItem(SESSION_KEY);

  if (!token) {
    showSignedOutState();
    return;
  }

  try {
    const data = await bridgeRequest(
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
    const data = await bridgeRequest(
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
      error.message ||
        "The Staff Tools service could not be reached.",
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
      await bridgeRequest("staffLogout", { token });
    }
  } catch (error) {
    console.error("Sign-out request failed:", error);
  }

  sessionStorage.removeItem(SESSION_KEY);
  logoutButton.disabled = false;
  logoutButton.textContent = "Sign out";
  showSignedOutState();
});

document
  .querySelectorAll(".tool-card.disabled")
  .forEach(card => {
    card.addEventListener("click", event => {
      event.preventDefault();
    });
  });

createBridgeFrame();
refreshSession();
