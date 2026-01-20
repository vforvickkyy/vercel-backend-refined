export const config = {
  runtime: "nodejs",
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-file-name");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const fileName =
      req.headers["x-file-name"] || `upload-${Date.now()}`;

    // Read raw binary body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const uploadUrl = `https://storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/${fileName}`;

    const bunnyRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: process.env.BUNNY_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    });

    if (!bunnyRes.ok) {
      const text = await bunnyRes.text();
      throw new Error(text || "Bunny upload failed");
    }

    res.status(200).json({
      link: `${process.env.BUNNY_CDN_URL}/${fileName}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

