import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ==========================
  // 🔥 ALWAYS SET CORS FIRST
  // ==========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // 🔥 PRE-FLIGHT MUST RETURN 200
  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  try {
    // ==========================
    // AUTH CHECK
    // ==========================
    if (req.headers.authorization !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ==========================
    // FETCH SHARES
    // ==========================
    const { data: shares, error } = await supabase
      .from("shares")
      .select("*");

    if (error) {
      return res.status(500).json({ message: "DB Error" });
    }

    const safeShares = shares || [];
    const totalFiles = safeShares.length;
    const totalLinks = totalFiles;
    const totalUsers = totalFiles; // future: distinct users

    // ==========================
    // CLOUDLFARE R2 GRAPHQL
    // ==========================
    let storageBytes = 0;
    let classAOps = 0;
    let classBOps = 0;

    try {
      const query = `
      {
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
      }`;

      const response = await fetch(
        "https://api.cloudflare.com/client/v4/graphql",
        {
          method: "POST",
          headers: {
            Authorization: \`Bearer ${process.env.CLOUDFLARE_API_TOKEN}\`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        }
      );

      const result = await response.json();

      const account =
        result?.data?.viewer?.accounts?.[0] || {};

      storageBytes =
        account?.r2StorageAdaptiveGroups?.[0]?.sum
          ?.payloadSize || 0;

      classAOps =
        account?.r2OperationsAdaptiveGroups?.[0]?.sum
          ?.classA || 0;

      classBOps =
        account?.r2OperationsAdaptiveGroups?.[0]?.sum
          ?.classB || 0;

    } catch (r2Error) {
      console.log("R2 analytics failed but continuing...");
    }

    // ==========================
    // STORAGE FORMAT
    // ==========================
    let storageUsedFormatted;

    const storageGB = storageBytes / 1024 / 1024 / 1024;

    if (storageGB >= 1) {
      storageUsedFormatted = storageGB.toFixed(2) + " GB";
    } else {
      storageUsedFormatted =
        (storageBytes / 1024 / 1024).toFixed(2) + " MB";
    }

    // ==========================
    // LAST 24 HOURS
    // ==========================
    const now = new Date();
    const last24 = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    );

    const linksLast24h = safeShares.filter(
      (s) => new Date(s.created_at) >= last24
    ).length;

    // ==========================
    // RECENT ACTIVITY
    // ==========================
    const recentActivity = safeShares
      .sort(
        (a, b) =>
          new Date(b.created_at) -
          new Date(a.created_at)
      )
      .slice(0, 10)
      .map((s) => ({
        file: s.file_name,
        token: s.token,
        time: new Date(s.created_at).toLocaleString(),
      }));

    return res.status(200).json({
      totalUsers,
      totalFiles,
      totalLinks,
      linksLast24h,
      liveUsers: 12,

      storageUsedFormatted,

      classAOps,
      classBOps,

      recentActivity,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}