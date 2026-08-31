// Client Application logic for Findex

document.addEventListener("DOMContentLoaded", () => {
  // State
  let bookmarks = JSON.parse(localStorage.getItem("findex_bookmarks") || "[]");
  let doneList = JSON.parse(localStorage.getItem("findex_done") || "[]");
  let currentPattern = "";

  // DOM Elements
  const form = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const modeSelect = document.getElementById("mode-select");
  const judgeSelect = document.getElementById("judge-select");
  const compareToggle = document.getElementById("compare-toggle");
  const statusText = document.getElementById("status-text");
  const resultsView = document.getElementById("results-view");
  const resultsList = document.getElementById("results-list");
  const compareView = document.getElementById("compare-view");
  const kwResults = document.getElementById("kw-results");
  const meaningResults = document.getElementById("meaning-results");
  const kwLatency = document.getElementById("kw-latency");
  const meaningLatency = document.getElementById("meaning-latency");
  const bookmarksCount = document.getElementById("bookmarks-count");
  const doneCount = document.getElementById("done-count");
  const shellCwd = document.getElementById("shell-cwd");
  const filterPillWrap = document.getElementById("filter-pill-wrap");
  const activeFilterText = document.getElementById("active-filter-text");
  const clearFilterBtn = document.getElementById("clear-filter");
  const themeToggle = document.getElementById("theme-toggle");
  const scrapeBtn = document.getElementById("scrape-btn");
  const helpBtn = document.getElementById("help-btn");
  const helpModal = document.getElementById("help-modal");
  const closeHelp = document.getElementById("close-help");
  const patBadges = document.querySelectorAll(".pat-badge");
  const chipCmds = document.querySelectorAll(".chip-cmd");

  // Initialize UI counts
  updateStorageCounts();
  initTheme();

  // Search Submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query.startsWith(":")) {
      handleShellCommand(query);
      return;
    }
    executeSearch();
  });

  // Mode or Judge change
  modeSelect.addEventListener("change", () => executeSearch());
  judgeSelect.addEventListener("change", () => executeSearch());

  // Compare Toggle change
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

  // Pattern Badges Click
  patBadges.forEach((btn) => {
    btn.addEventListener("click", () => {
      setPatternFilter(btn.dataset.pattern);
    });
  });

  // Clear Filter
  clearFilterBtn.addEventListener("click", () => {
    setPatternFilter("");
  });

  // Shell Command Chips
  chipCmds.forEach((chip) => {
    chip.addEventListener("click", () => {
      handleShellCommand(chip.dataset.cmd);
    });
  });

  // Scrape Button Trigger
  scrapeBtn.addEventListener("click", async () => {
    scrapeBtn.disabled = true;
    scrapeBtn.textContent = "⟳ scraping...";
    setStatus("Scraping live problems from LeetCode & Codeforces...");

    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatus(`✓ Successfully scraped! Total problems in index: ${data.count}`);
        document.getElementById("total-count").textContent = data.count;
        executeSearch();
      } else {
        setStatus(`Scraping warning: ${data.error || "failed"}`);
      }
    } catch (e) {
      setStatus("Error during scraping: " + e.message);
    } finally {
      scrapeBtn.disabled = false;
      scrapeBtn.textContent = "⟳ sync / scrape";
    }
  });

  // Help Modal Toggle
  helpBtn.addEventListener("click", () => helpModal.classList.toggle("hidden"));
  closeHelp.addEventListener("click", () => helpModal.classList.add("hidden"));

  // Main Search Execution
  async function executeSearch() {
    const query = searchInput.value.trim();
    const mode = modeSelect.value;
    const judge = judgeSelect.value;
    const isCompare = compareToggle.checked;

    shellCwd.textContent = query ? `~/search "${query}"` : "~";
    setStatus("querying index...");

    if (isCompare) {
      try {
        const [kwRes, meaningRes] = await Promise.all([
          fetch(`/search?question=${encodeURIComponent(query)}&mode=keyword&pattern=${encodeURIComponent(currentPattern)}&judge=${judge}`).then(r => r.json()),
          fetch(`/search?question=${encodeURIComponent(query)}&mode=meaning&pattern=${encodeURIComponent(currentPattern)}&judge=${judge}`).then(r => r.json())
        ]);

        kwLatency.textContent = `${kwRes.latencyMs}ms · ${kwRes.total} results`;
        meaningLatency.textContent = `${meaningRes.latencyMs}ms · ${meaningRes.total} results`;

        renderCards(kwRes.results, kwResults);
        renderCards(meaningRes.results, meaningResults);

        setStatus(`compared: keyword (${kwRes.latencyMs}ms) vs meaning (${meaningRes.latencyMs}ms)`);
      } catch (err) {
        setStatus("Search error: " + err.message);
      }
    } else {
      try {
        const res = await fetch(`/search?question=${encodeURIComponent(query)}&mode=${mode}&pattern=${encodeURIComponent(currentPattern)}&judge=${judge}`);
        const data = await res.json();

        let statusMsg = `${data.latencyMs}ms · ${data.total} results · mode: ${data.mode}`;
        if (data.appliedExpansion) {
          statusMsg += ` · +expansion: ${data.appliedExpansion}`;
        }
        setStatus(statusMsg);
        renderCards(data.results, resultsList);
      } catch (err) {
        setStatus("Search error: " + err.message);
      }
    }
  }

  // Shell Command Handling (:bookmarks, :done, :all, :help)
  function handleShellCommand(cmd) {
    if (cmd === ":bookmarks") {
      shellCwd.textContent = "~/bookmarks";
      renderSavedList(bookmarks, "No bookmarked problems. Click ★ on any problem to bookmark it.");
    } else if (cmd === ":done") {
      shellCwd.textContent = "~/done";
      renderSavedList(doneList, "No solved problems yet. Click ✓ on any problem when solved.");
    } else if (cmd === ":all" || cmd === ":clear") {
      searchInput.value = "";
      setPatternFilter("");
      executeSearch();
    } else if (cmd === ":help") {
      helpModal.classList.remove("hidden");
    } else if (cmd === ":scrape") {
      scrapeBtn.click();
    }
  }

  function setPatternFilter(pat) {
    currentPattern = pat;
    if (pat) {
      filterPillWrap.classList.remove("hidden");
      activeFilterText.textContent = "#" + pat;
    } else {
      filterPillWrap.classList.add("hidden");
      activeFilterText.textContent = "";
    }
    executeSearch();
  }

  // Render Result Cards
  function renderCards(list, container) {
    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="empty-notice">
          <p>No matching problems found.</p>
          <span>Try searching broader keywords, algorithms, or clearing filters.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map((item) => {
      const isBookmarked = bookmarks.some((b) => b.id === item.id);
      const isDone = doneList.some((d) => d.id === item.id);
      const diffClass = item.difficulty ? `diff-${item.difficulty.toLowerCase()}` : "";
      const judgeSlug = (item.judgeSlug || item.judge || "cf").toLowerCase();

      return `
        <article class="card" data-id="${item.id}">
          <div class="card-top">
            <div class="card-title-group">
              <span class="badge-judge judge-${judgeSlug}">${item.judge || "OJ"}</span>
              <a class="card-title" href="${item.url}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(item.title)} <span class="ext-icon">↗</span>
              </a>
            </div>
            ${item.difficulty ? `<span class="badge-diff ${diffClass}">${item.difficulty}${item.rating ? " (" + item.rating + ")" : ""}</span>` : ""}
          </div>

          <p class="card-statement">${escapeHtml(item.statement || "")}</p>

          <div class="card-bottom">
            <div class="card-tags">
              ${(item.patterns || item.tags || []).slice(0, 4).map(t => `
                <span class="tag-item" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>
              `).join("")}
            </div>

            <div class="card-actions">
              <button type="button" class="btn-action btn-star ${isBookmarked ? "active-star" : ""}" data-id="${item.id}" title="Star / Bookmark">
                ★
              </button>
              <button type="button" class="btn-action btn-done ${isDone ? "active-done" : ""}" data-id="${item.id}" title="Mark Done">
                ✓
              </button>
              <button type="button" class="btn-action btn-similar" data-id="${item.id}" title="Find Nearest Problems by Pattern">
                ≈ similar
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    attachCardListeners(container, list);
  }

  function attachCardListeners(container, currentList) {
    // Star bookmark
    container.querySelectorAll(".btn-star").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const item = currentList.find((p) => p.id === id) || bookmarks.find(b => b.id === id);
        if (!item) return;

        const idx = bookmarks.findIndex((b) => b.id === id);
        if (idx >= 0) {
          bookmarks.splice(idx, 1);
          btn.classList.remove("active-star");
        } else {
          bookmarks.push(item);
          btn.classList.add("active-star");
        }
        localStorage.setItem("findex_bookmarks", JSON.stringify(bookmarks));
        updateStorageCounts();
      });
    });

    // Mark Done
    container.querySelectorAll(".btn-done").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const item = currentList.find((p) => p.id === id) || doneList.find(d => d.id === id);
        if (!item) return;

        const idx = doneList.findIndex((d) => d.id === id);
        if (idx >= 0) {
          doneList.splice(idx, 1);
          btn.classList.remove("active-done");
        } else {
          doneList.push(item);
          btn.classList.add("active-done");
        }
        localStorage.setItem("findex_done", JSON.stringify(doneList));
        updateStorageCounts();
      });
    });

    // Find Similar
    container.querySelectorAll(".btn-similar").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        setStatus("calculating similar pattern neighbors...");
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

    // Tag click
    container.querySelectorAll(".tag-item").forEach((tagSpan) => {
      tagSpan.addEventListener("click", () => {
        setPatternFilter(tagSpan.dataset.tag);
      });
    });
  }

  function renderSavedList(list, emptyMsg) {
    if (!list || list.length === 0) {
      resultsList.innerHTML = `<div class="empty-notice"><p>${emptyMsg}</p></div>`;
      setStatus(`0 items in current list`);
      return;
    }
    setStatus(`showing ${list.length} saved items`);
    renderCards(list, resultsList);
  }

  function updateStorageCounts() {
    bookmarksCount.textContent = bookmarks.length;
    doneCount.textContent = doneList.length;
  }

  function setStatus(msg) {
    statusText.textContent = msg;
  }

  function initTheme() {
    const savedTheme = localStorage.getItem("findex_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeButton(savedTheme);

    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("findex_theme", next);
      updateThemeButton(next);
    });
  }

  function updateThemeButton(theme) {
    const icon = document.getElementById("theme-icon");
    const text = document.getElementById("theme-text");
    if (theme === "dark") {
      icon.textContent = "☼";
      text.textContent = "light mode";
    } else {
      icon.textContent = "☾";
      text.textContent = "dark mode";
    }
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

  // Initial Search Load
  executeSearch();
});
