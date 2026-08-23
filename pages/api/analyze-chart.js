export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" },
  },
};

const PROMPT =
  "Analyze this trading chart screenshot. Identify visible support and resistance levels, overall trend direction, and any visible entry/exit/stop-loss/take-profit price markers or lines. Respond with ONLY a raw JSON object, no markdown fences, no other text: " +
  '{"instrument": string or null, "direction": "long" or "short" or null, "entry": number or null, "exit": number or null, "stop_loss": number or null, "take_profit": number or null, "support": number or null, "resistance": number or null, "trend": string or null, "bias": string or null}. ' +
  "Use null for anything not visibly determinable on the chart. Never guess or invent a value.";

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
