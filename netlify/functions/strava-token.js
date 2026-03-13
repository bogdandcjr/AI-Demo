// netlify/functions/strava-token.js
// Returns a fresh Strava access token using the stored refresh token.
// Never exposes client_secret or refresh_token to the browser.
//
// Set these in Netlify Dashboard → Site → Environment Variables:
//   STRAVA_CLIENT_ID     = 210913
//   STRAVA_CLIENT_SECRET = your client secret
//   STRAVA_REFRESH_TOKEN = the refresh_token from your curl response

exports.handler = async () => {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Strava environment variables on server.' }),
    };
  }

  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: STRAVA_REFRESH_TOKEN,
        grant_type:    'refresh_token',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data.message || 'Strava token refresh failed.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      // Only return the access_token — never send back secrets
      body: JSON.stringify({ access_token: data.access_token }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
