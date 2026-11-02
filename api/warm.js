// Cache warmer — keeps the schedule cache populated so real visitors never
// wait on a cold upstream fan-out ("slow first load after inactivity").
//
// It simply requests /api/events for every date in the app's date strip
// (yesterday … +8 days). Each request populates or refreshes the Supabase
// cache; the warmer itself absorbs any slow fan-out latency, not the user.
//
// Triggered by:
//   • a Vercel Cron (see vercel.json "crons"), and/or
//   • an external uptime pinger (cron-job.org, UptimeRobot, …) hitting
//     https://sportzone.is/api/warm every ~10 minutes for extra freshness.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'sportzone.is';
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const base = `${proto}://${host}`;

  // Build the same date range the frontend shows (UTC, yesterday … +8)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dates = [];
  for (let i = -1; i <= 8; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const results = [];
  for (const date of dates) {
    try {
      const r = await fetch(`${base}/api/events?date=${date}`);
      const j = await r.json();
      results.push({ date, events: Array.isArray(j.events) ? j.events.length : 0, cached: !!j.cached });
    } catch (err) {
      results.push({ date, error: err.message });
    }
  }

  res.status(200).json({ ok: true, warmed: results.length, at: new Date().toISOString(), results });
}
