import test from 'node:test';
import assert from 'node:assert/strict';

import { POST as saveDeviceLocation } from '../app/api/device-location/route';

test('device location route reverse geocodes browser coordinates and stores location cookies', async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        address: {
          city: 'Zurich',
          country: 'Switzerland',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

  try {
    const response = await saveDeviceLocation(
      new Request('https://decisive.coach/api/device-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: 47.3769, longitude: 8.5417 }),
      }),
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, { ok: true, city: 'Zurich', country: 'Switzerland' });

    const setCookie = response.headers.get('set-cookie') || '';
    assert.match(setCookie, /decisive_device_city=Zurich/i);
    assert.match(setCookie, /decisive_device_country=Switzerland/i);
    assert.match(setCookie, /decisive_device_lat=47.3769/i);
    assert.match(setCookie, /decisive_device_lon=8.5417/i);
  } finally {
    global.fetch = originalFetch;
  }
});
