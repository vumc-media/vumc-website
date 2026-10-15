
 // Community Pulse: public research and VUMC audience context.

(function () {
  const topicInput = document.getElementById('pulse-topic');
  const rangeInput = document.getElementById('pulse-range');
  const launch = document.getElementById('pulse-research-button');

  if (!topicInput || !rangeInput || !launch) return;

  const research = () => {
    const topic = topicInput.value.trim();

    if (!topic) {
      topicInput.focus();
      return;
    }

    const params = new URLSearchParams({
      date: rangeInput.value,
      geo: 'US-KY',
      q: topic
    });

    window.open(
      'https://trends.google.com/trends/explore?' + params.toString(),
      '_blank',
      'noopener,noreferrer'
    );
  };

  launch.addEventListener('click', research);

  topicInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') research();
  });

  document.querySelectorAll('#pulse-suggestions [data-topic]')
    .forEach(button => {
      button.addEventListener('click', () => {
        topicInput.value = button.dataset.topic;
        research();
      });
    });
})();

function updateCommunityPulse(videos) {
  const target = document.getElementById('pulse-channel-themes');

  if (!target) return;

  target.replaceChildren();

  if (!Array.isArray(videos) || !videos.length) {
    target.textContent =
      'No worship-video data available for the selected reporting period.';
    return;
  }

  const groups = new Map();

  for (const v of videos) {
    const name = typeof cleanSermonTitle === 'function'
      ? cleanSermonTitle(v.title)
      : v.title;

    const key = typeof sermonKey === 'function'
      ? sermonKey(v.title)
      : name.toLowerCase();

    if (!groups.has(key)) {
      groups.set(key, {
        name,
        views: 0,
        count: 0
      });
    }

    const group = groups.get(key);

    group.views += Number(v.metrics?.views) || 0;
    group.count++;
  }

  const ranked = [...groups.values()]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  for (const group of ranked) {
    const item = document.createElement('div');
    item.className = 'pulse-theme';

    const name = document.createElement('span');
    name.textContent = group.name;

    const value = document.createElement('strong');
    value.textContent =
      group.views.toLocaleString('en-US') + ' views';

    item.append(name, value);
    target.append(item);
  }
}
