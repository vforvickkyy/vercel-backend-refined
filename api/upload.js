import supabase from "../lib/supabase";

export const config = {
  runtime: "nodejs",
  api: {
    bodyParser: false,
  },
};

function generateToken(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-file-name"
  );

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

    const token = generateToken();

    const fileUrl = `${process.env.BUNNY_CDN_URL}/${fileName}`;

    const { error } = await supabase.from("shares").insert([
      {
        token,
        file_name: fileName,
        file_url: fileUrl,
        file_size: buffer.length,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      },
    ]);

    if (error) throw error;

    return res.status(200).json({
      token,
      shareLink: `/share/${token}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
