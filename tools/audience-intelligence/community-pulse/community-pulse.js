
/*
  VUMC COMMUNITY PULSE
  Cloudflare + YouTube Content Performance

  Uses the existing Audience Intelligence Worker.
  No API keys or secrets are stored here.
*/

(() => {
  'use strict';

  const API =
    'https://holy-star-1faevumc-youtube-analytics.versaillesumcworshipteam.workers.dev';

  const $ = id => document.getElementById(id);

  const format = number =>
    Number(number || 0).toLocaleString('en-US');

  const number = value => {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  };

  // --------------------------------------------------
  // APPEARANCE FIX
  // --------------------------------------------------

  function fixStyles() {
    const style = document.createElement('style');

    style.textContent = `
      .pulse-geo.primary,
      .pulse-geo.primary span,
      .pulse-geo.primary small {
        color: #ffffff !important;
      }

      .pulse-geo.primary strong {
        color: #c5eaff !important;
      }

      .pulse-geo.primary span {
        font-weight: 800 !important;
      }

      .pulse-theme {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
        padding: 12px 0;
        border-bottom: 1px solid #dce7f0;
      }

      .pulse-theme:last-child {
        border-bottom: 0;
      }

      .pulse-theme span {
        flex: 1;
        min-width: 0;
        color: #234662;
        font-weight: 600;
      }

      .pulse-theme strong {
        color: #17649b;
        white-space: nowrap;
        font-size: 13px;
      }

      .pulse-data-status {
        margin: 0 0 14px;
        font-size: 12px;
        color: #657e94;
      }

      .pulse-data-summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 9px;
        margin-bottom: 14px;
      }

      .pulse-data-stat {
        padding: 12px 8px;
        text-align: center;
        background: #e7f1fa;
        border-radius: 9px;
      }

      .pulse-data-stat strong {
        display: block;
        color: #155c95;
        font-size: 20px;
        line-height: 1.3;
      }

      .pulse-data-stat span {
        display: block;
        color: #637b91;
        font-size: 11px;
        margin-top: 3px;
      }

      .pulse-data-note {
        margin: 14px 0 0;
        font-size: 11px;
        color: #72869a;
        line-height: 1.6;
      }

      .pulse-retry {
        margin-top: 12px;
        padding: 9px 13px;
        border: 0;
        border-radius: 8px;
        background: #17649b;
        color: white;
        cursor: pointer;
        font-weight: 700;
      }

      @media (max-width: 450px) {
        .pulse-data-summary {
          grid-template-columns: 1fr;
        }

        .pulse-theme {
          align-items: flex-start;
          flex-direction: column;
          gap: 4px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // --------------------------------------------------
  // GOOGLE TRENDS RESEARCH
  // --------------------------------------------------

  function setupResearch() {
    const topicInput = $('pulse-topic');
    const rangeInput = $('pulse-range');
    const launch = $('pulse-research-button');

    if (!topicInput || !rangeInput || !launch) {
      return;
    }

    function research(topicOverride) {
      const topic = String(
        topicOverride || topicInput.value
      ).trim();

      if (!topic) {
        topicInput.focus();
        return;
      }

      topicInput.value = topic;

      const params = new URLSearchParams({
        date: rangeInput.value,
        geo: 'US-KY',
        q: topic
      });

      window.open(
        'https://trends.google.com/trends/explore?' +
          params.toString(),
        '_blank',
        'noopener,noreferrer'
      );
    }

    launch.addEventListener('click', () => research());

    topicInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        research();
      }
    });

    document.querySelectorAll(
      '#pulse-suggestions [data-topic]'
    ).forEach(button => {
      button.addEventListener('click', () => {
        research(button.dataset.topic);
      });
    });
  }

  // --------------------------------------------------
  // DATE RANGE
  // --------------------------------------------------

  function reportingDates(days = 90) {
    const end = new Date();

    // YouTube Analytics reporting can lag.
    end.setUTCDate(end.getUTCDate() - 2);

    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);

    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    };
  }

  // --------------------------------------------------
  // CLOUDFLARE CONNECTION
  // --------------------------------------------------

  async function getJSON(path) {
    const response = await fetch(API + path, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    });

    let data = {};

    try {
      data = await response.json();
    } catch (_) {
      throw new Error(
        'Cloudflare returned an unreadable response.'
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        'Cloudflare returned HTTP ' + response.status
      );
    }

    return data;
  }

  // --------------------------------------------------
  // VIDEO FILTERING
  // Same basic exclusions as Audience Intelligence.
  // --------------------------------------------------

  function isWorship(video) {
    const title = String(
      video.title || ''
    ).toLowerCase().trim();

    if (!video.id || !title) {
      return false;
    }

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

    if (title === 'versailles umc live') {
      return false;
    }

    return true;
  }

  // --------------------------------------------------
  // SERMON TITLE CLEANUP
  // --------------------------------------------------

  function cleanSermonTitle(rawTitle) {
    let title = String(rawTitle || '').trim();

    title = title.replace(
      /^acts\s*:\s*the church that changed the world\s*[|—–-]\s*/i,
      ''
    );

    title = title.replace(
      /^week\s*\d+\s*[:—–-]?\s*/i,
      ''
    );

    title = title.replace(
      /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2}\s*[:—–-]\s*/i,
      ''
    );

    title = title.replace(
      /\s*\|\s*(?:acts|john|matthew|mark|luke|romans|hebrews|psalm|genesis|exodus|philippians|colossians|ecclesiastes|proverbs|galatians)\b.*$/i,
      ''
    );

    title = title.replace(
      /\s*\(\s*(?:acts|john|matthew|mark|luke|romans|hebrews|psalm)\b[^)]*\)\s*$/i,
      ''
    );

    title = title.replace(
      /\s*[—–]\s*(?:acts|john|matthew|mark|luke|romans|hebrews|psalm)\b.*$/i,
      ''
    );

    title = title.replace(
      /\s+acts\s+\d+:\d+(?:\s*[-–—]\s*\d+)?\s*$/i,
      ''
    );

    return title.replace(/\s+/g, ' ').trim() ||
      'Untitled Worship Service';
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

  // --------------------------------------------------
  // DISPLAY HELPERS
  // --------------------------------------------------

  function element(tag, className, text) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  }

  function statistic(value, label) {
    const box = element('div', 'pulse-data-stat');

    box.append(
      element('strong', '', value),
      element('span', '', label)
    );

    return box;
  }

  // --------------------------------------------------
  // RENDER CONTENT PERFORMANCE
  // --------------------------------------------------

  function renderAnalytics(videos, report, dates) {
    const target = $('pulse-channel-themes');

    if (!target) return;

    target.replaceChildren();

    const unique = new Map();

    for (const video of videos) {
      if (
        isWorship(video) &&
        !unique.has(video.id)
      ) {
        unique.set(video.id, video);
      }
    }

    const worshipVideos = [...unique.values()];

    const totalViews = worshipVideos.reduce(
      (sum, video) =>
        sum + number(video.metrics?.views),
      0
    );

    const totalMinutes = worshipVideos.reduce(
      (sum, video) =>
        sum + number(video.metrics?.watchMinutes),
      0
    );

    const totalHours = (totalMinutes / 60)
      .toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });

    const status = element(
      'p',
      'pulse-data-status',
      'YouTube Content Performance · ' +
      dates.start + ' to ' + dates.end
    );

    const summary = element(
      'div',
      'pulse-data-summary'
    );

    summary.append(
      statistic(
        format(worshipVideos.length),
        'Worship videos'
      ),
      statistic(
        format(totalViews),
        'Video views'
      ),
      statistic(
        totalHours,
        'Watch hours'
      )
    );

    target.append(status, summary);

    if (!worshipVideos.length) {
      target.appendChild(
        element(
          'p',
          '',
          'No eligible worship videos were found for this period.'
        )
      );

      return;
    }

    // Group Traditional and Contemporary recordings
    // under their common sermon title.

    const groups = new Map();

    for (const video of worshipVideos) {
      const title = cleanSermonTitle(video.title);
      const key = sermonKey(video.title);

      if (!groups.has(key)) {
        groups.set(key, {
          title,
          views: 0,
          minutes: 0,
          count: 0
        });
      }

      const group = groups.get(key);

      group.views += number(video.metrics?.views);
      group.minutes += number(
        video.metrics?.watchMinutes
      );
      group.count++;
    }

    const ranked = [...groups.values()]
      .sort((a, b) =>
        b.views - a.views ||
        a.title.localeCompare(b.title)
      )
      .slice(0, 5);

    const heading = element(
      'h4',
      '',
      'Top Sermon Themes'
    );

    heading.style.margin = '18px 0 8px';
    heading.style.color = '#193d60';

    target.appendChild(heading);

    for (const group of ranked) {
      const row = element(
        'div',
        'pulse-theme'
      );

      const title = element(
        'span',
        '',
        group.title
      );

      const value = element(
        'strong',
        '',
        format(group.views) + ' views'
      );

      row.append(title, value);
      target.appendChild(row);
    }

    const note = element(
      'p',
      'pulse-data-note',
      'Statistics reflect YouTube video engagement, ' +
      'not unique viewers or local search demand. ' +
      'Matching sermon titles are combined.'
    );

    target.appendChild(note);

    if (report.limitedToRecentUploads) {
      target.appendChild(
        element(
          'p',
          'pulse-data-note',
          'The Cloudflare Worker reached its recent-upload ' +
          'scan limit. Results may not include every video ' +
          'published during this period.'
        )
      );
    }
  }

  // --------------------------------------------------
  // LOAD VUMC DATA
  // --------------------------------------------------

  async function loadAnalytics() {
    const target = $('pulse-channel-themes');

    if (!target) return;

    target.textContent =
      'Connecting to VUMC YouTube Analytics…';

    const dates = reportingDates(90);

    const path =
      '/api/content?start=' +
      encodeURIComponent(dates.start) +
      '&end=' +
      encodeURIComponent(dates.end);

    try {
      const report = await getJSON(path);

      if (!Array.isArray(report.videos)) {
        throw new Error(
          'The Worker did not return a video list.'
        );
      }

      renderAnalytics(
        report.videos,
        report,
        dates
      );

    } catch (error) {
      console.warn(
        'Community Pulse analytics:',
        error
      );

      target.replaceChildren();

      target.appendChild(
        element(
          'p',
          '',
          'Unable to load VUMC analytics: ' +
          error.message
        )
      );

      if (
        /401|403|unauthorized|authentication/i
          .test(error.message)
      ) {
        target.appendChild(
          element(
            'p',
            'pulse-data-note',
            'The YouTube connection may need authorization ' +
            'through the main Audience Intelligence dashboard.'
          )
        );
      }

      const retry = element(
        'button',
        'pulse-retry',
        'Try Again'
      );

      retry.type = 'button';
      retry.addEventListener(
        'click',
        loadAnalytics
      );

      target.appendChild(retry);
    }
  }

  // --------------------------------------------------
  // INITIALIZE
  // --------------------------------------------------

  function initialize() {
    fixStyles();
    setupResearch();
    loadAnalytics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
