import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
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

    // ================================
    // GET SHARES DATA
    // ================================
    const { data: shares } = await supabase
      .from("shares")
      .select("*");

    const safeShares = shares || [];
    const totalFiles = safeShares.length;
    const totalLinks = totalFiles;
    const totalUsers = totalFiles; // FUTURE: replace with distinct users

    // ================================
    // R2 GRAPHQL QUERY
    // ================================
    const query = `
    {
      viewer {
        accounts(filter: {accountTag: "${process.env.R2_ACCOUNT_ID}"}) {
          r2StorageAdaptiveGroups(limit: 1) {
            sum {
              payloadSize
            }
          }
          r2OperationsAdaptiveGroups(limit: 1) {
            sum {
              classA
              classB
            }
          }
        }
      }
    }`;

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

    const result = await response.json();

    const accountData =
      result?.data?.viewer?.accounts?.[0] || {};

    const storageBytes =
      accountData?.r2StorageAdaptiveGroups?.[0]?.sum
        ?.payloadSize || 0;

    const classAOps =
      accountData?.r2OperationsAdaptiveGroups?.[0]?.sum
        ?.classA || 0;

    const classBOps =
      accountData?.r2OperationsAdaptiveGroups?.[0]?.sum
        ?.classB || 0;

    // ================================
    // STORAGE FORMAT
    // ================================
    let storageUsedFormatted;
    let storageUsedGB = storageBytes / 1024 / 1024 / 1024;

    if (storageUsedGB >= 1) {
      storageUsedFormatted =
        storageUsedGB.toFixed(2) + " GB";
    } else {
      storageUsedFormatted =
        (storageBytes / 1024 / 1024).toFixed(2) + " MB";
    }

    // ================================
    // AVERAGE STORAGE PER FILE
    // ================================
    const averageStorage =
      totalFiles > 0
        ? storageBytes / totalFiles
        : 0;

    const averageStorageFormatted =
      averageStorage > 1024 * 1024 * 1024
        ? (averageStorage / 1024 / 1024 / 1024).toFixed(2) +
          " GB"
        : (averageStorage / 1024 / 1024).toFixed(2) +
          " MB";

    // ================================
    // LAST 24 HOURS FROM SHARES
    // ================================
    const now = new Date();
    const last24 = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    );

    const linksLast24h = safeShares.filter(
      (s) => new Date(s.created_at) >= last24
    ).length;

    // ================================
    // RECENT ACTIVITY
    // ================================
    const recentActivity = safeShares
      .sort(
        (a, b) =>
          new Date(b.created_at) -
          new Date(a.created_at)
      )
      .slice(0, 10)
      .map((s) => ({
        type: "link_generated",
        file: s.file_name,
        token: s.token,
        time: new Date(s.created_at).toLocaleString(),
      }));

    return res.status(200).json({
      totalUsers,
      totalFiles,
      totalLinks,
      linksLast24h,
      liveUsers: 12, // mock

      storageUsedFormatted,
      averageStorageFormatted,

      classAOps,
      classBOps,

      recentActivity,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
    });
  }
}