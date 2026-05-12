// Meta Conversions API helper. Fires server-side events to Meta's Graph API
// to complement the browser-side Pixel. Deduplication uses event_id +
// event_name and is automatic on Meta's side when both events match.
//
// Required env vars:
//   META_PIXEL_ID   — your Pixel / Dataset ID (defaults to the hard-coded one below)
//   META_CAPI_TOKEN — system-user access token with ads_management on the pixel
// Optional:
//   META_TEST_EVENT_CODE — set while testing to make events show in Events Manager → Test Events
import crypto from 'node:crypto';

const GRAPH_VERSION = 'v21.0';
const DEFAULT_PIXEL_ID = '1459427022141284';
const LEAD_VALUE = 1;          // placeholder USD value so Meta can rank events
const LEAD_CURRENCY = 'USD';

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function formNameFor(source) {
  if (source === 'hero') return 'Hero form';
  if (source === 'cta')  return 'Bottom CTA form';
  return 'Email form';
}

export function newEventId() {
  return crypto.randomUUID();
}

// Returns true if sent (or skipped intentionally), false on hard failure.
// Never throws — Meta tracking must not break the submit flow.
export async function sendMetaEvent({
  eventName,
  eventId,
  email,
  source,
  ip,
  userAgent,
  fbp,
  fbc,
  eventSourceUrl,
}) {
  const pixelId = process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    // Not configured yet — skip silently so the form still works.
    return false;
  }

  const userData = {};
  if (email) {
    const emailHash = sha256(String(email).trim().toLowerCase());
    userData.em = [emailHash];
    // Stable per-user identifier for cross-device matching.
    userData.external_id = [emailHash];
  }
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const customData = {
    value: LEAD_VALUE,
    currency: LEAD_CURRENCY,
    content_name: formNameFor(source),
    content_category: 'lead_form',
    lead_event_source: source || 'unknown',
    source: source || 'unknown',
  };

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: eventSourceUrl,
    user_data: userData,
    custom_data: customData,
  };

  const body = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Meta CAPI error', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Meta CAPI fetch failed', err);
    return false;
  }
}
