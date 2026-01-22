import supabase from "../lib/supabase";

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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1️⃣ Get file name
    const fileName =
      req.headers["x-file-name"] || `upload-${Date.now()}`;

    // 2️⃣ Read raw binary body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 3️⃣ Upload to Bunny Storage
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

    // 4️⃣ Generate share token
    const token = Math.random().toString(36).slice(2, 8);

    // 5️⃣ Save metadata to Supabase
    await supabase.from("shares").insert({
      token,
      files: [
        {
          name: fileName,
          size: buffer.length,
          bunny_url: `${process.env.BUNNY_CDN_URL}/${fileName}`,
        },
      ],
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // 6️⃣ Return token ONLY (no Bunny URL)
    res.status(200).json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
