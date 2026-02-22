const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  // ================= CORS =================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.headers.authorization !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: shares, error } = await supabase
      .from("shares")
      .select("*");

    if (error) {
      return res.status(500).json({ message: "Database error" });
    }

    const safeShares = shares || [];
    const totalFiles = safeShares.length;

    const now = new Date();
    const last24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const linksLast24h = safeShares.filter(
      (s) => new Date(s.created_at) >= last24
    ).length;

    const storageLast24hBytes = safeShares
      .filter((s) => new Date(s.created_at) >= last24)
      .reduce((sum, s) => sum + (s.file_size || 0), 0);

    // ========== R2 ANALYTICS ==========
    let storageBytes = 0;
    let classAOps = 0;
    let classBOps = 0;

    try {
      if (
        process.env.CLOUDFLARE_API_TOKEN &&
        process.env.R2_ACCOUNT_ID
      ) {
        const query = `
        query {
          viewer {
            accounts(filter: {accountTag: "${process.env.R2_ACCOUNT_ID}"}) {
              r2StorageAdaptiveGroups(limit: 1) {
                sum { payloadSize }
              }
              r2OperationsAdaptiveGroups(limit: 1) {
                sum { classA classB }
              }
            }
          }
        }
        `;

        const response = await fetch(
          "https://api.cloudflare.com/client/v4/graphql",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
          }
        );

        const json = await response.json();

        if (json?.data?.viewer?.accounts?.length > 0) {
          const account = json.data.viewer.accounts[0];

          storageBytes =
            account?.r2StorageAdaptiveGroups?.[0]?.sum
              ?.payloadSize || 0;

          classAOps =
            account?.r2OperationsAdaptiveGroups?.[0]?.sum
              ?.classA || 0;

          classBOps =
            account?.r2OperationsAdaptiveGroups?.[0]?.sum
              ?.classB || 0;
        }
      }
    } catch (err) {
      console.log("R2 error:", err);
    }

    const formatBytes = (bytes) => {
      if (!bytes) return "0 MB";
      const gb = bytes / 1024 / 1024 / 1024;
      return gb >= 1
        ? gb.toFixed(2) + " GB"
        : (bytes / 1024 / 1024).toFixed(2) + " MB";
    };

    const recentActivity = safeShares
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map((s) => ({
        file: s.file_name,
        token: s.token,
        time: new Date(s.created_at).toLocaleString(),
      }));

    return res.status(200).json({
      totalFiles,
      totalLinks: totalFiles,
      totalUsers: totalFiles,
      liveUsers: 12,

      linksLast24h,
      storageLast24hFormatted: formatBytes(storageLast24hBytes),

      storageUsedFormatted: formatBytes(storageBytes),
      classAOps,
      classBOps,

      recentActivity,
    });
  } catch (err) {
    console.error("STATS CRASH:", err);
    return res.status(500).json({ message: "Server crash" });
  }
};