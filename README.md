# Findex 🔍

A fast, terminal-inspired search engine for competitive programming and DSA problems across **LeetCode**, **Codeforces**, **CSES**, and **AtCoder**.

Search problems the way you think about them — by keyword, by concept/story (e.g., *"a thief robbing houses"*), or by deep algorithm technique (e.g., *"wqs binary search"*).

---

## ⚡ Core Features

- **Three Search Modes**:
  - **Keyword (`bm25`)**: Exact and partial term matching across titles, tags, and problem statements.
  - **Meaning (`semantic`)**: Plain English concept search with alias expansion (e.g., `"aliens trick"` $\rightarrow$ `+wqs-binary-search`, `"thief"` $\rightarrow$ `House Robber`).
  - **Both (`hybrid`)**: Weighted combination of keyword and semantic scoring.
- **Compare Rankers**: Side-by-side comparison mode to evaluate Keyword vs. Semantic results and latency in real time.
- **Find Similar Problems**: One-click (`≈ Similar`) nearest-neighbor recommendation based on shared patterns and difficulty.
- **Built-in Scrapers**:
  - Fetches live problems, tags, and ratings from **LeetCode GraphQL API** and **Codeforces REST API**.
  - Sync live problems directly from the UI (`⟳ sync corpus`) or CLI (`npm run scrape`).
- **Platform & Pattern Filtering**:
  - Filter by judge: **LeetCode**, **Codeforces**, **CSES**, **AtCoder**.
  - Filter by taxonomy tags: `#dynamic-programming`, `#segment-tree`, `#tree-dp`, `#topological-sort`, `#two-pointers`, etc.
- **Terminal Productivity & Local Tracking**:
  - Star / Bookmark problems (`:bookmarks` or `★`).
  - Mark solved problems (`:done` or `✓`).
  - Global shortcuts: <kbd>⌘</kbd> + <kbd>K</kbd> or <kbd>/</kbd> to search, <kbd>Esc</kbd> to clear, <kbd>↑</kbd> / <kbd>↓</kbd> to navigate cards.
  - Built-in manual: Type `:help` in search.
  - Dark / Light mode toggle.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend / Templating**: EJS, HTML5, Vanilla JavaScript (ES6+)
- **Styling**: Custom CSS3 (Monospace terminal & modern devtool theme)
- **Data & Ingestion**: LeetCode GraphQL API, Codeforces API, JSON corpus store

---


## 📜 API Endpoints

- `GET /search?question=<query>&mode=<keyword|meaning|both>&judge=<judge>&pattern=<pattern>` — Search ranked problems.
- `GET /similar?id=<problem_id>` — Retrieve nearest neighbor problems by pattern overlap.
- `POST /api/scrape` — Trigger live background ingestion pipeline.
- `GET /api/stats` — Return problem count by judge and difficulty distribution.
