/**
 * Findex v2.0 Client Application Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  let bookmarks = JSON.parse(localStorage.getItem("findex_bookmarks") || "[]");
  let doneList = JSON.parse(localStorage.getItem("findex_done") || "[]");
  let currentPattern = "";
  let currentMode = "keyword";
  let activeCardIndex = -1;

  // DOM Elements
  const form = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const clearInputBtn = document.getElementById("clear-input-btn");
  const judgeSelect = document.getElementById("judge-select");
  const compareToggle = document.getElementById("compare-toggle");
  const modeChips = document.querySelectorAll(".mode-chip");
  const statusText = document.getElementById("status-text");
  
  // Views
  const resultsView = document.getElementById("results-view");
  const resultsList = document.getElementById("results-list");
  const compareView = document.getElementById("compare-view");
  const kwResultsList = document.getElementById("kw-results-list");
  const meaningResultsList = document.getElementById("meaning-results-list");
  const kwLatencyBadge = document.getElementById("kw-latency-badge");
  const meaningLatencyBadge = document.getElementById("meaning-latency-badge");

  // Counters
  const statStarred = document.getElementById("stat-starred");
  const statDone = document.getElementById("stat-done");
  const chipBookmarksCount = document.getElementById("chip-bookmarks-count");
  const chipDoneCount = document.getElementById("chip-done-count");
  const shellCwd = document.getElementById("shell-cwd");

  // Filter Pill
  const filterPillContainer = document.getElementById("filter-pill-container");
  const activeFilterBadge = document.getElementById("active-filter-badge");
  const clearFilterBtn = document.getElementById("clear-filter-btn");

  // Action Buttons
  const themeToggle = document.getElementById("theme-toggle");
  const scrapeBtn = document.getElementById("scrape-btn");
  const helpBtn = document.getElementById("help-btn");
  const helpModal = document.getElementById("help-modal");
  const closeHelpBtn = document.getElementById("close-help-btn");
  const taxonomyChips = document.querySelectorAll(".taxonomy-chip");
  const shellChips = document.querySelectorAll(".shell-chip");

  // Initialize
  updateCounters();
  initTheme();

  // Search Input Input / Clear button visibility
  searchInput.addEventListener("input", () => {
    if (searchInput.value.trim().length > 0) {
      clearInputBtn.classList.remove("hidden");
    } else {
      clearInputBtn.classList.add("hidden");
    }
  });

  clearInputBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearInputBtn.classList.add("hidden");
    searchInput.focus();
    executeSearch();
  });

  // Search Form Submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query.startsWith(":")) {
      handleCommand(query);
      return;
    }
    executeSearch();
  });

  // Mode Chips Switcher
  modeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      modeChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentMode = chip.dataset.mode;
      executeSearch();
    });
  });

  // Judge Filter Change
  judgeSelect.addEventListener("change", () => executeSearch());

  // Compare Toggle
  compareToggle.addEventListener("change", () => {
    if (compareToggle.checked) {
      resultsView.classList.add("hidden");
      compareView.classList.remove("hidden");
    } else {
      resultsView.classList.remove("hidden");
      compareView.classList.add("hidden");
    }
    executeSearch();
  });

  // Taxonomy Chips Click
  taxonomyChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      setPatternFilter(chip.dataset.pat);
    });
  });

  // Clear Filter Button
  clearFilterBtn.addEventListener("click", () => {
    setPatternFilter("");
  });

  // Shell Command Chips
  shellChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      handleCommand(chip.dataset.cmd);
    });
  });

  // Scraper / Ingestion Trigger
  scrapeBtn.addEventListener("click", async () => {
    scrapeBtn.disabled = true;
    scrapeBtn.innerHTML = "<span class=\"sync-icon\">⟳</span> syncing...";
    setStatus("Scraping live rated problems from Codeforces & LeetCode APIs...");

    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatus(`✓ Sync complete! Index now contains ${data.count} problems.`);
        document.getElementById("stat-total").textContent = data.count;
        executeSearch();
      } else {
        setStatus(`Sync note: ${data.error || "failed"}`);
      }
    } catch (e) {
      setStatus("Error during sync: " + e.message);
    } finally {
      scrapeBtn.disabled = false;
      scrapeBtn.innerHTML = "<span class=\"sync-icon\">⟳</span> sync corpus";
    }
  });

  // Help Modal Toggle
  helpBtn.addEventListener("click", () => helpModal.classList.toggle("hidden"));
  closeHelpBtn.addEventListener("click", () => helpModal.classList.add("hidden"));

  // Keyboard Shortcuts (⌘K, /, Esc, Arrow Navigation)
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === "Escape") {
      if (!helpModal.classList.contains("hidden")) {
        helpModal.classList.add("hidden");
      } else if (searchInput.value) {
        searchInput.value = "";
        clearInputBtn.classList.add("hidden");
        executeSearch();
      }
    } else if (e.key === "ArrowDown" && document.activeElement !== searchInput) {
      navigateCards(1);
    } else if (e.key === "ArrowUp" && document.activeElement !== searchInput) {
      navigateCards(-1);
    }
  });

  // Main Search Function
  async function executeSearch() {
    const query = searchInput.value.trim();
    const judge = judgeSelect.value;
    const isCompare = compareToggle.checked;

    shellCwd.textContent = query ? `~/search "${query}"` : "~";
    setStatus("searching indexed corpus...");
    activeCardIndex = -1;

    if (isCompare) {
      try {
        const [kwRes, meaningRes] = await Promise.all([
          fetch(`/search?question=${encodeURIComponent(query)}&mode=keyword&pattern=${encodeURIComponent(currentPattern)}&judge=${judge}`).then(r => r.json()),
          fetch(`/search?question=${encodeURIComponent(query)}&mode=meaning&pattern=${encodeURIComponent(currentPattern)}&judge=${judge}`).then(r => r.json())
        ]);

        kwLatencyBadge.textContent = `${kwRes.latencyMs}ms (${kwRes.total} hits)`;
        meaningLatencyBadge.textContent = `${meaningRes.latencyMs}ms (${meaningRes.total} hits)`;

        renderCards(kwRes.results, kwResultsList);
        renderCards(meaningRes.results, meaningResultsList);

        setStatus(`compared: keyword (${kwRes.latencyMs}ms) vs meaning (${meaningRes.latencyMs}ms)`);
      } catch (err) {
        setStatus("Search error: " + err.message);
      }
    } else {
      try {
        const res = await fetch(`/search?question=${encodeURIComponent(query)}&mode=${currentMode}&pattern=${encodeURIComponent(currentPattern)}&judge=${judge}`);
        const data = await res.json();

        let statusMsg = `${data.latencyMs}ms · ${data.total} results · mode: ${data.mode}`;
        if (data.appliedExpansion) {
          statusMsg += ` · +expansion: [${data.appliedExpansion}]`;
        }
        setStatus(statusMsg);
        renderCards(data.results, resultsList);
      } catch (err) {
        setStatus("Search error: " + err.message);
      }
    }
  }

  // Handle Shell Commands
  function handleCommand(cmd) {
    if (cmd === ":bookmarks" || cmd === ":b") {
      shellCwd.textContent = "~/bookmarks";
      renderSavedCards(bookmarks, "No bookmarked problems yet. Click ★ on any problem to save it.");
    } else if (cmd === ":done" || cmd === ":d") {
      shellCwd.textContent = "~/done";
      renderSavedCards(doneList, "No solved problems yet. Click ✓ on any problem when you solve it.");
    } else if (cmd === ":all") {
      searchInput.value = "";
      setPatternFilter("");
      executeSearch();
    } else if (cmd === ":clear") {
      searchInput.value = "";
      setPatternFilter("");
      executeSearch();
    } else if (cmd === ":help" || cmd === ":?") {
      helpModal.classList.remove("hidden");
    } else if (cmd === ":scrape") {
      scrapeBtn.click();
    }
  }

  function setPatternFilter(pat) {
    currentPattern = pat;
    if (pat) {
      filterPillContainer.classList.remove("hidden");
      activeFilterBadge.textContent = "#" + pat;
    } else {
      filterPillContainer.classList.add("hidden");
      activeFilterBadge.textContent = "";
    }
    executeSearch();
  }

  // Card Rendering
  function renderCards(list, container) {
    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="empty-results-box">
          <p class="empty-title">No matching problems found</p>
          <span class="empty-desc">Try broader terms (e.g. "array", "graph", "tree") or clear the judge/pattern filter.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map((item) => {
      const isBookmarked = bookmarks.some((b) => b.id === item.id);
      const isDone = doneList.some((d) => d.id === item.id);
      const diffClass = item.difficulty ? `diff-${item.difficulty.toLowerCase()}` : "diff-medium";
      const judgeSlug = (item.judgeSlug || item.judge || "cf").toLowerCase();

      return `
        <article class="problem-card" data-id="${item.id}">
          <div class="card-header-row">
            <div class="card-title-container">
              <span class="judge-tag judge-${judgeSlug}">${item.judge || "OJ"}</span>
              <a class="card-heading-link" href="${item.url}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(item.title)}
                <span class="ext-arrow">↗</span>
              </a>
            </div>
            <div class="card-meta-badges">
              ${item.difficulty ? `<span class="difficulty-badge ${diffClass}">${item.difficulty}${item.rating ? " (" + item.rating + ")" : ""}</span>` : ""}
            </div>
          </div>

          <p class="card-desc-body">${escapeHtml(item.statement || "")}</p>

          <div class="card-footer-row">
            <div class="card-patterns-list">
              ${(item.patterns || item.tags || []).slice(0, 4).map(t => `
                <span class="pattern-tag-item" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>
              `).join("")}
            </div>

            <div class="card-actions-group">
              <button type="button" class="card-btn card-btn-star ${isBookmarked ? "active-star" : ""}" data-id="${item.id}" title="Star / Save Problem">
                ★ <span>${isBookmarked ? "Saved" : "Star"}</span>
              </button>
              <button type="button" class="card-btn card-btn-done ${isDone ? "active-done" : ""}" data-id="${item.id}" title="Mark Problem as Solved">
                ✓ <span>${isDone ? "Solved" : "Done"}</span>
              </button>
              <button type="button" class="card-btn card-btn-similar" data-id="${item.id}" title="Find Nearest Technique Neighbors">
                ≈ <span>Similar</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    attachListeners(container, list);
  }

  function attachListeners(container, currentList) {
    // Star toggle
    container.querySelectorAll(".card-btn-star").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const item = currentList.find((p) => p.id === id) || bookmarks.find(b => b.id === id);
        if (!item) return;

        const idx = bookmarks.findIndex((b) => b.id === id);
        if (idx >= 0) {
          bookmarks.splice(idx, 1);
          btn.classList.remove("active-star");
          btn.querySelector("span").textContent = "Star";
        } else {
          bookmarks.push(item);
          btn.classList.add("active-star");
          btn.querySelector("span").textContent = "Saved";
        }
        localStorage.setItem("findex_bookmarks", JSON.stringify(bookmarks));
        updateCounters();
      });
    });

    // Done toggle
    container.querySelectorAll(".card-btn-done").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const item = currentList.find((p) => p.id === id) || doneList.find(d => d.id === id);
        if (!item) return;

        const idx = doneList.findIndex((d) => d.id === id);
        if (idx >= 0) {
          doneList.splice(idx, 1);
          btn.classList.remove("active-done");
          btn.querySelector("span").textContent = "Done";
        } else {
          doneList.push(item);
          btn.classList.add("active-done");
          btn.querySelector("span").textContent = "Solved";
        }
        localStorage.setItem("findex_done", JSON.stringify(doneList));
        updateCounters();
      });
    });

    // Find Similar
    container.querySelectorAll(".card-btn-similar").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        setStatus("computing nearest pattern vectors...");
        try {
          const res = await fetch(`/similar?id=${encodeURIComponent(id)}`);
          const data = await res.json();
          setStatus(`found ${data.results.length} similar problems for "${data.target.title}" (${data.latencyMs}ms)`);
          renderCards(data.results, resultsList);
        } catch (e) {
          setStatus("Error finding similar: " + e.message);
        }
      });
    });

    // Pattern click
    container.querySelectorAll(".pattern-tag-item").forEach((tagSpan) => {
      tagSpan.addEventListener("click", () => {
        setPatternFilter(tagSpan.dataset.tag);
      });
    });
  }

  function renderSavedCards(list, emptyMsg) {
    if (!list || list.length === 0) {
      resultsList.innerHTML = `<div class="empty-results-box"><p class="empty-title">${emptyMsg}</p></div>`;
      setStatus(`0 items in active list`);
      return;
    }
    setStatus(`displaying ${list.length} saved items`);
    renderCards(list, resultsList);
  }

  function navigateCards(dir) {
    const cards = resultsList.querySelectorAll(".problem-card");
    if (!cards.length) return;

    if (activeCardIndex >= 0 && cards[activeCardIndex]) {
      cards[activeCardIndex].classList.remove("selected-card");
    }

    activeCardIndex = Math.max(0, Math.min(cards.length - 1, activeCardIndex + dir));
    cards[activeCardIndex].classList.add("selected-card");
    cards[activeCardIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function updateCounters() {
    statStarred.textContent = bookmarks.length;
    statDone.textContent = doneList.length;
    chipBookmarksCount.textContent = bookmarks.length;
    chipDoneCount.textContent = doneList.length;
  }

  function setStatus(msg) {
    statusText.textContent = msg;
  }

  function initTheme() {
    const savedTheme = localStorage.getItem("findex_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("findex_theme", next);
      updateThemeIcon(next);
    });
  }

  function updateThemeIcon(theme) {
    const icon = document.getElementById("theme-icon");
    icon.textContent = theme === "dark" ? "☼" : "☾";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Trigger initial search
  executeSearch();
});
