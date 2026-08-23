export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" },
  },
};

const PROMPT =
  "You are a technical analyst. Study this trading chart and recommend a trade. Identify visible support and resistance levels and the overall trend. Based on that, decide: should the trader BUY (long) or SELL (short) right now, and give a suggested entry price, stop-loss, and take-profit. Respond with ONLY a raw JSON object, no markdown fences, no other text: " +
  '{"instrument": string or null, "direction": "buy" or "sell", "entry": number, "stop_loss": number, "take_profit": number, "support": number or null, "resistance": number or null, "trend": string or null, "bias": string or null, "reasoning": string}. ' +
  "direction, entry, stop_loss, and take_profit must always be filled with your best recommendation based on the visible price action — do not return null for these. Keep reasoning to one short sentence explaining why.";


export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { base64, mediaType } = req.body || {};
  if (!base64 || !mediaType) {
    return res.status(400).json({ error: "Missing image data" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mediaType, data: base64 } },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      return res.status(502).json({ error: `Gemini API error ${geminiRes.status}: ${errBody.slice(0, 300)}` });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: "Empty response from Gemini", raw: data });
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({ error: "Could not parse AI response as JSON", raw: text });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected server error" });
  }
}
