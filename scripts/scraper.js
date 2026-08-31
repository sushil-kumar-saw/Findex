/**
 * Findex Problem Scraper & Ingestion Engine
 * Fetches real DSA problems from LeetCode GraphQL API and Codeforces REST API.
 */

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/problems.json");

// Ensure data directory exists
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Fetch LeetCode problems via LeetCode public GraphQL endpoint
 */
async function fetchLeetCode(limit = 60) {
  console.log("[Scraper] Fetching top " + limit + " LeetCode problems...");
  const query = `
    query problemsetQuestionList($limit: Int, $skip: Int, $filters: QuestionFilterInput) {
      problemsetQuestionListV2(limit: $limit, skip: $skip, filters: $filters) {
        totalLength
        questions {
          frontendQuestionId
          title
          titleSlug
          difficulty
          topicTags {
            name
            slug
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)"
      },
      body: JSON.stringify({
        query,
        variables: { limit, skip: 0, filters: {} }
      })
    });

    if (!response.ok) throw new Error("LeetCode HTTP error " + response.status);

    const json = await response.json();
    const questions = json?.data?.problemsetQuestionListV2?.questions || [];

    return questions.map((q) => ({
      id: "lc-" + q.frontendQuestionId,
      judge: "LeetCode",
      judgeSlug: "leetcode",
      problemId: q.frontendQuestionId,
      title: q.frontendQuestionId + ". " + q.title,
      titleSlug: q.titleSlug,
      url: "https://leetcode.com/problems/" + q.titleSlug + "/",
      difficulty: q.difficulty,
      rating: q.difficulty === "Hard" ? 2100 : q.difficulty === "Medium" ? 1600 : 1100,
      tags: (q.topicTags || []).map((t) => t.name),
      patterns: (q.topicTags || []).map((t) => t.slug),
      statement: "LeetCode " + q.difficulty + " problem: " + q.title + ". Involves " + ((q.topicTags || []).map(t => t.name).join(", ") || "data structures and algorithms") + "."
    }));
  } catch (err) {
    console.warn("[Scraper] LeetCode fetch warning (" + err.message + ").");
    return [];
  }
}

/**
 * Fetch Codeforces problems via official Codeforces API
 */
async function fetchCodeforces(count = 60) {
  console.log("[Scraper] Fetching rated problems from Codeforces API...");
  try {
    const res = await fetch("https://codeforces.com/api/problemset.problems");
    if (!res.ok) throw new Error("Codeforces HTTP error " + res.status);

    const data = await res.json();
    if (data.status !== "OK") throw new Error(data.comment || "Failed to load Codeforces data");

    const problems = data.result.problems || [];
    const rated = problems.filter((p) => p.rating && p.rating >= 1300);

    return rated.slice(0, count).map((p) => {
      const diff = p.rating >= 2000 ? "Hard" : p.rating >= 1500 ? "Medium" : "Easy";
      return {
        id: "cf-" + p.contestId + "-" + p.index,
        judge: "Codeforces",
        judgeSlug: "codeforces",
        problemId: p.contestId + p.index,
        title: p.contestId + p.index + " - " + p.name,
        titleSlug: p.contestId + "-" + p.index,
        url: "https://codeforces.com/problemset/problem/" + p.contestId + "/" + p.index,
        difficulty: diff,
        rating: p.rating,
        tags: p.tags || [],
        patterns: (p.tags || []).map((t) => t.toLowerCase().replace(/\s+/g, "-")),
        statement: "Codeforces Div contest problem rated " + p.rating + ". Topics include: " + ((p.tags || []).join(", ") || "algorithms") + "."
      };
    });
  } catch (err) {
    console.warn("[Scraper] Codeforces fetch warning (" + err.message + ").");
    return [];
  }
}

/**
 * Main Ingestion execution
 */
async function runScraper() {
  console.log("=== Findex Scraper Starting ===");
  const [lc, cf] = await Promise.all([
    fetchLeetCode(60),
    fetchCodeforces(60)
  ]);

  let existing = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (e) {}
  }

  const map = new Map();
  existing.forEach((p) => map.set(p.id, p));
  lc.forEach((p) => map.set(p.id, p));
  cf.forEach((p) => map.set(p.id, p));

  const merged = Array.from(map.values());
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2), "utf-8");
  console.log("=== Ingestion Complete! Saved " + merged.length + " problems to " + DATA_FILE + " ===");
  return merged;
}

if (require.main === module) {
  runScraper()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Scraping error:", err);
      process.exit(1);
    });
}

module.exports = {
  fetchLeetCode,
  fetchCodeforces,
  runScraper
};
