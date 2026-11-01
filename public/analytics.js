// Adapted from Learn's consent controller; app events never include board or file data.
(() => {
  const script = document.currentScript;
  if (!script || window.__uugAppAnalytics) return;
  const { measurementId, productionHost, stagingHost, legacyHost, cookiePrefix } = script.dataset;
  const host = window.location.hostname;
  if (window.location.protocol !== 'https:' || ![productionHost, stagingHost, legacyHost].includes(host)) return;

  const banner = document.querySelector('#cookie-banner');
  const status = document.querySelector('[data-analytics-status]');
  const canonical = document.querySelector('link[rel="canonical"]');
  const title = document.querySelector('meta[property="og:title"]');
  if (!banner || !status || !canonical || !title || !measurementId || !cookiePrefix) {
    console.error('Analytics is disabled because consent controls or site metadata are missing.');
    return;
  }
  window.__uugAppAnalytics = true;
  const consentKey = 'uug-analytics-consent';
  let preference = null;
  const notify = (message, error) => {
    status.textContent = message;
    status.hidden = false;
    banner.hidden = false;
    console.warn(message, error);
  };
  const storedPreference = (value) => {
    if (value === null || value === 'granted' || value === 'denied') return value;
    notify('Your cookie preference was not recognized. Please choose again.');
    return null;
  };
  try {
    preference = storedPreference(localStorage.getItem(consentKey));
  } catch (error) {
    notify('Your cookie preference could not be read. Analytics cookies stay off until you accept them.', error);
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  // Consent Mode v2 advanced: before consent, GA sends only cookieless pings.
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  if (preference === 'granted') gtag('consent', 'update', { analytics_storage: 'granted' });
  gtag('js', new Date());
  gtag('config', measurementId, {
    send_page_view: false,
    page_title: title.content,
    page_location: canonical.href,
    page_referrer: '',
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: host,
    cookie_prefix: cookiePrefix,
    cookie_expires: 31536000,
    cookie_flags: 'SameSite=Lax;Secure',
  });
  gtag('event', 'page_view', { send_to: measurementId });

  const clearCookies = () => {
    try {
      const pattern = new RegExp(`^${cookiePrefix}_ga(?:_|$)`);
      const names = document.cookie.split(';').map((cookie) => cookie.trim().split('=')[0])
        .filter((name) => pattern.test(name));
      names.forEach((name) => {
        const expired = `${name}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
        document.cookie = expired;
        document.cookie = `${expired}; Domain=${host}`;
      });
    } catch (error) {
      notify('Analytics cookies could not be cleared. Analytics cookie storage remains disabled.', error);
    }
  };
  const applyPreference = () => {
    gtag('consent', 'update', { analytics_storage: preference === 'granted' ? 'granted' : 'denied' });
    banner.hidden = preference !== null;
    if (preference !== 'granted') clearCookies();
  };
  banner.querySelectorAll('[data-analytics-consent]').forEach((button) => {
    button.addEventListener('click', () => {
      preference = button.dataset.analyticsConsent;
      status.hidden = true;
      applyPreference();
      try {
        localStorage.setItem(consentKey, preference);
      } catch (error) {
        notify('Your cookie preference could not be saved. This choice applies only to this page.', error);
      }
    });
  });
  // Native button/link keys still work without triggering the apps' global shortcuts.
  banner.addEventListener('keydown', (event) => event.stopPropagation());
  banner.addEventListener('keyup', (event) => event.stopPropagation());
  window.addEventListener('storage', (event) => {
    if (event.key !== consentKey && event.key !== null) return;
    preference = storedPreference(event.key === null ? null : event.newValue);
    applyPreference();
  });

  banner.hidden = preference !== null;
  if (preference !== 'granted') clearCookies();
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  tag.onerror = () => notify('Google Analytics could not be loaded. You can still use the app.');
  document.head.appendChild(tag);
})();
