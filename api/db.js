const GAS_URL = "https://script.google.com/macros/s/AKfycbxt1yKcaGrnoArLtEc3JE8aFpIqFteqkWgy2i5Il5GA0j_AsKxs5pHo4ubjze94o-Hc/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      // Read: forward as GET
      const { key } = req.query;
      const response = await fetch(`${GAS_URL}?key=${encodeURIComponent(key)}`, { redirect: "follow" });
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return res.status(200).json(json);
      } catch {
        return res.status(500).json({ ok: false, error: "GAS returned non-JSON: " + text.slice(0, 100) });
      }
    }

    if (req.method === "POST") {
      // Write: use GET with action=set to avoid CORS preflight on GAS side
      const { key, value } = req.body;
      const encoded = encodeURIComponent(value);
      // Split large payloads into chunks if needed
      const url = `${GAS_URL}?action=set&key=${encodeURIComponent(key)}&value=${encoded}`;
      if (url.length > 7000) {
        // Too large for GET — use POST to GAS directly from server (no CORS issue server-side)
        const response = await fetch(GAS_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ key, value }),
          redirect: "follow",
        });
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          return res.status(200).json(json);
        } catch {
          return res.status(500).json({ ok: false, error: "GAS POST error: " + text.slice(0, 200) });
        }
      } else {
        const response = await fetch(url, { redirect: "follow" });
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          return res.status(200).json(json);
        } catch {
          // GET failed, fallback to POST
          const r2 = await fetch(GAS_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ key, value }),
            redirect: "follow",
          });
          const t2 = await r2.text();
          try { return res.status(200).json(JSON.parse(t2)); }
          catch { return res.status(500).json({ ok: false, error: "Both GET and POST failed: " + t2.slice(0,200) }); }
        }
      }
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
