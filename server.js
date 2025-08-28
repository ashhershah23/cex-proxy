import express from "express";
import fetchOrig from "node-fetch";

const fetch = fetchOrig; // node-fetch v3 ESM

const app = express();

app.get("/", (req, res) => {
  res.type("text/plain").send("CeX proxy OK. Use /cex?q=your+search");
});

app.get("/cex", async (req, res) => {
  const q = (req.query.q || "").toString();
  if (!q) return res.status(400).json({ error: "missing q" });

  const cexUrl = "https://wss2.cex.uk.webuy.io/v3/boxes?q=" + encodeURIComponent(q);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(cexUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "en-GB,en;q=0.9"
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!r.ok) return res.status(200).json({ error: "cex_" + r.status });

    const data = await r.json();
    const boxes = data?.data?.boxes ?? [];
    if (!boxes.length) return res.json({ error: "no_match" });

    let best = boxes[0], bestScore = -1;
    for (const b of boxes) {
      const title = (b.boxName || "").toLowerCase();
      let score = 0;
      if (title.includes(q.toLowerCase())) score += 2;
      score += (Number(b.cashPrice || 0) / 1000);
      if (score > bestScore) { bestScore = score; best = b; }
    }

    res.set("Access-Control-Allow-Origin", "*").json({
      title: best.boxName ?? null,
      boxId: best.boxId ?? null,
      sell: best.sellPrice ?? null,
      cash: best.cashPrice ?? null,
      exchange: best.exchangePrice ?? null,
      url: best.boxId ? `https://uk.webuy.com/product-detail?id=${best.boxId}` : null
    });
  } catch (e) {
    const msg = e?.name === "AbortError" ? "timeout" : String(e);
    res.status(200).json({ error: msg });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("listening on " + port));
Add server.js
