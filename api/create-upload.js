export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { files } = req.body; // 👈 now expect array of files

    const token = generateToken();

    const uploadUrls = [];
    const publicFiles = [];

    for (const file of files) {
      const objectKey = `${token}/${file.fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
        ContentType: file.fileType,
      });

      const uploadUrl = await getSignedUrl(s3, command, {
        expiresIn: 60 * 5,
      });

      const publicUrl = `${process.env.R2_PUBLIC_URL}/${objectKey}`;

      uploadUrls.push({
        fileName: file.fileName,
        uploadUrl,
      });

      publicFiles.push({
        token,
        file_name: file.fileName,
        file_size: file.fileSize,
        file_url: publicUrl,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      });
    }

    // 🔥 INSERT ALL FILES AT ONCE
    await supabase.from("shares").insert(publicFiles);

    res.status(200).json({
      token,
      uploadUrls,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
