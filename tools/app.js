/* =========================================================
   ATRIUM AUTHORIZED HANDOFF
========================================================= */

const ATRIUM_MANAGER_URL =
  "https://canvaslides.netlify.app/manager";

document
  .querySelectorAll(
    'a[href*="canvaslides.netlify.app/manager"]'
  )
  .forEach(card => {
    card.addEventListener(
      "click",
      async function (event) {
        event.preventDefault();

        const token =
          sessionStorage.getItem(
            SESSION_KEY
          );

        if (!token) {
          showSignedOutState();

          showAuthMessage(
            "Your Staff Tools session has expired. Please sign in again.",
            true
          );

          return;
        }

        const originalCursor =
          card.style.cursor;

        card.style.pointerEvents =
          "none";

        card.style.cursor =
          "wait";

        try {
          const data =
            await gasRequest(
              "createAtriumHandoff",
              {
                token: token
              }
            );

          if (
            !data ||
            data.success !== true ||
            !data.code
          ) {
            if (
              data &&
              data.authRequired
            ) {
              sessionStorage.removeItem(
                SESSION_KEY
              );

              showSignedOutState();
            }

            throw new Error(
              (data && data.error) ||
              "Atrium authorization could not be created."
            );
          }

          const url =
            new URL(
              ATRIUM_MANAGER_URL
            );

          url.searchParams.set(
            "handoff",
            data.code
          );

          window.open(
            url.toString(),
            "_blank",
            "noopener"
          );

        } catch (error) {
          console.error(
            "Atrium handoff error:",
            error
          );

          showAuthMessage(
            error.message ||
              "Atrium Manager could not be opened.",
            true
          );

        } finally {
          card.style.pointerEvents =
            "";

          card.style.cursor =
            originalCursor;
        }
      }
    );
  });
