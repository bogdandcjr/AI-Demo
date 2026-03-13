// netlify/functions/strava-activities.js
// Fetches all activities from Strava using a fresh token and returns them.
// The browser never sees the access token.
//
// Query params:
//   after = unix timestamp (optional, defaults to start of last year)

exports.handler = async (event) => {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Strava environment variables on server.' }),
    };
  }

  try {
    // Step 1: Get a fresh access token
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: STRAVA_REFRESH_TOKEN,
        grant_type:    'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return {
        statusCode: tokenRes.status,
        body: JSON.stringify({ error: tokenData.message || 'Token refresh failed.' }),
      };
    }

    const accessToken = tokenData.access_token;

    // Step 2: Fetch activities — default to start of last year
    const now = new Date();
    const defaultAfter = Math.floor(new Date(now.getFullYear() - 1, 0, 1).getTime() / 1000);
    const after = event.queryStringParameters?.after || defaultAfter;

    const activities = [];
    let page = 1;

    while (true) {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!res.ok) {
        return {
          statusCode: res.status,
          body: JSON.stringify({ error: `Strava activities fetch failed: ${res.status}` }),
        };
      }

      const batch = await res.json();
      if (!batch.length) break;

      // Only return the fields the frontend needs — keep payload small
      batch.forEach(a => {
        activities.push({
          type:             a.type || a.sport_type,
          start_date_local: a.start_date_local,
          distance:         a.distance,
        });
      });

      if (batch.length < 200) break;
      page++;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
