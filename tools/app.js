const SUPABASE_URL =
  "https://cnreuxodfrnpyyrbtlmp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_bzCz7_E6sZTSZOdPpMvc5w_3OdUSndO";

/*
 * Paste the deployed Google Apps Script URL ending in /exec.
 */
const COMMUNICATIONS_APP_URL =
  "PASTE_YOUR_GOOGLE_APPS_SCRIPT_EXEC_URL_HERE";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const authScreen = document.getElementById("authScreen");
const staffPortal = document.getElementById("staffPortal");
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const signedInUser = document.getElementById("signedInUser");
const authMessage = document.getElementById("authMessage");
const communicationsLink =
  document.getElementById("communicationsLink");

communicationsLink.href = COMMUNICATIONS_APP_URL;

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
  signedInUser.textContent = "";
}

function showSignedInState(user) {
  authScreen.hidden = true;
  staffPortal.hidden = false;
  logoutButton.hidden = false;
  signedInUser.hidden = false;
  signedInUser.textContent = user.email || "Signed in";
}

async function refreshSession() {
  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error(error);
    showSignedOutState();
    showAuthMessage(
      "Unable to verify your sign-in session.",
      true
    );
    return;
  }

  if (session?.user) {
    showSignedInState(session.user);
  } else {
    showSignedOutState();
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearAuthMessage();

  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    showAuthMessage("Enter your email address.", true);
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Sending…";

  const { error } =
    await supabaseClient.auth.signInWithOtp({
      email,

      options: {
        emailRedirectTo:
          "https://versaillesumc.org/tools/",

        /*
         * Prevents random visitors from creating new accounts.
         * The user must already exist in Supabase Authentication.
         */
        shouldCreateUser: false
      }
    });

  loginButton.disabled = false;
  loginButton.textContent = "Send sign-in link";

  if (error) {
    console.error(error);

    showAuthMessage(
      "This email is not approved for Staff Tools, or the sign-in request could not be completed.",
      true
    );

    return;
  }

  showAuthMessage(
    "Check your email for the secure Staff Tools sign-in link."
  );
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  const { error } =
    await supabaseClient.auth.signOut();

  logoutButton.disabled = false;

  if (error) {
    console.error(error);
    return;
  }

  showSignedOutState();
});

supabaseClient.auth.onAuthStateChange(
  (_event, session) => {
    if (session?.user) {
      showSignedInState(session.user);
    } else {
      showSignedOutState();
    }
  }
);

refreshSession();
