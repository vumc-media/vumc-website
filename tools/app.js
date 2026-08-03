document.querySelectorAll('.disabled').forEach(card => {
  card.addEventListener('click', event => event.preventDefault());
});
