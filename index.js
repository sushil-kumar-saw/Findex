const express = require("express");
const path = require("path");
const fs = require("fs");
const { runScraper } = require("./scripts/scraper");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setting up EJS View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data/problems.json");

// In-Memory Problem Corpus
let problemCorpus = [];

function loadCorpus() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      problemCorpus = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      console.log(`[Corpus] Loaded ${problemCorpus.length} problems into memory.`);
    } catch (e) {
      console.error("[Corpus] Error parsing problems.json:", e.message);
    }
  }
}
loadCorpus();

// Query Aliases & Concept Expansions (Inspired by Cosine)
const ALIASES = {
  "thief": ["house", "robber", "dynamic-programming"],
  "robber": ["house", "robber", "dynamic-programming"],
  "robbing": ["house", "robber", "dynamic-programming"],
  "aliens trick": ["wqs-binary-search", "slope-trick", "convex-hull"],
  "aliens": ["wqs-binary-search", "slope-trick"],
  "lca": ["lowest-common-ancestor", "binary-lifting", "tree"],
  "lis": ["longest-increasing-subsequence", "patience-sorting", "dynamic-programming"],
  "rain water": ["trapping-rain-water", "monotonic-stack", "two-pointers"],
  "water trap": ["trapping-rain-water", "monotonic-stack", "two-pointers"],
  "cycle": ["topological-sort", "cycle-detection", "graph", "dfs"],
  "dag": ["topological-sort", "graph-dp", "directed-acyclic-graph"],
  "knapsack": ["0-1-knapsack", "bounded-knapsack", "dynamic-programming"],
  "rmq": ["range-minimum-query", "segment-tree", "sparse-table"],
  "prefix sum": ["prefix-sum", "cumulative-sum", "range-queries"],
  "shortest path": ["dijkstra", "bfs", "bellman-ford", "shortest-path"],
  "disjoint set": ["union-find", "dsu", "connected-components"]
};

// Tokenizer helper
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// BM25-style Keyword Search
function scoreKeyword(problem, queryTerms) {
  let score = 0;
  const titleTokens = tokenize(problem.title);
  const statementTokens = tokenize(problem.statement);
  const tagTokens = (problem.tags || []).map(t => t.toLowerCase());
  const patternTokens = (problem.patterns || []).map(p => p.toLowerCase());

  queryTerms.forEach(term => {
    // Title exact word match
    if (titleTokens.includes(term)) score += 12;
    else if (problem.title.toLowerCase().includes(term)) score += 6;

    // Pattern / Deep Taxonomy match
    if (patternTokens.includes(term) || patternTokens.some(p => p.includes(term))) score += 10;

    // Tag match
    if (tagTokens.includes(term) || tagTokens.some(t => t.includes(term))) score += 8;

    // Statement / story description match
    if (statementTokens.includes(term)) score += 3;
    else if (problem.statement && problem.statement.toLowerCase().includes(term)) score += 1.5;
  });

  return score;
}

// Semantic / Meaning Search (Concept & Alias Expansion Scoring)
function scoreMeaning(problem, queryTerms, rawQuery) {
  let score = 0;
  let expandedTerms = [...queryTerms];
  const queryLower = rawQuery.toLowerCase().trim();

  // Check alias dictionary
  Object.keys(ALIASES).forEach(alias => {
    if (queryLower.includes(alias)) {
      expandedTerms.push(...ALIASES[alias]);
    }
  });

  const allTokens = [
    ...tokenize(problem.title),
    ...tokenize(problem.statement),
    ...(problem.tags || []).map(t => t.toLowerCase()),
    ...(problem.patterns || []).map(p => p.toLowerCase())
  ];

  expandedTerms.forEach(term => {
    if (allTokens.includes(term)) score += 5;
    else if (allTokens.some(tok => tok.includes(term) || term.includes(tok))) score += 2.5;
  });

  return score;
}

// Main Search Algorithm
function performSearch({ query = "", mode = "keyword", pattern = "", judge = "" }) {
  const startTime = process.hrtime.bigint();
  const queryLower = query.toLowerCase().trim();
  const queryTerms = tokenize(queryLower);

  // Check if any alias was triggered
  let appliedExpansion = null;
  Object.keys(ALIASES).forEach(alias => {
    if (queryLower.includes(alias)) {
      appliedExpansion = ALIASES[alias].join(" ");
    }
  });

  let pool = problemCorpus;

  // Filter by pattern if specified
  if (pattern) {
    const patLower = pattern.toLowerCase();
    pool = pool.filter(p => 
      (p.patterns && p.patterns.some(pat => pat.toLowerCase().includes(patLower))) ||
      (p.tags && p.tags.some(tag => tag.toLowerCase().includes(patLower)))
    );
  }

  // Filter by judge if specified
  if (judge && judge !== "all") {
    pool = pool.filter(p => p.judgeSlug === judge.toLowerCase() || p.judge.toLowerCase() === judge.toLowerCase());
  }

  if (!queryTerms.length && !pattern) {
    const defaultList = pool.slice(0, 15);
    const endTime = process.hrtime.bigint();
    const latencyMs = (Number(endTime - startTime) / 1e6).toFixed(2);
    return {
      results: defaultList,
      total: defaultList.length,
      mode,
      latencyMs,
      appliedExpansion
    };
  }

  const scored = pool.map(problem => {
    let kwScore = scoreKeyword(problem, queryTerms);
    let meaningScore = scoreMeaning(problem, queryTerms, query);

    let finalScore = 0;
    if (mode === "keyword") finalScore = kwScore;
    else if (mode === "meaning") finalScore = meaningScore;
    else finalScore = (kwScore * 0.6) + (meaningScore * 0.4); // Hybrid / Both

    return { ...problem, score: finalScore };
  });

  const matched = scored.filter(p => p.score > 0);
  matched.sort((a, b) => b.score - a.score);

  const finalResults = matched.length > 0 ? matched.slice(0, 20) : [];
  const endTime = process.hrtime.bigint();
  const latencyMs = (Number(endTime - startTime) / 1e6).toFixed(2);

  return {
    results: finalResults,
    total: finalResults.length,
    mode,
    latencyMs,
    appliedExpansion
  };
}

// Routes
app.get("/", (req, res) => {
  res.render("index", { totalProblems: problemCorpus.length });
});

app.get("/search", (req, res) => {
  const { question = "", mode = "keyword", pattern = "", judge = "" } = req.query;
  const data = performSearch({ query: question, mode, pattern, judge });
  res.json(data);
});

// Find Similar Problems (Cosine-inspired)
app.get("/similar", (req, res) => {
  const { id } = req.query;
  const target = problemCorpus.find(p => p.id === id);
  if (!target) return res.json({ results: [], latencyMs: "0.0" });

  const startTime = process.hrtime.bigint();
  const targetPatterns = new Set((target.patterns || []).concat(target.tags || []));

  const scored = problemCorpus
    .filter(p => p.id !== id)
    .map(p => {
      let sim = 0;
      (p.patterns || []).concat(p.tags || []).forEach(tag => {
        if (targetPatterns.has(tag)) sim += 3;
      });
      if (p.difficulty === target.difficulty) sim += 1;
      return { ...p, score: sim };
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const endTime = process.hrtime.bigint();
  const latencyMs = (Number(endTime - startTime) / 1e6).toFixed(2);

  res.json({ target, results: scored, latencyMs });
});

// Scrape Trigger Endpoint
app.post("/api/scrape", async (req, res) => {
  try {
    const updated = await runScraper();
    problemCorpus = updated;
    res.json({ success: true, count: updated.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Stats Endpoint
app.get("/api/stats", (req, res) => {
  const judges = {};
  const difficulties = {};
  problemCorpus.forEach(p => {
    judges[p.judge] = (judges[p.judge] || 0) + 1;
    difficulties[p.difficulty || "Unrated"] = (difficulties[p.difficulty || "Unrated"] || 0) + 1;
  });
  res.json({
    total: problemCorpus.length,
    judges,
    difficulties
  });
});

// Start Server
if (process.env.NODE_ENV !== "test" && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Findex server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
