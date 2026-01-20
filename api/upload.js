export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileName, fileBase64 } = req.body;

    if (!fileName || !fileBase64) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const uploadUrl = `https://storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/${fileName}`;

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: process.env.BUNNY_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(fileBase64, "base64"),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Bunny upload failed");
    }

    return res.status(200).json({
      link: `${process.env.BUNNY_CDN_URL}/${fileName}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

