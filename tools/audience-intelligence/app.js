// Public dashboard code only. Never place Google credentials or tokens here.
const API = 'https://holy-star-1faevumc-youtube-analytics.versaillesumcworshipteam.workers.dev';
const $ = id => document.getElementById(id);
const format = value => Number(value).toLocaleString('en-US');
const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function dates(days) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return {start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10)};
}
function message(value, kind='') {
  $('status').textContent = value;
  $('status').className = 'notice ' + kind;
}
function clearReport() {
  for (const id of ['gained','lost','net','views','watch']) $(id).textContent = '—';
  $('chart').replaceChildren();
  $('chart').textContent = 'Connect YouTube to display verified subscriber activity.';
  $('chart-start').textContent = '';
  $('chart-end').textContent = '';
}
async function getJSON(path) {
  const response = await fetch(API + path, {credentials:'include', cache:'no-store'});
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    const error = new Error(data.message || data.error || `Request returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}
function drawChart(rows, start, end) {
  const chart = $('chart');
  chart.replaceChildren();
  $('chart-start').textContent = start;
  $('chart-end').textContent = end;
  if (!rows.length) {
    chart.textContent = 'No subscriber changes were reported during this period.';
    return;
  }
  const max = Math.max(1, ...rows.flatMap(row => [safeNumber(row[1]), safeNumber(row[2])]));
  const bars = document.createElement('div');
  bars.className = 'bars';
  for (const row of rows) {
    const day = document.createElement('div');
    day.className = 'chart-day';
    const gained = safeNumber(row[1]);
    const lost = safeNumber(row[2]);
    day.title = `${row[0]} • Gained ${gained}, lost ${lost}`;
    day.setAttribute('aria-label', day.title);
    for (const [value, type] of [[gained,'gain'],[lost,'loss']]) {
      const bar = document.createElement('div');
      bar.className = 'chart-bar ' + type;
      bar.style.height = value ? `${Math.max(3, (value/max)*100)}%` : '0';
      day.appendChild(bar);
    }
    bars.appendChild(day);
  }
  chart.appendChild(bars);
}
let requestId = 0;
async function load() {
  const current = ++requestId;
  $('refresh').disabled = true;
  message('Loading verified YouTube Analytics…');
  const {start,end} = dates(Number($('period').value));
  try {
    const [reportResult, channelResult] = await Promise.allSettled([
      getJSON(`/api/subscribers?start=${start}&end=${end}`),
      getJSON('/api/channel')
    ]);
    if (current !== requestId) return;
    if (channelResult.status === 'fulfilled') {
      const count = channelResult.value.statistics?.subscriberCount;
      $('subscribers').textContent = count === undefined || count === null ? 'Unavailable' : format(count);
    } else {
      $('subscribers').textContent = '—';
    }
    if (reportResult.status === 'rejected') throw reportResult.reason;
    const rows = Array.isArray(reportResult.value.rows) ? reportResult.value.rows : [];
    const sum = index => rows.reduce((total,row) => total + safeNumber(row[index]),0);
    const gained = sum(1), lost = sum(2), views = sum(3), minutes = sum(4);
    $('gained').textContent = '+' + format(gained);
    $('lost').textContent = format(lost);
    $('net').textContent = (gained-lost > 0 ? '+' : '') + format(gained-lost);
    $('views').textContent = format(views);
    $('watch').textContent = (minutes/60).toLocaleString('en-US',{maximumFractionDigits:1,minimumFractionDigits:1});
    drawChart(rows,start,end);
    const partial = channelResult.status === 'rejected';
    message(`Connected • Verified YouTube report: ${start} to ${end}` + (partial ? ' • Current subscriber total unavailable' : ''), partial ? 'warn' : 'ok');
    $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  } catch(error) {
    if (current !== requestId) return;
    clearReport();
    if (error.status === 401) message('YouTube sign-in required. Select Connect YouTube to authorize the dashboard.','warn');
    else if (error.status === 503) message('YouTube Analytics is not fully configured: ' + error.message,'error');
    else message('Could not load YouTube Analytics: ' + error.message + '. Try Refresh.','error');
    console.warn('Audience Intelligence:', error.message);
  } finally {
    if (current === requestId) $('refresh').disabled = false;
  }
}
$('refresh').addEventListener('click',load);
$('period').addEventListener('change',load);
load();
