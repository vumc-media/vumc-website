const SUPABASE_URL =
  "https://cnreuxodfrnpyyrbtlmp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_bzCz7_E6sZTSZOdPpMvc5w_3OdUSndO";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const authScreen =
  document.getElementById("authScreen");

const staffPortal =
  document.getElementById("staffPortal");

const loginForm =
  document.getElementById("loginForm");

const emailInput =
  document.getElementById("emailInput");

const passwordInput =
  document.getElementById("passwordInput");

const loginButton =
  document.getElementById("loginButton");

const logoutButton =
  document.getElementById("logoutButton");

const signedInUser =
  document.getElementById("signedInUser");

const authMessage =
  document.getElementById("authMessage");

document
  .querySelectorAll(".tool-card.disabled")
  .forEach(card => {
    card.addEventListener("click", event => {
      event.preventDefault();
    });
  });

function showAuthMessage(
  message,
  isError = false
) {
  authMessage.textContent = message;
  authMessage.hidden = false;

  authMessage.classList.toggle(
    "error",
    isError
  );
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
  signedInUser.textContent = "";
}

function showSignedInState(user) {
  authScreen.hidden = true;
  staffPortal.hidden = false;

  logoutButton.hidden = false;
  signedInUser.hidden = false;

  signedInUser.textContent =
    user.email ||
    "Authorized staff member";

  passwordInput.value = "";
  clearAuthMessage();
}

async function refreshSession() {
  const {
    data: { session },
    error
  } =
    await supabaseClient.auth.getSession();

  if (error) {
    console.error(
      "Session error:",
      error
    );

    showSignedOutState();

    showAuthMessage(
      error.message ||
      "Unable to verify your sign-in session.",
      true
    );

    return;
  }

  if (
    session &&
    session.user
  ) {
    showSignedInState(
      session.user
    );
  } else {
    showSignedOutState();
  }
}

loginForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    clearAuthMessage();

    const email =
      emailInput.value
        .trim()
        .toLowerCase();

    const password =
      passwordInput.value;

    if (!email) {
      showAuthMessage(
        "Enter your email address.",
        true
      );

      emailInput.focus();
      return;
    }

    if (!password) {
      showAuthMessage(
        "Enter your password.",
        true
      );

      passwordInput.focus();
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent =
      "Signing in…";

    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });

    loginButton.disabled = false;
    loginButton.textContent =
      "Sign in";

    if (error) {
      console.error(
        "Sign-in error:",
        error
      );

      showAuthMessage(
        error.message ||
        "The email or password was not accepted.",
        true
      );

      return;
    }

    if (
      !data ||
      !data.user
    ) {
      showAuthMessage(
        "The email or password was not accepted.",
        true
      );

      return;
    }

    showSignedInState(
      data.user
    );
  }
);

logoutButton.addEventListener(
  "click",
  async () => {
    logoutButton.disabled = true;
    logoutButton.textContent =
      "Signing out…";

    const { error } =
      await supabaseClient.auth.signOut();

    logoutButton.disabled = false;
    logoutButton.textContent =
      "Sign out";

    if (error) {
      console.error(
        "Sign-out error:",
        error
      );

      return;
    }

    showSignedOutState();
  }
);

supabaseClient.auth.onAuthStateChange(
  (_event, session) => {
    if (
      session &&
      session.user
    ) {
      showSignedInState(
        session.user
      );
    } else {
      showSignedOutState();
    }
  }
);

refreshSession();
