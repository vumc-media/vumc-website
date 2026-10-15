
/*
  VUMC AUDIENCE INTELLIGENCE
  Subscriber Reporting + Content Performance
  No credentials or tokens belong in this file.
*/

const API =
  'https://holy-star-1faevumc-youtube-analytics.versaillesumcworshipteam.workers.dev';

const $ = id => document.getElementById(id);

const format = value =>
  Number(value).toLocaleString('en-US');

const safeNumber = value =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

let requestId = 0;
let contentRecords = [];

// =====================================================
// DATE RANGE
// =====================================================

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

// =====================================================
// API
// =====================================================

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
      data.message ||
      data.error ||
      `Request returned ${response.status}`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

function message(value, kind = '') {
  $('status').textContent = value;
  $('status').className = 'notice ' + kind;
}

function element(tag, className = '', text = undefined) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

// =====================================================
// SUBSCRIBER REPORTING
// =====================================================

function clearReport() {
  for (const id of [
    'gained', 'lost', 'net', 'views', 'watch'
  ]) {
    $(id).textContent = '—';
  }

  $('chart').replaceChildren();

  $('chart').textContent =
    'Connect YouTube to display subscriber activity.';

  $('chart-start').textContent = '';
  $('chart-end').textContent = '';
}

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

  const bars = element('div', 'bars');

  for (const row of rows) {
    const day = element('div', 'chart-day');

    const gained = safeNumber(row[1]);
    const lost = safeNumber(row[2]);

    day.title =
      `${row[0]} • Gained ${gained}, lost ${lost}`;

    day.setAttribute('aria-label', day.title);

    for (const [value, type] of [
      [gained, 'gain'],
      [lost, 'loss']
    ]) {
      const bar = element(
        'div',
        'chart-bar ' + type
      );

      bar.style.height = value
        ? `${Math.max(3, value / max * 100)}%`
        : '0';

      day.appendChild(bar);
    }

    bars.appendChild(day);
  }

  chart.appendChild(bars);
}

// =====================================================
// SERMON TITLE CLEANUP
// =====================================================

function cleanSermonTitle(rawTitle) {
  let title = String(rawTitle || '').trim();

  // Remove the Acts series prefix.
  title = title.replace(
    /^acts\s*:\s*the church that changed the world\s*[|—–-]\s*/i,
    ''
  );

  // Remove week numbers, including "Week 10 -".
  title = title.replace(
    /^week\s*\d+\s*[:—–-]?\s*/i,
    ''
  );

  // Remove calendar prefixes, such as "Oct. 11 —".
  title = title.replace(
    /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2}\s*[:—–-]\s*/i,
    ''
  );

  // Remove scripture suffix after a vertical bar.
  title = title.replace(
    /\s*\|\s*(?:acts|john|matthew|mark|luke|romans|hebrews|psalm|genesis|exodus|philippians|colossians|ecclesiastes|proverbs|galatians)\b.*$/i,
    ''
  );

  // Remove parenthesized scripture at the end.
  title = title.replace(
    /\s*\(\s*(?:acts|john|matthew|mark|luke|romans|hebrews|psalm)\b[^)]*\)\s*$/i,
    ''
  );

  // Remove scripture after an em dash.
  title = title.replace(
    /\s*[—–]\s*(?:acts|john|matthew|mark|luke|romans|hebrews|psalm)\b.*$/i,
    ''
  );

  // Remove trailing Acts reference without a separator.
  title = title.replace(
    /\s+acts\s+\d+:\d+(?:\s*[-–—]\s*\d+)?\s*$/i,
    ''
  );

  return title
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled Worship Service';
}

function sermonKey(title) {
  return cleanSermonTitle(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”‘’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// =====================================================
// VIDEO ELIGIBILITY
// =====================================================

function isWorship(video) {
  const title = String(video.title || '').toLowerCase();

  if (
    video.liveBroadcastContent === 'upcoming' ||
    video.duration === 'P0D'
  ) {
    return false;
  }

  if (
    /celebration of life|memorial service|funeral|anniversary worship event|silver voices/.test(title)
  ) {
    return false;
  }

  // Generic titles cannot be assigned to a sermon reliably.
  if (title === 'versailles umc live') {
    return false;
  }

  return true;
}

// =====================================================
// TRADITIONAL / CONTEMPORARY CLASSIFICATION
// =====================================================

function explicitServiceType(video) {
  const type = video.serviceType;

  if (
    type === 'Traditional' ||
    type === 'Contemporary'
  ) {
    return type;
  }

  return 'Unclassified';
}

function classifyVideo(video, allVideos) {
  const explicit = explicitServiceType(video);

  if (explicit !== 'Unclassified') {
    return {
      type: explicit,
      inferred: false
    };
  }

  const key = sermonKey(video.title);

  const matches = allVideos.filter(
    other => sermonKey(other.title) === key
  );

  const traditional = matches.filter(
    other => explicitServiceType(other) === 'Traditional'
  );

  const contemporary = matches.filter(
    other => explicitServiceType(other) === 'Contemporary'
  );

  const unclassified = matches.filter(
    other => explicitServiceType(other) === 'Unclassified'
  );

  // Infer Contemporary only for a unique two-video pair
  // containing one explicitly labeled Traditional recording.
  if (
    matches.length === 2 &&
    traditional.length === 1 &&
    contemporary.length === 0 &&
    unclassified.length === 1
  ) {
    return {
      type: 'Contemporary',
      inferred: true
    };
  }

  return {
    type: 'Unclassified',
    inferred: false
  };
}

// =====================================================
// COMPARISON MODULE
// Created automatically; no index.html edit required.
// =====================================================

function setupComparison() {
  if ($('service-comparison')) return;

  const summary = document.querySelector('.content-summary');

  if (!summary) return;

  const section = element(
    'section',
    'service-comparison'
  );

  section.id = 'service-comparison';

  const heading = element(
    'h3',
    '',
    'Traditional vs. Contemporary'
  );

  const description = element(
    'p',
    'content-help',
    'Compare reported video views and watch hours for each worship service.'
  );

  const grid = element(
    'div',
    'comparison-grid'
  );

  for (const type of [
    'Traditional',
    'Contemporary'
  ]) {
    const card = element(
      'article',
      'comparison-card ' + type.toLowerCase()
    );

    card.appendChild(
      element('h4', '', type + ' Worship')
    );

    const views = element(
      'strong',
      'comparison-views',
      '—'
    );

    views.id = 'compare-' + type.toLowerCase() + '-views';

    const hours = element(
      'span',
      'comparison-hours',
      '—'
    );

    hours.id = 'compare-' + type.toLowerCase() + '-hours';

    const count = element(
      'span',
      'comparison-count',
      '—'
    );

    count.id = 'compare-' + type.toLowerCase() + '-count';

    card.append(views, hours, count);
    grid.appendChild(card);
  }

  section.append(heading, description, grid);

  const note = element(
    'p',
    'comparison-note',
    'Comparisons use videos whose service type is labeled or inferred from a unique matching sermon pair. Unclassified videos are excluded.'
  );

  section.appendChild(note);

  summary.insertAdjacentElement('afterend', section);
}

function updateComparison(videos) {
  setupComparison();

  for (const type of [
    'Traditional',
    'Contemporary'
  ]) {
    const group = videos.filter(
      video => video.displayType === type
    );

    const views = group.reduce(
      (total, video) =>
        total + safeNumber(video.metrics?.views),
      0
    );

    const minutes = group.reduce(
      (total, video) =>
        total + safeNumber(video.metrics?.watchMinutes),
      0
    );

    const prefix = 'compare-' + type.toLowerCase();

    $(prefix + '-views').textContent =
      format(views) + ' views';

    $(prefix + '-hours').textContent =
      (minutes / 60).toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }) + ' watch hours';

    $(prefix + '-count').textContent =
      format(group.length) + ' worship videos';
  }
}

// =====================================================
// CONTENT PERFORMANCE RENDERING
// =====================================================

function showContent() {
  const filter = $('content-filter').value;

  const videos = contentRecords.filter(
    video =>
      filter === 'All' ||
      video.displayType === filter
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

  $('content-count').textContent =
    format(videos.length);

  $('content-views').textContent =
    format(totalViews);

  $('content-hours').textContent =
    (totalMinutes / 60).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });

  // Always compare the full set of classified services.
  // The service filter affects rankings and video details.
  updateComparison(contentRecords);

  // Group matching worship recordings by sermon title.
  const groups = new Map();

  for (const video of videos) {
    const key = sermonKey(video.title);

    if (!groups.has(key)) {
      groups.set(key, {
        title: cleanSermonTitle(video.title),
        views: 0,
        minutes: 0,
        count: 0
      });
    }

    const group = groups.get(key);

    group.views += safeNumber(video.metrics?.views);
    group.minutes += safeNumber(
      video.metrics?.watchMinutes
    );
    group.count++;
  }

  const rankedThemes = [...groups.values()]
    .sort(
      (a, b) =>
        b.views - a.views ||
        a.title.localeCompare(b.title)
    )
    .slice(0, 10);

  const themeContainer = $('content-themes');
  themeContainer.replaceChildren();

  if (!rankedThemes.length) {
    themeContainer.textContent =
      'No worship videos match this selection.';
  }

  rankedThemes.forEach((theme, index) => {
    const row = element('div', 'theme-row');

    row.append(
      element(
        'span',
        'theme-rank',
        String(index + 1)
      ),
      element(
        'span',
        'theme-name',
        theme.title
      ),
      element(
        'span',
        'theme-value',
        format(theme.views) +
          ' views · ' +
          theme.count +
          (theme.count === 1 ? ' video' : ' videos')
      )
    );

    themeContainer.appendChild(row);
  });

  // Individual video cards.
  const container = $('content-videos');
  container.replaceChildren();

  const rankedVideos = [...videos]
    .sort(
      (a, b) =>
        safeNumber(b.metrics?.views) -
        safeNumber(a.metrics?.views)
    )
    .slice(0, 30);

  for (const video of rankedVideos) {
    const card = element('a', 'video-card');

    card.href =
      'https://www.youtube.com/watch?v=' +
      encodeURIComponent(video.id);

    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    if (video.thumbnail) {
      const image = element('img', 'video-thumb');
      image.src = video.thumbnail;
      image.alt = '';
      image.loading = 'lazy';
      card.appendChild(image);
    }

    const info = element('div', 'video-info');

    info.appendChild(
      element(
        'strong',
        '',
        cleanSermonTitle(video.title)
      )
    );

    const typeLabel =
      video.displayType +
      (video.inferredType ? ' (inferred)' : '');

    const published = new Date(video.publishedAt);

    const dateLabel = Number.isNaN(published.getTime())
      ? 'Date unavailable'
      : published.toLocaleDateString();

    info.appendChild(
      element(
        'span',
        'video-meta',
        typeLabel + ' · ' + dateLabel
      )
    );

    const views = safeNumber(video.metrics?.views);

    const hours =
      safeNumber(video.metrics?.watchMinutes) / 60;

    info.appendChild(
      element(
        'span',
        'video-stats',
        format(views) +
          ' views · ' +
          hours.toFixed(1) +
          ' watch hours'
      )
    );

    card.appendChild(info);
    container.appendChild(card);
  }
}

// =====================================================
// CONTENT DATA LOADING
// =====================================================

function clearContent(text) {
  contentRecords = [];

  $('content-status').textContent = text;

  for (const id of [
    'content-count',
    'content-views',
    'content-hours'
  ]) {
    $(id).textContent = '—';
  }

  $('content-themes').replaceChildren();
  $('content-videos').replaceChildren();

  updateComparison([]);
}

async function loadContent(start, end, current) {
  $('content-status').textContent =
    'Loading worship video analytics…';

  try {
    const report = await getJSON(
      `/api/content?start=${start}&end=${end}`
    );

    if (current !== requestId) return;

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

    contentRecords = allVideos.map(video => {
      const classification =
        classifyVideo(video, allVideos);

      return {
        ...video,
        cleanTitle: cleanSermonTitle(video.title),
        displayType: classification.type,
        inferredType: classification.inferred
      };
    });

    const unclassified = contentRecords.filter(
      video => video.displayType === 'Unclassified'
    ).length;

    const inferred = contentRecords.filter(
      video => video.inferredType
    ).length;

    $('content-status').textContent =
      `${contentRecords.length} worship videos loaded · ` +
      `${inferred} service types inferred · ` +
      `${unclassified} unclassified` +
      (report.limitedToRecentUploads
        ? ' · Recent-upload scan limit reached'
        : '');

    showContent();

  } catch (error) {
    if (current !== requestId) return;

    clearContent(
      'Content Performance unavailable: ' +
      error.message
    );

    console.warn(
      'Content Performance:',
      error.message
    );
  }
}

// =====================================================
// MAIN DASHBOARD LOADER
// =====================================================

async function load() {
  const current = ++requestId;

  $('refresh').disabled = true;

  message('Loading verified YouTube Analytics…');

  const { start, end } = dates(
    Number($('period').value)
  );

  const contentPromise =
    loadContent(start, end, current);

  try {
    const [reportResult, channelResult] =
      await Promise.allSettled([
        getJSON(
          `/api/subscribers?start=${start}&end=${end}`
        ),
        getJSON('/api/channel')
      ]);

    if (current !== requestId) return;

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

    $('lost').textContent =
      format(lost);

    $('net').textContent =
      (gained - lost > 0 ? '+' : '') +
      format(gained - lost);

    $('views').textContent =
      format(views);

    $('watch').textContent =
      (minutes / 60).toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
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
    if (current !== requestId) return;

    clearReport();

    if (error.status === 401) {
      message(
        'YouTube sign-in required. Select Connect YouTube.',
        'warn'
      );
    } else if (error.status === 503) {
      message(
        'YouTube Analytics configuration error: ' +
        error.message,
        'error'
      );
    } else {
      message(
        'Could not load YouTube Analytics: ' +
        error.message,
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

// =====================================================
// EVENTS AND INITIALIZATION
// =====================================================

setupComparison();

$('refresh').addEventListener('click', load);
$('period').addEventListener('change', load);
$('content-filter').addEventListener(
  'change',
  showContent
);

load();
