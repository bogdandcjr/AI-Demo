// netlify/functions/strava-activities.js

export async function handler(event) {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;

  console.log('ENV check:', {
    hasId:      !!STRAVA_CLIENT_ID,
    hasSecret:  !!STRAVA_CLIENT_SECRET,
    hasRefresh: !!STRAVA_REFRESH_TOKEN,
  });

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
    console.log('Token status:', tokenRes.status, JSON.stringify(tokenData).substring(0, 200));

    if (!tokenRes.ok) {
      return {
        statusCode: tokenRes.status,
        body: JSON.stringify({ error: tokenData.message || 'Token refresh failed.', details: tokenData }),
      };
    }

    const accessToken = tokenData.access_token;

    // Step 2: Fetch activities from start of last year
    const now = new Date();
    const after = Math.floor(new Date(now.getFullYear() - 1, 0, 1).getTime() / 1000);

    const activities = [];
    let page = 1;

    while (true) {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      console.log(`Activities page ${page} status:`, res.status);

      if (!res.ok) {
        return {
          statusCode: res.status,
          body: JSON.stringify({ error: `Strava activities fetch failed: ${res.status}` }),
        };
      }

      const batch = await res.json();
      if (!batch.length) break;

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

    console.log(`Returning ${activities.length} activities`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities }),
    };
  } catch (err) {
    console.error('Caught error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
