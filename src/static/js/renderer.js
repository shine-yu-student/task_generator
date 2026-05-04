/**
 * renderer.js — Renders all 12 question types into the DOM
 */
try {
  window.Renderer = (() => {
    const LABELS = "ABCD";

    // -------------------------------------------------------
    //  Public: render an entire question set
    // -------------------------------------------------------
    function renderAll(paper, leftContainer, rightContainer) {
      leftContainer.innerHTML = "";
      rightContainer.innerHTML = "";
      document.getElementById("placeholderLeft").style.display = "none";
      document.getElementById("placeholderRight").style.display = "none";
      document.getElementById("questionsTitle").style.display = "block";

      const subjectNames = {
        math: "数学",
        physics: "物理",
        chemistry: "化学",
        biology: "生物",
        english: "英语",
      };
      document.getElementById("questionsTitle").textContent =
        `${subjectNames[paper.subject] || paper.subject} · ${paper.grade} · ${paper.difficulty}` +
        (paper.topic ? ` · ${paper.topic}` : "");

      paper.questions.forEach((q, i) => {
        const leftEl = renderQuestionText(q, i);
        const rightEl = renderAnswerArea(q, i);
        leftContainer.appendChild(leftEl);
        rightContainer.appendChild(rightEl);
      });

      // Trigger MathJax and Mermaid rendering
      _typeset();
    }

    // -------------------------------------------------------
    //  Question text rendering (left panel)
    // -------------------------------------------------------
    function renderQuestionText(q, idx) {
      const block = document.createElement("div");
      block.className = "question-block";
      block.id = `qblock-${idx}`;

      const header = document.createElement("div");
      header.className = "q-header";
      header.innerHTML = `<span class="q-index">${idx + 1}</span><div class="q-text">${_escapeHtml(q.text)}</div>`;
      block.appendChild(header);

      switch (q.type) {
        case "single_choice":
        case "multiple_choice":
          // Options rendered in answer area
          break;
        case "fill_blank":
          block.innerHTML = "";
          block.appendChild(_renderFillBlankText(q, idx));
          break;
        case "true_false":
          break;
        case "calculation":
          block.innerHTML = "";
          block.appendChild(_renderCalcText(q, idx));
          break;
        case "short_answer":
          break;
        case "ordering":
          block.innerHTML = "";
          header.innerHTML = `<span class="q-index">${idx + 1}</span><div class="q-text">${_escapeHtml(q.text)}</div>`;
          block.appendChild(header);
          break;
        case "matching":
          break;
        case "cloze":
        case "grammar_cloze":
          block.innerHTML = "";
          block.appendChild(_renderClozeText(q, idx));
          break;
        case "seven_choose_five":
          block.innerHTML = "";
          block.appendChild(_renderSCFText(q, idx));
          break;
        case "writing":
          break;
      }

      return block;
    }

    // -------------------------------------------------------
    //  Answer area rendering (right panel)
    // -------------------------------------------------------
    function renderAnswerArea(q, idx) {
      const block = document.createElement("div");
      block.className = "question-block";
      block.id = `ablock-${idx}`;

      const title = document.createElement("div");
      title.className = "q-header";
      title.innerHTML = `<span class="q-index">${idx + 1}</span><div class="q-text" style="font-size:14px;color:#666;">第 ${idx + 1} 题</div>`;
      block.appendChild(title);

      switch (q.type) {
        case "single_choice":
          block.appendChild(_renderOptions(q, idx, false));
          break;
        case "multiple_choice":
          block.appendChild(_renderOptions(q, idx, true));
          break;
        case "true_false":
          block.appendChild(_renderTrueFalse(q, idx));
          break;
        case "fill_blank":
          // blanks are inline in question text; add explanation area
          block.appendChild(_renderFillBlankExplanations(q, idx));
          break;
        case "calculation":
          block.appendChild(_renderCalcAnswer(q, idx));
          break;
        case "short_answer":
          block.appendChild(_renderShortAnswer(q, idx));
          break;
        case "ordering":
          block.appendChild(_renderOrdering(q, idx));
          break;
        case "matching":
          block.appendChild(_renderMatching(q, idx));
          break;
        case "cloze":
          // cloze selects are inline; add note
          break;
        case "grammar_cloze":
          // grammar cloze inputs are inline; add note
          break;
        case "seven_choose_five":
          // selects inline
          break;
        case "writing":
          block.appendChild(_renderWriting(q, idx));
          break;
      }

      return block;
    }

    // =======================================================
    //  Individual type renderers
    // =======================================================

    // -- Options (single / multiple choice) --
    function _renderOptions(q, qIdx, multi) {
      const wrap = document.createElement("div");
      wrap.className = "options";
      q.options.forEach((opt, oi) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.id = `opt-${qIdx}-${oi}`;
        btn.innerHTML = `<span class="label">${LABELS[oi]}</span><span>${_escapeHtml(opt)}</span>`;
        btn.onclick = () => _selectOption(qIdx, oi, multi, q.options.length);
        wrap.appendChild(btn);
      });
      return wrap;
    }

    function _selectOption(qIdx, optIdx, multi, total) {
      if (window.App && App.isSubmitted()) return;
      if (multi) {
        const btn = document.getElementById(`opt-${qIdx}-${optIdx}`);
        btn.classList.toggle("selected");
      } else {
        for (let i = 0; i < total; i++) {
          document
            .getElementById(`opt-${qIdx}-${i}`)
            .classList.toggle("selected", i === optIdx);
        }
      }
    }

    // -- True/False --
    function _renderTrueFalse(q, qIdx) {
      const wrap = document.createElement("div");
      wrap.className = "tf-group";
      ["正确", "错误"].forEach((label, i) => {
        const btn = document.createElement("button");
        btn.className = "tf-btn";
        btn.id = `tf-${qIdx}-${i}`;
        btn.textContent = label;
        btn.onclick = () => {
          if (window.App && App.isSubmitted()) return;
          document.getElementById(`tf-${qIdx}-0`).classList.remove("selected");
          document.getElementById(`tf-${qIdx}-1`).classList.remove("selected");
          btn.classList.add("selected");
        };
        wrap.appendChild(btn);
      });
      return wrap;
    }

    // -- Fill Blank (question text with inline inputs) --
    function _renderFillBlankText(q, qIdx) {
      const div = document.createElement("div");
      div.className = "question-block";

      const header = document.createElement("div");
      header.className = "q-header";
      const textDiv = document.createElement("div");
      textDiv.className = "q-text fill-blank-text";
      textDiv.id = `fb-text-${qIdx}`;
      header.innerHTML = `<span class="q-index">${qIdx + 1}</span>`;
      header.appendChild(textDiv);
      div.appendChild(header);

      // Replace ___ with input fields
      let html = _escapeHtml(q.text);
      let blankIdx = 0;
      html = html.replace(/_{3,}/g, () => {
        const input = `<input type="text" class="blank-input" id="fb-${qIdx}-${blankIdx}" data-q="${qIdx}" data-b="${blankIdx}" autocomplete="off">`;
        blankIdx++;
        return input;
      });
      textDiv.innerHTML = html;

      return div;
    }

    function _renderFillBlankExplanations(q, qIdx) {
      const wrap = document.createElement("div");
      if (q.blanks) {
        q.blanks.forEach((b, bi) => {
          const exp = document.createElement("div");
          exp.className = "blank-explanation";
          exp.id = `fb-exp-${qIdx}-${bi}`;
          exp.textContent = b.explanation || "";
          wrap.appendChild(exp);
        });
      }
      return wrap;
    }

    // -- Calculation --
    function _renderCalcText(q, qIdx) {
      const div = document.createElement("div");
      div.className = "question-block";

      const header = document.createElement("div");
      header.className = "q-header";
      header.innerHTML = `<span class="q-index">${qIdx + 1}</span><div class="q-text">${_processLatex(_escapeHtml(q.text))}</div>`;
      div.appendChild(header);

      if (q.total_score) {
        const score = document.createElement("div");
        score.style.cssText = "font-size:13px;color:#999;margin-top:4px;";
        score.textContent = `（本题 ${q.total_score} 分）`;
        div.appendChild(score);
      }

      // Steps area (hidden until submit)
      if (q.steps) {
        const stepsDiv = document.createElement("div");
        stepsDiv.className = "calc-steps";
        stepsDiv.id = `calc-steps-${qIdx}`;
        stepsDiv.innerHTML =
          '<h4 style="font-size:14px;color:#d48806;margin-bottom:8px;">解题步骤</h4>' +
          q.steps
            .map(
              (s, i) =>
                `<div class="step"><div>${_processLatex(_escapeHtml(s.content))}</div><div class="step-score">${s.score}分</div></div>`,
            )
            .join("");
        div.appendChild(stepsDiv);
      }

      return div;
    }

    function _renderCalcAnswer(q, qIdx) {
      const wrap = document.createElement("div");
      wrap.className = "calc-answer-area";
      wrap.innerHTML = `
      <label>最终答案</label>
      <input type="text" id="calc-ans-${qIdx}" class="blank-input" style="width:100%;max-width:400px;border-bottom:2px solid #4a90d9;padding:8px 12px;font-size:15px;" autocomplete="off">
      <label style="margin-top:10px;">解题过程（可选）</label>
      <textarea class="calc-process" id="calc-proc-${qIdx}" placeholder="在此写出你的解题过程..."></textarea>
    `;
      return wrap;
    }

    // -- Short Answer --
    function _renderShortAnswer(q, qIdx) {
      const wrap = document.createElement("div");

      const ta = document.createElement("textarea");
      ta.className = "answer-textarea";
      ta.id = `sa-${qIdx}`;
      ta.placeholder = "在此作答...";
      wrap.appendChild(ta);

      // Reference area (hidden)
      const ref = document.createElement("div");
      ref.className = "reference-area";
      ref.id = `sa-ref-${qIdx}`;
      ref.innerHTML =
        `<h4>参考答案</h4><div>${_escapeHtml(q.reference_answer || "")}</div>` +
        (q.keywords
          ? `<div class="keywords">关键词：${q.keywords.map((k) => `<span>${k}</span>`).join("")}</div>`
          : "") +
        (q.scoring_criteria
          ? `<div class="scoring-criteria">评分标准：${_escapeHtml(q.scoring_criteria)}</div>`
          : "");
      wrap.appendChild(ref);

      return wrap;
    }

    // -- Ordering --
    function _renderOrdering(q, qIdx) {
      const wrap = document.createElement("div");

      // Shuffle items for display
      const indices = q.items.map((_, i) => i);
      const shuffled = [...indices];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const list = document.createElement("ul");
      list.className = "order-list";
      list.id = `order-${qIdx}`;
      list.dataset.qIdx = qIdx;

      shuffled.forEach((origIdx, displayIdx) => {
        const li = document.createElement("li");
        li.className = "order-item";
        li.dataset.origIdx = origIdx;
        li.draggable = true;
        li.innerHTML = `<span class="order-num">${displayIdx + 1}</span><span>${_escapeHtml(q.items[origIdx])}</span>`;
        _setupDrag(li, list);
        list.appendChild(li);
      });

      wrap.appendChild(list);
      return wrap;
    }

    function _setupDrag(li, list) {
      li.addEventListener("dragstart", (e) => {
        li.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      li.addEventListener("dragend", () => {
        li.classList.remove("dragging");
        _renumberList(list);
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const dragging = list.querySelector(".dragging");
        if (dragging && dragging !== li) {
          const rect = li.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (e.clientY < mid) {
            list.insertBefore(dragging, li);
          } else {
            list.insertBefore(dragging, li.nextSibling);
          }
        }
      });
    }

    function _renumberList(list) {
      list.querySelectorAll(".order-item").forEach((li, i) => {
        li.querySelector(".order-num").textContent = i + 1;
      });
    }

    // -- Matching --
    function _renderMatching(q, qIdx) {
      const wrap = document.createElement("div");
      wrap.className = "match-table";

      // Shuffle right column
      const rightIndices = q.right.map((_, i) => i);
      for (let i = rightIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rightIndices[i], rightIndices[j]] = [rightIndices[j], rightIndices[i]];
      }

      q.left.forEach((leftItem, li) => {
        const row = document.createElement("div");
        row.className = "match-row";
        row.id = `match-${qIdx}-${li}`;

        const leftDiv = document.createElement("div");
        leftDiv.className = "match-left";
        leftDiv.textContent = leftItem;
        row.appendChild(leftDiv);

        const select = document.createElement("select");
        select.id = `match-sel-${qIdx}-${li}`;
        select.innerHTML =
          '<option value="">请选择</option>' +
          rightIndices
            .map(
              (ri) =>
                `<option value="${ri}">${_escapeHtml(q.right[ri])}</option>`,
            )
            .join("");
        row.appendChild(select);

        wrap.appendChild(row);
      });

      return wrap;
    }

    // -- Cloze (完形填空) --
    function _renderClozeText(q, qIdx) {
      const div = document.createElement("div");
      div.className = "question-block";

      const header = document.createElement("div");
      header.className = "q-header";
      const textDiv = document.createElement("div");
      textDiv.className = "q-text cloze-text";
      textDiv.id = `cloze-text-${qIdx}`;
      header.innerHTML = `<span class="q-index">${qIdx + 1}</span>`;
      header.appendChild(textDiv);
      div.appendChild(header);

      // Build HTML: replace ___N___ with select dropdowns
      let html = _escapeHtml(q.text);
      const blankMap = {};
      if (q.blanks)
        q.blanks.forEach((b) => {
          blankMap[b.index] = b;
        });

      html = html.replace(/___(\d+)___/g, (_, numStr) => {
        const num = parseInt(numStr);
        const b = blankMap[num];
        if (!b) return `___${num}___`;
        const opts = b.options
          .map((o, i) => `<option value="${i}">${_escapeHtml(o)}</option>`)
          .join("");
        return `<select class="cloze-select" id="cloze-${qIdx}-${num}" data-q="${qIdx}" data-b="${num}"><option value="">(${num})</option>${opts}</select>`;
      });

      textDiv.innerHTML = html;

      return div;
    }

    // -- Grammar Cloze --
    function _renderSCFText(q, qIdx) {
      // Shared renderer for seven_choose_five and grammar_cloze
      const div = document.createElement("div");
      div.className = "question-block";

      const header = document.createElement("div");
      header.className = "q-header";
      const textDiv = document.createElement("div");
      textDiv.className = "q-text cloze-text";
      textDiv.id = `cloze-text-${qIdx}`;
      header.innerHTML = `<span class="q-index">${qIdx + 1}</span>`;
      header.appendChild(textDiv);
      div.appendChild(header);

      let html = _escapeHtml(q.text);
      const blankMap = {};
      if (q.blanks)
        q.blanks.forEach((b) => {
          blankMap[b.index] = b;
        });

      if (q.type === "grammar_cloze") {
        html = html.replace(/___(\d+)___/g, (_, numStr) => {
          const num = parseInt(numStr);
          const b = blankMap[num];
          const hint =
            b && b.hint
              ? ` <span class="cloze-hint">(${_escapeHtml(b.hint)})</span>`
              : "";
          return `<input type="text" class="cloze-input" id="cloze-${qIdx}-${num}" data-q="${qIdx}" data-b="${num}" autocomplete="off">${hint}`;
        });
      } else {
        // seven_choose_five
        const optLetters = "ABCDEFG";
        html = html.replace(/___(\d+)___/g, (_, numStr) => {
          const num = parseInt(numStr);
          const opts = q.options
            .map(
              (o, i) =>
                `<option value="${i}">${optLetters[i]}. ${_escapeHtml(o.replace(/^[A-G]\.\s*/, ""))}</option>`,
            )
            .join("");
          return `<select class="cloze-select" id="scf-${qIdx}-${num}" data-q="${qIdx}" data-b="${num}"><option value="">(${num})</option>${opts}</select>`;
        });

        // Add options sidebar (after a tick so it appends after the text is in DOM)
        setTimeout(() => {
          const textEl = document.getElementById(`cloze-text-${qIdx}`);
          if (textEl && q.options) {
            const sidebar = document.createElement("div");
            sidebar.className = "scf-options";
            sidebar.innerHTML =
              "<h4>备选项</h4>" +
              q.options
                .map(
                  (o, i) =>
                    `<div class="scf-opt">${optLetters[i]}. ${_escapeHtml(o)}</div>`,
                )
                .join("");
            textEl.parentElement.appendChild(sidebar);
          }
        }, 0);
      }

      textDiv.innerHTML = html;

      return div;
    }

    // -- Writing --
    function _renderWriting(q, qIdx) {
      const wrap = document.createElement("div");

      // Prompt paragraphs
      if (q.prompt_paragraphs) {
        const pp = document.createElement("div");
        pp.style.cssText =
          "margin-bottom:12px;padding:10px;background:#f0f6ff;border-radius:6px;font-size:14px;";
        pp.innerHTML = q.prompt_paragraphs
          .map((p) => `<p style="margin-bottom:6px;">${_escapeHtml(p)}</p>`)
          .join("");
        wrap.appendChild(pp);
      }

      const ta = document.createElement("textarea");
      ta.className = "answer-textarea";
      ta.id = `writing-${qIdx}`;
      ta.placeholder = "在此写作...";
      ta.style.minHeight = "180px";
      ta.oninput = () => _updateWordCount(qIdx);
      wrap.appendChild(ta);

      const wc = document.createElement("div");
      wc.className = "word-count";
      wc.id = `wc-${qIdx}`;
      if (q.word_count) {
        wc.textContent = `要求：${q.word_count.min}-${q.word_count.max} 词`;
      }
      wrap.appendChild(wc);

      // Reference area
      const ref = document.createElement("div");
      ref.className = "reference-area";
      ref.id = `writing-ref-${qIdx}`;
      ref.innerHTML =
        `<h4>参考范文</h4><div style="white-space:pre-wrap;">${_escapeHtml(q.reference_answer || "")}</div>` +
        (q.scoring_criteria
          ? `<div class="scoring-criteria">评分标准：${_escapeHtml(q.scoring_criteria)}</div>`
          : "");
      wrap.appendChild(ref);

      return wrap;
    }

    // =======================================================
    //  Helpers
    // =======================================================

    function _escapeHtml(s) {
      if (typeof s !== "string") return "";
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function _processLatex(html) {
      // Protect $...$ and $$...$$ from HTML escaping
      return html;
    }

    function _typeset() {
      // Trigger MathJax
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise().catch((err) =>
          console.warn("MathJax error:", err),
        );
      }
      // Trigger Mermaid
      if (window.MermaidInit) {
        MermaidInit.renderAll();
      }
    }

    function _updateWordCount(qIdx) {
      const ta = document.getElementById(`writing-${qIdx}`);
      const wc = document.getElementById(`wc-${qIdx}`);
      if (!ta || !wc) return;
      const count = ta.value
        .trim()
        .split(/\s+/)
        .filter((w) => w).length;
      wc.textContent = `已写约 ${count} 词`;
    }

    return { renderAll, renderQuestionText, renderAnswerArea };
  })();
  if (window.__scriptProbe) window.__scriptProbe.loaded.push("Renderer");
  console.log("[task_generator] Renderer loaded");
} catch (e) {
  console.error("[task_generator] Renderer failed:", e);
}
