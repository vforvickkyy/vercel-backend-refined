import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {

  // ✅ ADD THIS BLOCK
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { key, fileName } = req.query;

    if (!key || !fileName) {
      return res.status(400).json({ error: "Missing params" });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 60,
    });

    return res.status(200).json({ url: signedUrl });

  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}