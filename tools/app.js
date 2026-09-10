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

async function postToGas(values) {
  const body = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    body.set(key, String(value ?? ""));
  });

  const response = await fetch(GAS_URL, {
    method: "POST",
    body
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    console.error("Invalid GAS response:", text);
    throw new Error("The Staff Tools service returned an invalid response.");
  }

  return data;
}

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

refreshSession();
