/* =========================================================
   VUMC STAFF TOOLS
   No login/authentication gate.
========================================================= */

/* Prevent disabled / coming-soon cards from navigating. */
document
  .querySelectorAll('.tool-card.disabled')
  .forEach((card) => {
    card.addEventListener('click', (event) => {
      event.preventDefault();
    });
  });

console.log('VUMC Staff Tools app loaded.');
