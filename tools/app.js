document
  .querySelectorAll(".tool-card.disabled")
  .forEach(card => {
    card.addEventListener("click", event => {
      event.preventDefault();
    });
  });
