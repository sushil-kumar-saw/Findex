const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setting up EJS View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Question Bank / Dataset for Information Retrieval & Search
const questionsDataset = [
  {
    id: 1,
    title: "Two Sum",
    url: "https://leetcode.com/problems/two-sum/",
    statement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    tags: ["Array", "Hash Table"],
    difficulty: "Easy"
  },
  {
    id: 2,
    title: "Add Two Numbers",
    url: "https://leetcode.com/problems/add-two-numbers/",
    statement: "You are given two non-empty linked lists representing two non-negative integers. Add the two numbers and return the sum as a linked list.",
    tags: ["Linked List", "Math", "Recursion"],
    difficulty: "Medium"
  },
  {
    id: 3,
    title: "Longest Substring Without Repeating Characters",
    url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    statement: "Given a string s, find the length of the longest substring without repeating characters using sliding window.",
    tags: ["Hash Table", "String", "Sliding Window"],
    difficulty: "Medium"
  },
  {
    id: 4,
    title: "Median of Two Sorted Arrays",
    url: "https://leetcode.com/problems/median-of-two-sorted-arrays/",
    statement: "Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.",
    tags: ["Array", "Binary Search", "Divide and Conquer"],
    difficulty: "Hard"
  },
  {
    id: 5,
    title: "Longest Palindromic Substring",
    url: "https://leetcode.com/problems/longest-palindromic-substring/",
    statement: "Given a string s, return the longest palindromic substring in s using dynamic programming or expand around center.",
    tags: ["String", "Dynamic Programming"],
    difficulty: "Medium"
  },
  {
    id: 6,
    title: "Reverse Linked List",
    url: "https://leetcode.com/problems/reverse-linked-list/",
    statement: "Given the head of a singly linked list, reverse the list, and return the reversed list iteratively or recursively.",
    tags: ["Linked List", "Recursion"],
    difficulty: "Easy"
  },
  {
    id: 7,
    title: "Valid Parentheses",
    url: "https://leetcode.com/problems/valid-parentheses/",
    statement: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid using a stack.",
    tags: ["String", "Stack"],
    difficulty: "Easy"
  },
  {
    id: 8,
    title: "Binary Tree Level Order Traversal",
    url: "https://leetcode.com/problems/binary-tree-level-order-traversal/",
    statement: "Given the root of a binary tree, return the level order traversal of its nodes' values (i.e., from left to right, level by level) using BFS Queue.",
    tags: ["Tree", "Breadth-First Search", "Binary Tree"],
    difficulty: "Medium"
  },
  {
    id: 9,
    title: "Maximum Subarray (Kadane's Algorithm)",
    url: "https://leetcode.com/problems/maximum-subarray/",
    statement: "Given an integer array nums, find the subarray with the largest sum, and return its sum using Kadane's algorithm.",
    tags: ["Array", "Divide and Conquer", "Dynamic Programming"],
    difficulty: "Medium"
  },
  {
    id: 10,
    title: "Climbing Stairs",
    url: "https://leetcode.com/problems/climbing-stairs/",
    statement: "You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
    tags: ["Math", "Dynamic Programming", "Memoization"],
    difficulty: "Easy"
  },
  {
    id: 11,
    title: "Course Schedule (Cycle Detection in Graph)",
    url: "https://leetcode.com/problems/course-schedule/",
    statement: "There are a total of numCourses courses you have to take. Determine if you can finish all courses using topological sort / Kahn's algorithm or DFS.",
    tags: ["Depth-First Search", "Breadth-First Search", "Graph", "Topological Sort"],
    difficulty: "Medium"
  },
  {
    id: 12,
    title: "Merge K Sorted Lists",
    url: "https://leetcode.com/problems/merge-k-sorted-lists/",
    statement: "You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list.",
    tags: ["Linked List", "Divide and Conquer", "Heap (Priority Queue)", "Merge Sort"],
    difficulty: "Hard"
  }
];

// Helper: Tokenize and clean text
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

// TF-IDF / Term Frequency Search Scoring
function searchQuestions(query) {
  if (!query || !query.trim()) {
    return questionsDataset.slice(0, 5);
  }

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return questionsDataset.slice(0, 5);
  }

  const scored = questionsDataset.map((item) => {
    const titleTokens = tokenize(item.title);
    const statementTokens = tokenize(item.statement);
    const tagTokens = tokenize(item.tags.join(" "));

    let score = 0;

    queryTerms.forEach((term) => {
      // Exact title matches get high weight
      if (item.title.toLowerCase().includes(term)) score += 10;
      // Tag matches get moderate weight
      if (tagTokens.includes(term)) score += 5;
      // Title token frequency
      titleTokens.forEach((t) => {
        if (t === term) score += 4;
        else if (t.includes(term) || term.includes(t)) score += 2;
      });
      // Statement token frequency
      statementTokens.forEach((s) => {
        if (s === term) score += 2;
        else if (s.includes(term) || term.includes(s)) score += 1;
      });
    });

    return { ...item, score };
  });

  // Filter items that have at least some relevance, or fallback to all sorted
  const matched = scored.filter((item) => item.score > 0);
  matched.sort((a, b) => b.score - a.score);

  if (matched.length > 0) {
    return matched.slice(0, 5);
  }

  // If no direct keyword match, return top questions
  return questionsDataset.slice(0, 5);
}

// Routes
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/search", (req, res) => {
  const questionQuery = req.query.question || "";
  const results = searchQuestions(questionQuery);
  res.json(results);
});

// Start Server if not imported as module
if (process.env.NODE_ENV !== "test" && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Findex server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
