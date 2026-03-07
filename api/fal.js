// api/fal.js — Vercel serverless function
// Proxies all FAL API calls so the API key never reaches the browser.
//
// Setup: add FAL_API_KEY to Vercel environment variables
// (Dashboard → Project → Settings → Environment Variables)

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const FAL_KEY = process.env.FAL_API_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ error: 'FAL_API_KEY not configured' });
  }

  const { action, payload } = req.body;

  try {
    let falUrl, falOptions;

    if (action === 'upload') {
      // File upload — payload.dataUrl is a base64 data URL
      const { dataUrl } = payload;
      const base64 = dataUrl.split(',')[1];
      const mimeType = dataUrl.split(';')[0].split(':')[1];
      const buffer = Buffer.from(base64, 'base64');

      // Convert to blob-like for FormData
      const { FormData, Blob } = await import('node-fetch').then(m => m).catch(() => {
        // node 18+ has native fetch/FormData
        return { FormData: global.FormData, Blob: global.Blob };
      });

      // Use native Node 18 FormData
      const formData = new FormData();
      const blob = new Blob([buffer], { type: mimeType });
      formData.append('file', blob, 'jewelry.jpg');

      const uploadRes = await fetch('https://fal.run/fal-ai/any/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Key ' + FAL_KEY },
        body: formData,
      });

      if (!uploadRes.ok) {
        // Return null url — client will fall back to data URL
        return res.status(200).json({ url: null });
      }

      const data = await uploadRes.json();
      return res.status(200).json({ url: data.url });

    } else if (action === 'birefnet') {
      falUrl = 'https://fal.run/fal-ai/birefnet-v2';
      falOptions = {
        method: 'POST',
        headers: {
          'Authorization': 'Key ' + FAL_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      };

    } else if (action === 'generate') {
      falUrl = 'https://fal.run/fal-ai/nano-banana-2/edit';
      falOptions = {
        method: 'POST',
        headers: {
          'Authorization': 'Key ' + FAL_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      };

    } else {
      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    const falRes = await fetch(falUrl, falOptions);
    const data = await falRes.json();

    if (!falRes.ok) {
      return res.status(falRes.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('FAL proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
