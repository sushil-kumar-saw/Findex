/**
 * Script to import and merge problems from az-dsa-search-engine dataset
 * into Findex's primary question store (data/problems.json).
 */

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/problems.json");
const SCRATCH_AZ_CORPUS = path.join(__dirname, "../../../brain/13228ee5-07f3-4549-9eed-f502c863968d/scratch/az_engine/corpus/all_problems.json");
const LOCAL_AZ_CORPUS = path.join(__dirname, "../data/az_all_problems.json");

const KNOWN_PATTERNS = {
  "dynamic programming": "dynamic-programming",
  "dp": "dynamic-programming",
  "subsequence": "subsequence",
  "substring": "string",
  "tree": "tree",
  "binary tree": "binary-tree",
  "bst": "binary-search-tree",
  "graph": "graph",
  "dijkstra": "dijkstra",
  "shortest path": "shortest-path",
  "bfs": "bfs",
  "dfs": "dfs",
  "topological": "topological-sort",
  "array": "array",
  "matrix": "matrix",
  "grid": "grid",
  "string": "string",
  "two pointers": "two-pointers",
  "sliding window": "sliding-window",
  "binary search": "binary-search",
  "stack": "stack",
  "monotonic stack": "monotonic-stack",
  "queue": "queue",
  "heap": "heap",
  "priority queue": "priority-queue",
  "greedy": "greedy",
  "bit manipulation": "bit-manipulation",
  "bitwise": "bit-manipulation",
  "math": "math",
  "number theory": "number-theory",
  "prime": "number-theory",
  "gcd": "number-theory",
  "modulo": "math",
  "combinatorics": "combinatorics",
  "segment tree": "segment-tree",
  "fenwick": "fenwick-tree",
  "union find": "union-find",
  "disjoint set": "union-find",
  "dsu": "union-find",
  "trie": "trie",
  "game theory": "game-theory",
  "divide and conquer": "divide-and-conquer",
  "backtracking": "backtracking",
  "recursion": "recursion",
  "linked list": "linked-list"
};

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\\leq|\\le/g, "≤")
    .replace(/\\geq|\\ge/g, "≥")
    .replace(/\\neq|\\ne/g, "≠")
    .replace(/\\dots|\\ldots/g, "...")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1/$2)")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\mathbf\{([^}]+)\}/g, "$1")
    .replace(/\\mathit\{([^}]+)\}/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/Copy/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferTags(title, desc) {
  const combined = (title + " " + desc).toLowerCase();
  const tags = new Set();
  const patterns = new Set();

  for (const [key, slug] of Object.entries(KNOWN_PATTERNS)) {
    if (combined.includes(key)) {
      const formattedTag = key.charAt(0).toUpperCase() + key.slice(1);
      tags.add(formattedTag);
      patterns.add(slug);
    }
  }

  if (tags.size === 0) {
    tags.add("Algorithms");
    patterns.add("algorithms");
  }

  return {
    tags: Array.from(tags).slice(0, 5),
    patterns: Array.from(patterns).slice(0, 5)
  };
}

async function mergeCorpus() {
  console.log("=== Importing Problems from az-dsa-search-engine ===");
  
  let azPath = fs.existsSync(LOCAL_AZ_CORPUS) ? LOCAL_AZ_CORPUS : SCRATCH_AZ_CORPUS;
  if (!fs.existsSync(azPath)) {
    console.error("Error: Could not locate az_all_problems.json source file.");
    process.exit(1);
  }

  const rawAz = JSON.parse(fs.readFileSync(azPath, "utf-8"));
  let currentProblems = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      currentProblems = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (e) {}
  }

  const map = new Map();
  currentProblems.forEach((p) => {
    if (p.url) map.set(p.url.toLowerCase(), p);
    if (p.id) map.set(p.id.toLowerCase(), p);
  });

  let addedCount = 0;
  rawAz.forEach((raw, i) => {
    let url = (raw.url || "").trim();
    if (!url || !raw.title) return;

    if (url.includes("leetcode.com/problems/")) {
      url = url.split("?")[0].replace(/\/+$/, "") + "/";
    }

    const urlKey = url.toLowerCase();
    if (map.has(urlKey)) return;

    let judge = "Competitive Programming";
    let judgeSlug = "cp";
    let titleSlug = raw.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let id = "prob-" + titleSlug + "-" + i;
    let problemId = "" + i;
    let difficulty = "Medium";
    let rating = 1500;

    if (url.includes("leetcode.com")) {
      judge = "LeetCode";
      judgeSlug = "leetcode";
      const match = url.match(/problems\/([^\/]+)/);
      const slug = match ? match[1] : titleSlug;
      id = "lc-" + slug;
      problemId = slug;
      titleSlug = slug;
      difficulty = "Medium";
      rating = 1600;
    } else if (url.includes("codeforces.com")) {
      judge = "Codeforces";
      judgeSlug = "codeforces";
      const match = url.match(/problem\/([0-9]+)\/([a-zA-Z0-9]+)/i);
      if (match) {
        id = "cf-" + match[1] + "-" + match[2].toLowerCase();
        problemId = match[1] + match[2];
        titleSlug = match[1] + "-" + match[2].toLowerCase();
      } else {
        id = "cf-" + titleSlug;
        problemId = titleSlug;
      }
      difficulty = "Medium";
      rating = 1500;
    } else if (url.includes("cses.fi")) {
      judge = "CSES";
      judgeSlug = "cses";
      id = "cses-" + titleSlug;
    } else if (url.includes("atcoder.jp")) {
      judge = "AtCoder";
      judgeSlug = "atcoder";
      id = "atcoder-" + titleSlug;
    }

    if (map.has(id.toLowerCase())) return;

    const statement = cleanText(raw.description || "");
    const { tags, patterns } = inferTags(raw.title, statement);

    const problem = {
      id,
      judge,
      judgeSlug,
      problemId,
      title: raw.title.trim(),
      titleSlug,
      url,
      difficulty,
      rating,
      tags,
      patterns,
      statement: statement.slice(0, 1500)
    };

    map.set(urlKey, problem);
    map.set(id.toLowerCase(), problem);
    addedCount++;
  });

  // Extract unique items
  const mergedList = Array.from(new Set(Array.from(map.values())));
  fs.writeFileSync(DATA_FILE, JSON.stringify(mergedList, null, 2), "utf-8");
  console.log(`=== Import Complete! Added ${addedCount} new problems. Total: ${mergedList.length} problems saved to ${DATA_FILE} ===`);
  return mergedList;
}

if (require.main === module) {
  mergeCorpus()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { mergeCorpus };
