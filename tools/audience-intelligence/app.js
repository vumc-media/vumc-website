
// VUMC Audience Intelligence
// Public dashboard JavaScript.
// Never place Google credentials, OAuth secrets, or tokens here.

const API = 'https://holy-star-1faevumc-youtube-analytics.versaillesumcworshipteam.workers.dev';

const $ = id => document.getElementById(id);
const format = value => Number(value).toLocaleString('en-US');
const safeNumber = value =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

function dates(days) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function message(value, kind = '') {
  $('status').textContent = value;
  $('status').className = 'notice ' + kind;
}

function clearReport() {
  for (const id of ['gained', 'lost', 'net', 'views', 'watch']) {
    $(id).textContent = '—';
  }

  $('chart').replaceChildren();
  $('chart').textContent =
    'Connect YouTube to display verified subscriber activity.';

  $('chart-start').textContent = '';
  $('chart-end').textContent = '';
}

async function getJSON(path) {
  const response = await fetch(API + path, {
    credentials: 'include',
    cache: 'no-store'
  });

  let data = {};

  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    const error = new Error(
      data.message || data.error || `Request returned ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

// ---------------------------------------------------------
// SUBSCRIBER RHYTHM
// ---------------------------------------------------------

function drawChart(rows, start, end) {
  const chart = $('chart');
  chart.replaceChildren();

  $('chart-start').textContent = start;
  $('chart-end').textContent = end;

  if (!rows.length) {
    chart.textContent =
      'No subscriber changes were reported during this period.';
    return;
  }

  const max = Math.max(
    1,
    ...rows.flatMap(row => [
      safeNumber(row[1]),
      safeNumber(row[2])
    ])
  );

  const bars = document.createElement('div');
  bars.className = 'bars';

  for (const row of rows) {
    const day = document.createElement('div');
    day.className = 'chart-day';

    const gained = safeNumber(row[1]);
    const lost = safeNumber(row[2]);

    day.title = `${row[0]} • Gained ${gained}, lost ${lost}`;
    day.setAttribute('aria-label', day.title);

    for (const [value, type] of [
      [gained, 'gain'],
      [lost, 'loss']
    ]) {
      const bar = document.createElement('div');
      bar.className = 'chart-bar ' + type;

      bar.style.height = value
        ? `${Math.max(3, (value / max) * 100)}%`
        : '0';

      day.appendChild(bar);
    }

    bars.appendChild(day);
  }

  chart.appendChild(bars);
}

// ---------------------------------------------------------
// CONTENT PERFORMANCE
// ---------------------------------------------------------

let contentRecords = [];
let requestId = 0;

function normalizeTheme(title) {
  return (title || 'Untitled')
    .toLowerCase()
    .replace(/^acts:\s*the church that changed the world\s*[|—–-]\s*/i, '')
    .replace(/^week\s*\d+\s*[-—–:]?\s*/i, '')
    .replace(/^oct\.?\s*\d+\s*[-—–:]\s*/i, '')
    .replace(/\s*[|—–]\s*acts\s*\d+.*$/i, '')
    .replace(/\s*\(acts\s*\d+.*$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isWorship(video) {
  const title = (video.title || '').toLowerCase();

  // Exclude upcoming broadcasts.
  if (
    video.liveBroadcastContent === 'upcoming' ||
    video.duration === 'P0D'
  ) {
    return false;
  }

  // Exclude funeral services and unrelated special events.
  if (
    /celebration of life|memorial service|funeral|anniversary worship event|silver voices/.test(title)
  ) {
    return false;
  }

  // Generic titles cannot reliably identify sermon themes.
  if (title === 'versailles umc live') {
    return false;
  }

  return true;
}

function classifyContent(video, allVideos) {
  if (video.serviceType !== 'Unclassified') {
    return video.serviceType;
  }

  const theme = normalizeTheme(video.title);

  const companions = allVideos.filter(other =>
    other.id !== video.id &&
    normalizeTheme(other.title) === theme
  );

  const types = new Set(
    companions
      .map(other => other.serviceType)
      .filter(type => type !== 'Unclassified')
  );

  // When two recordings share a sermon title and one is
  // explicitly Traditional, infer the other as Contemporary.
  if (
    companions.length === 1 &&
    types.size === 1 &&
    types.has('Traditional')
  ) {
    return 'Contemporary';
  }

  return 'Unclassified';
}

function createElement(tag, className = '', textValue) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (textValue !== undefined) {
    element.textContent = textValue;
  }

  return element;
}

function showContent() {
  const filter = $('content-filter').value;

  const videos = contentRecords.filter(video =>
    filter === 'All' ||
    video.inferredType === filter
  );

  const totalViews = videos.reduce(
    (total, video) =>
      total + safeNumber(video.metrics?.views),
    0
  );

  const totalMinutes = videos.reduce(
    (total, video) =>
      total + safeNumber(video.metrics?.watchMinutes),
    0
  );

  $('content-count').textContent = format(videos.length);
  $('content-views').textContent = format(totalViews);

  $('content-hours').textContent =
    (totalMinutes / 60).toLocaleString('en-US', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1
    });

  // Group worship recordings by sermon theme.
  const groups = new Map();

  for (const video of videos) {
    const key = normalizeTheme(video.title);

    if (!groups.has(key)) {
      groups.set(key, {
        title: video.title,
        views: 0,
        watchMinutes: 0,
        count: 0
      });
    }

    const group = groups.get(key);

    group.views += safeNumber(video.metrics?.views);
    group.watchMinutes += safeNumber(video.metrics?.watchMinutes);
    group.count++;
  }

  const themes = [...groups.values()]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const themeContainer = $('content-themes');
  themeContainer.replaceChildren();

  if (!themes.length) {
    themeContainer.textContent =
      'No worship videos matched this selection.';
  }

  themes.forEach((theme, index) => {
    const row = createElement('div', 'theme-row');

    const rank = createElement(
      'span',
      'theme-rank',
      String(index + 1)
    );

    const name = createElement(
      'span',
      'theme-name',
      theme.title
    );

    const value = createElement(
      'span',
      'theme-value',
      `${format(theme.views)} views · ${theme.count} video${theme.count === 1 ? '' : 's'}`
    );

    row.append(rank, name, value);
    themeContainer.appendChild(row);
  });

  // Individual worship video cards.
  const videoContainer = $('content-videos');
  videoContainer.replaceChildren();

  const rankedVideos = [...videos]
    .sort(
      (a, b) =>
        safeNumber(b.metrics?.views) -
        safeNumber(a.metrics?.views)
    )
    .slice(0, 30);

  for (const video of rankedVideos) {
    const card = createElement('a', 'video-card');

    card.href =
      'https://www.youtube.com/watch?v=' +
      encodeURIComponent(video.id);

    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    if (video.thumbnail) {
      const image = createElement('img', 'video-thumb');
      image.src = video.thumbnail;
      image.alt = '';
      image.loading = 'lazy';
      card.appendChild(image);
    }

    const info = createElement('div', 'video-info');

    info.appendChild(
      createElement('strong', '', video.title)
    );

    const inferred =
      video.inferredType !== video.serviceType
        ? ' (inferred)'
        : '';

    const date = new Date(
      video.publishedAt
    ).toLocaleDateString();

    info.appendChild(
      createElement(
        'span',
        'video-meta',
        `${video.inferredType}${inferred} · ${date}`
      )
    );

    const views = safeNumber(video.metrics?.views);
    const hours =
      safeNumber(video.metrics?.watchMinutes) / 60;

    info.appendChild(
      createElement(
        'span',
        'video-stats',
        `${format(views)} views · ${hours.toFixed(1)} watch hours`
      )
    );

    card.appendChild(info);
    videoContainer.appendChild(card);
  }
}

function clearContent(messageText) {
  contentRecords = [];

  $('content-status').textContent = messageText;

  for (const id of [
    'content-count',
    'content-views',
    'content-hours'
  ]) {
    $(id).textContent = '—';
  }

  $('content-themes').replaceChildren();
  $('content-videos').replaceChildren();
}

async function loadContent(start, end, current) {
  $('content-status').textContent =
    'Loading worship video analytics…';

  try {
    const report = await getJSON(
      `/api/content?start=${start}&end=${end}`
    );

    if (current !== requestId) {
      return;
    }

    // Remove duplicate YouTube video IDs.
    const unique = new Map();

    for (const video of report.videos || []) {
      if (
        video.id &&
        !unique.has(video.id) &&
        isWorship(video)
      ) {
        unique.set(video.id, video);
      }
    }

    const allVideos = [...unique.values()];

    contentRecords = allVideos.map(video => ({
      ...video,
      inferredType: classifyContent(video, allVideos)
    }));

    const unclassified = contentRecords.filter(
      video => video.inferredType === 'Unclassified'
    ).length;

    const limitNote = report.limitedToRecentUploads
      ? ' · Recent-upload scan limit reached'
      : '';

    $('content-status').textContent =
      `${contentRecords.length} worship videos loaded · ` +
      `${unclassified} unclassified${limitNote}`;

    showContent();

  } catch (error) {
    if (current !== requestId) {
      return;
    }

    clearContent(
      'Content Performance unavailable: ' + error.message
    );

    console.warn(
      'Content Performance:',
      error.message
    );
  }
}

// ---------------------------------------------------------
// MAIN DASHBOARD LOADER
// ---------------------------------------------------------

async function load() {
  const current = ++requestId;

  $('refresh').disabled = true;

  message('Loading verified YouTube Analytics…');

  const { start, end } = dates(
    Number($('period').value)
  );

  // Load Content Performance independently so that a failure
  // in one reporting module does not hide the other.
  const contentPromise = loadContent(start, end, current);

  try {
    const [reportResult, channelResult] =
      await Promise.allSettled([
        getJSON(
          `/api/subscribers?start=${start}&end=${end}`
        ),
        getJSON('/api/channel')
      ]);

    if (current !== requestId) {
      return;
    }

    if (channelResult.status === 'fulfilled') {
      const count =
        channelResult.value.statistics?.subscriberCount;

      $('subscribers').textContent =
        count === undefined || count === null
          ? 'Unavailable'
          : format(count);

    } else {
      $('subscribers').textContent = '—';
    }

    if (reportResult.status === 'rejected') {
      throw reportResult.reason;
    }

    const rows = Array.isArray(reportResult.value.rows)
      ? reportResult.value.rows
      : [];

    const sum = index =>
      rows.reduce(
        (total, row) =>
          total + safeNumber(row[index]),
        0
      );

    const gained = sum(1);
    const lost = sum(2);
    const views = sum(3);
    const minutes = sum(4);

    $('gained').textContent =
      '+' + format(gained);

    $('lost').textContent = format(lost);

    $('net').textContent =
      (gained - lost > 0 ? '+' : '') +
      format(gained - lost);

    $('views').textContent = format(views);

    $('watch').textContent =
      (minutes / 60).toLocaleString('en-US', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1
      });

    drawChart(rows, start, end);

    const partial =
      channelResult.status === 'rejected';

    message(
      `Connected • Verified YouTube report: ${start} to ${end}` +
      (partial
        ? ' • Current subscriber total unavailable'
        : ''),
      partial ? 'warn' : 'ok'
    );

    $('updated').textContent =
      'Updated ' +
      new Date().toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      });

  } catch (error) {
    if (current !== requestId) {
      return;
    }

    clearReport();

    if (error.status === 401) {
      message(
        'YouTube sign-in required. Select Connect YouTube to authorize the dashboard.',
        'warn'
      );
    } else if (error.status === 503) {
      message(
        'YouTube Analytics is not fully configured: ' +
        error.message,
        'error'
      );
    } else {
      message(
        'Could not load YouTube Analytics: ' +
        error.message +
        '. Try Refresh.',
        'error'
      );
    }

    console.warn(
      'Audience Intelligence:',
      error.message
    );

  } finally {
    await contentPromise;

    if (current === requestId) {
      $('refresh').disabled = false;
    }
  }
}

// ---------------------------------------------------------
// EVENTS
// ---------------------------------------------------------

$('refresh').addEventListener('click', load);

$('period').addEventListener('change', load);

$('content-filter').addEventListener(
  'change',
  showContent
);

// Start dashboard.
load();
