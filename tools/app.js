/* VUMC Staff Tools: GAS-authenticated login gate. No secrets stored in GitHub. */
(() => {
  'use strict';
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbzHpOIjWgX-jiOMGwiCBrONrmym-9kMJDOQ4DA15re8d-_MUidnpXbIGCZYTqM_gAJV/exec';
  const KEY = 'vumc_staff_token';
  const loginPanel = document.getElementById('loginPanel');
  const portal = document.getElementById('staffPortal');
  const form = document.getElementById('staffLoginForm');
  const password = document.getElementById('staffPassword');
  const loginButton = document.getElementById('staffLoginButton');
  const message = document.getElementById('loginMessage');
  const logoutButton = document.getElementById('staffLogoutButton');
  const bridge = document.getElementById('staffBridge');
  const pending = new Map();
  let ready = false;
  let bridgeWindow = null;
  let bridgeOrigin = null;
  let counter = 0;
  let booted = false;

  function showLogin(text = '') {
    loginPanel.hidden = false;
    portal.hidden = true;
    portal.inert = true;
    logoutButton.hidden = true;
    if (text) setMessage(text, true);
  }
  function showPortal() {
    password.value = '';
    loginPanel.hidden = true;
    portal.hidden = false;
    portal.inert = false;
    logoutButton.hidden = false;
    message.textContent = '';
  }
  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle('error', isError);
  }
  function token() { return sessionStorage.getItem(KEY) || ''; }
  function clearToken() { sessionStorage.removeItem(KEY); }
  function request(action, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!ready || !bridgeWindow || !bridgeOrigin) {
        reject(new Error('Authentication service is not connected. Refresh and try again.'));
        return;
      }
      const requestId = `staff-${Date.now()}-${++counter}`;
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('Authentication timed out. Please try again.'));
      }, 25000);
      pending.set(requestId, { resolve, reject, timeout });
      bridgeWindow.postMessage({type:'vumc-bridge-request', requestId, action, payload}, bridgeOrigin);
    });
  }
  // Apps Script HTMLService runs Bridge.html inside a nested Google iframe.
  // The actual sender is the INNER frame, not bridge.contentWindow.
  // Reply to the exact authenticated message source and origin.
  window.addEventListener('message', event => {
    let origin;
    try { origin = new URL(event.origin); } catch { return; }
    if (origin.protocol !== 'https:' || !(
      origin.hostname === 'script.google.com' ||
      origin.hostname === 'script.googleusercontent.com' ||
      origin.hostname.endsWith('.googleusercontent.com')
    )) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'vumc-bridge-ready') {
      if (!event.source || typeof event.source.postMessage !== 'function') return;
      bridgeWindow = event.source;
      bridgeOrigin = event.origin;
      clearTimeout(connectionTimer);
      ready = true;
      if (!booted) { booted = true; restoreSession(); }
      return;
    }
    if (data.type !== 'vumc-bridge-response') return;
    if (!ready || event.source !== bridgeWindow || event.origin !== bridgeOrigin) return;
    const item = pending.get(data.requestId);
    if (!item) return;
    clearTimeout(item.timeout);
    pending.delete(data.requestId);
    item.resolve(data.result || {success:false,error:'Empty authentication response.'});
  });

  async function restoreSession() {
    const existing = token();
    if (!existing) { showLogin(); setMessage('Enter your staff password to continue.'); return; }
    setMessage('Checking your existing staff session…');
    try {
      const result = await request('verifyStaffSession', {token:existing});
      if (result && result.success === true) { showPortal(); return; }
    } catch (error) { /* Fail closed. */ }
    clearToken();
    showLogin('Your session expired. Please sign in again.');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready) { setMessage('Still connecting to the authentication service.', true); return; }
    const passkey = password.value;
    if (!passkey) return;
    loginButton.disabled = true;
    setMessage('Verifying staff password…');
    try {
      const result = await request('staffLogin', {passkey});
      if (!result || result.success !== true || !result.token) {
        setMessage((result && result.error) || 'Password not accepted.', true);
        return;
      }
      sessionStorage.setItem(KEY, result.token);
      showPortal();
    } catch (error) { setMessage(error.message || 'Login failed.', true); }
    finally { loginButton.disabled = false; password.value = ''; }
  });

  logoutButton.addEventListener('click', async () => {
    const existing = token();
    clearToken();
    showLogin();
    setMessage('Signed out.');
    if (existing && ready) {
      try { await request('staffLogout', {token:existing}); } catch (_) {}
    }
  });

  document.querySelectorAll('.tool-card.disabled').forEach(card => {
    card.addEventListener('click', event => event.preventDefault());
  });

  showLogin();
  const connectionTimer = setTimeout(() => {
    if (!ready) setMessage('Could not connect to Staff Tools authentication. Confirm the GAS web app deployment and iframe access, then refresh.', true);
  }, 12000);
})();
