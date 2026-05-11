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

const GRAPH_VERSION = 'v19.0';
const DEFAULT_PIXEL_ID = '1459427022141284';

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
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
  if (email) userData.em = [sha256(String(email).trim().toLowerCase())];
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: eventSourceUrl,
    user_data: userData,
    custom_data: source ? { source } : undefined,
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
