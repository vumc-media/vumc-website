const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzHpOIjWgX-jiOMGwiCBrONrmym-9kMJDOQ4DA15re8d-_MUidnpXbIGCZYTqM_gAJV/exec";

const SESSION_KEY = "vumc_staff_token";
const FORM_TIMEOUT_MS = 45000;
const POLL_INTERVAL_MS = 500;


/* =========================================================
   REQUEST HELPERS
========================================================= */

function makeRequestId() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}


/* =========================================================
   HIDDEN POST TO GAS
========================================================= */

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
    requestId: requestId,
    action: action,
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


/* =========================================================
   JSONP RESPONSE POLLING
========================================================= */

function jsonpPoll(requestId) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "__vumcJsonp_" +
      requestId.replace(/[^A-Za-z0-9_$]/g, "_");


    const script = document.createElement("script");


    function cleanup() {
      try {
        delete window[callbackName];
      } catch (error) {
        // Ignore cleanup errors.
      }

      if (script.parentNode) {
        script.remove();
      }
    }


    window[callbackName] = function (data) {
      cleanup();
      resolve(data);
    };


    script.onerror = function () {
      cleanup();

      reject(
        new Error(
          "Could not read the Staff Tools response."
        )
      );
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


/* =========================================================
   GAS REQUEST
========================================================= */

async function gasRequest(
  action,
  payload = {},
  timeoutMs = FORM_TIMEOUT_MS
) {
  const requestId = makeRequestId();

  submitHiddenPost(
    action,
    payload,
    requestId
  );


  const started = Date.now();


  while (Date.now() - started < timeoutMs) {
    await new Promise(resolve =>
      setTimeout(resolve, POLL_INTERVAL_MS)
    );


    const envelope =
      await jsonpPoll(requestId);


    if (envelope && envelope.ready) {
      return (
        envelope.result || {
          success: false,
          error: "No result returned."
        }
      );
    }
  }


  throw new Error(
    "The Staff Tools request timed out."
  );
}


/* =========================================================
   PAGE ELEMENTS
========================================================= */

const authScreen =
  document.getElementById("authScreen");

const staffPortal =
  document.getElementById("staffPortal");

const loginForm =
  document.getElementById("loginForm");

const passkeyInput =
  document.getElementById("passkeyInput");

const loginButton =
  document.getElementById("loginButton");

const logoutButton =
  document.getElementById("logoutButton");

const signedInUser =
  document.getElementById("signedInUser");

const authMessage =
  document.getElementById("authMessage");


/* =========================================================
   AUTH MESSAGE
========================================================= */

function showAuthMessage(
  message,
  isError = false
) {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = message;
  authMessage.hidden = false;

  authMessage.classList.toggle(
    "error",
    isError
  );
}


function clearAuthMessage() {
  if (!authMessage) {
    return;
  }

  authMessage.hidden = true;
  authMessage.textContent = "";

  authMessage.classList.remove("error");
}


/* =========================================================
   SIGNED OUT STATE
========================================================= */

function showSignedOutState() {
  console.log(
    "Staff Tools: showing signed-out state"
  );


  if (authScreen) {
    authScreen.hidden = false;
    authScreen.style.display = "";
  }


  if (staffPortal) {
    staffPortal.hidden = true;
    staffPortal.style.display = "none";
  }


  if (logoutButton) {
    logoutButton.hidden = true;
    logoutButton.style.display = "none";
  }


  if (signedInUser) {
    signedInUser.hidden = true;
    signedInUser.style.display = "none";
  }
}


/* =========================================================
   SIGNED IN STATE
========================================================= */

function showSignedInState() {
  console.log(
    "Staff Tools: showing signed-in portal"
  );


  /*
   * Completely remove the login screen
   * from the visible page.
   */

  if (authScreen) {
    authScreen.hidden = true;
    authScreen.style.display = "none";
  }


  /*
   * Explicitly reveal the Staff Tools portal.
   */

  if (staffPortal) {
    staffPortal.hidden = false;
    staffPortal.style.removeProperty("display");
  }


  /*
   * Show authenticated header controls.
   */

  if (logoutButton) {
    logoutButton.hidden = false;
    logoutButton.style.removeProperty("display");
  }


  if (signedInUser) {
    signedInUser.hidden = false;
    signedInUser.style.removeProperty("display");

    signedInUser.textContent =
      "Authorized staff";
  }


  /*
   * Clear passkey only after GAS
   * has successfully authenticated.
   */

  if (passkeyInput) {
    passkeyInput.value = "";
    passkeyInput.type = "password";
  }


  clearAuthMessage();


  /*
   * Return user to top of dashboard.
   */

  window.scrollTo(0, 0);
}


/* =========================================================
   SESSION VERIFICATION
========================================================= */

async function refreshSession() {
  const token =
    sessionStorage.getItem(SESSION_KEY);


  if (!token) {
    showSignedOutState();
    return;
  }


  try {
    console.log(
      "Staff Tools: verifying existing session"
    );


    const data = await gasRequest(
      "verifyStaffSession",
      {
        token: token
      }
    );


    console.log(
      "Staff Tools session response:",
      data
    );


    if (data && data.success === true) {
      showSignedInState();
      return;
    }


    sessionStorage.removeItem(
      SESSION_KEY
    );

    showSignedOutState();

  } catch (error) {
    console.error(
      "Session verification error:",
      error
    );


    sessionStorage.removeItem(
      SESSION_KEY
    );

    showSignedOutState();
  }
}


/* =========================================================
   LOGIN
========================================================= */

if (loginForm) {
  loginForm.addEventListener(
    "submit",
    async function (event) {
      event.preventDefault();

      clearAuthMessage();


      const passkey =
        passkeyInput
          ? passkeyInput.value.trim()
          : "";


      if (!passkey) {
        showAuthMessage(
          "Enter the staff passkey.",
          true
        );


        if (passkeyInput) {
          passkeyInput.focus();
        }

        return;
      }


      if (loginButton) {
        loginButton.disabled = true;

        loginButton.textContent =
          "Checking…";
      }


      try {
        console.log(
          "Staff Tools: submitting login"
        );


        const data = await gasRequest(
          "staffLogin",
          {
            passkey: passkey
          }
        );


        console.log(
          "Staff Tools login response:",
          data
        );


        if (
          !data ||
          data.success !== true ||
          !data.token
        ) {
          showAuthMessage(
            (data && data.error) ||
              "The staff passkey was not accepted.",
            true
          );


          if (passkeyInput) {
            passkeyInput.select();
          }

          return;
        }


        /*
         * Authentication succeeded.
         */

        sessionStorage.setItem(
          SESSION_KEY,
          data.token
        );


        console.log(
          "Staff Tools: login successful"
        );


        showSignedInState();

      } catch (error) {
        console.error(
          "Staff Tools sign-in error:",
          error
        );


        showAuthMessage(
          error.message ||
            "The Staff Tools service could not be reached.",
          true
        );

      } finally {
        if (loginButton) {
          loginButton.disabled = false;

          loginButton.textContent =
            "Enter Staff Tools";
        }
      }
    }
  );
}


/* =========================================================
   LOGOUT
========================================================= */

if (logoutButton) {
  logoutButton.addEventListener(
    "click",
    async function () {
      const token =
        sessionStorage.getItem(
          SESSION_KEY
        );


      /*
       * Immediately clear local session
       * and return to login.
       */

      sessionStorage.removeItem(
        SESSION_KEY
      );


      showSignedOutState();


      /*
       * Tell GAS to invalidate the token.
       */

      if (token) {
        try {
          await gasRequest(
            "staffLogout",
            {
              token: token
            }
          );
        } catch (error) {
          console.error(
            "Sign-out request failed:",
            error
          );
        }
      }
    }
  );
}


/* =========================================================
   DISABLED TOOL CARDS
========================================================= */

document
  .querySelectorAll(
    ".tool-card.disabled"
  )
  .forEach(card => {
    card.addEventListener(
      "click",
      function (event) {
        event.preventDefault();
      }
    );
  });


/* =========================================================
   INITIALIZE STAFF TOOLS
========================================================= */

console.log(
  "VUMC Staff Tools app loaded."
);

refreshSession();
