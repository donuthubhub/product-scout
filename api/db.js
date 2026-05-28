const GAS_URL = "https://script.google.com/macros/s/AKfycbxSb5rEDLzOU27Wttakw9cQ7jFcSz_8FZmMsjpi68lQxRFGXK2w8AuD_cZvpGoUkko9Xg/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const { key } = req.query;
      const response = await fetch(`${GAS_URL}?key=${encodeURIComponent(key)}`);
      const data = await response.json();
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const response = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: { "Content-Type": "text/plain" },
      });
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
