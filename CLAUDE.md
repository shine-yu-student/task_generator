# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Gaokao (Chinese college entrance exam) question generator. The user selects a subject/grade/difficulty/type, the server composes LLM prompts from `declaration/` markdown files, the user pastes those prompts into an LLM (e.g., ChatGPT), then pastes the LLM's JSON output back into the app. The app renders questions as interactive DOM widgets with answer submission and auto-grading.

## Development commands

```bash
# Start the server (serves on localhost:8080 by default)
python src/server.py
python src/server.py --port 3000   # custom port
```

There is no build step, no package manager, no test suite. The server uses only Python stdlib. The frontend uses vanilla JS loaded via `<script>` tags with no bundler. External CDN dependencies: MathJax (LaTeX rendering) and Mermaid (diagrams).

## Architecture

```
declaration/          # Markdown files that define question-type JSON schemas and per-subject generation guidelines
  ├── 题目类型.md      # JSON schema for all 12 question types — consumed by the initial prompt
  ├── 数学.md          # Subject-specific generation guidelines (math, physics, chemistry, biology, english)
  ├── 物理.md
  ├── 化学.md
  ├── 生物.md
  └── 英语.md

src/
  ├── server.py        # Stdlib HTTP server. GET /api/prompts builds prompts from declaration files.
  │                    # POST /export-mermaid converts Mermaid code → SVG via mmdc CLI.
  │                    # All other routes serve static/ as a SPA.
  └── static/
      ├── index.html   # Single-page app shell with subject/grade/difficulty/type selectors,
      │                # split-panel layout (questions left, answers right), and a modal for prompt/JSON I/O.
      ├── css/style.css
      └── js/
          ├── api.js       # fetch wrappers: GET /api/prompts, POST /export-mermaid, JSON extraction from LLM output
          ├── renderer.js  # DOM rendering for all 12 question types (single_choice, fill_blank, cloze, writing, etc.)
          ├── grader.js    # Answer grading: reads user input from DOM, compares to correct answers, applies color-coded results
          ├── mermaid-init.js  # Async Mermaid.js initialization with pending-render queue
          └── app.js       # Main controller: wires UI events, manages question import/export, coordinates modules
```

## Key data flow

1. User clicks "生成题目" → `app.js` calls `API.fetchPrompts()` → `server.py` reads `declaration/题目类型.md` (initial prompt) + subject-specific markdown (question prompt) → returns both to the modal
2. User copies prompts to an LLM, pastes the JSON output back → `API.extractJSON()` strips markdown fences → JSON parsed into a "paper" object: `{ subject, grade, difficulty, topic, questions: [...] }`
3. Each question object has a `type` field (one of 12 types). `Renderer.renderAll()` dispatches to type-specific renderers that create interactive DOM (option buttons, text inputs, drag-and-drop lists, etc.) in the left panel and answer areas in the right panel.
4. When user submits: `Grader.grade()` reads answers from the DOM, compares to correct answers, `Grader.applyResults()` highlights correct/wrong elements via CSS class toggling.

## Question JSON format

Every question has a `type` field. The 12 supported types and their key fields:

| type | Key identifying fields |
|---|---|
| `single_choice` | `options[]`, `answer` (int index) |
| `multiple_choice` | `options[]`, `answers[]` (int array). Partial credit for incomplete correct sets. |
| `fill_blank` | `blanks[]` with `acceptable_answers[]`, `explanation`. `___` markers in `text`. |
| `true_false` | `answer` (boolean) |
| `short_answer` | `reference_answer`, `keywords[]`, `scoring_criteria` (subjective, self-graded) |
| `calculation` | `final_answer`, `acceptable_answers[]`, `steps[]` with per-step `score` |
| `ordering` | `items[]`, `correct_order[]` (int array). Rendered as drag-and-drop. |
| `matching` | `left[]`, `right[]`, `correct_pairs` (string-keyed object). Rendered as dropdowns. |
| `cloze` | `blanks[]` with `options[]`, `answer` (int index). `___N___` markers in `text`. |
| `seven_choose_five` | `options[]` (7 items), `answers` (object mapping blank number→index) |
| `writing` | `prompt_paragraphs[]`, `word_count`, `reference_answer` (subjective, self-graded) |
| `grammar_cloze` | `blanks[]` with `acceptable_answers[]`, `hint`. `___N___` markers with hint in parens. |

Papers are wrapped as `{ subject, grade, difficulty, topic, questions: [...] }`.

## Math rendering

LaTeX in question text uses `$...$` (inline) and `$$...$$` (display). Rendered client-side by MathJax. The renderer calls `MathJax.typesetPromise()` after DOM insertion.

## Mermaid diagrams

Questions can include a `mermaid` field with raw Mermaid code. `app.js` detects this and calls `MermaidInit.createContainer()` → `MermaidInit.renderAll()`. Server-side rendering via `mmdc` CLI is available at `POST /export-mermaid` but the frontend handles it client-side when the Mermaid CDN script is loaded.
