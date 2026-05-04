/**
 * app.js — Main application logic
 * Scripts are at bottom of <body>, so DOM is already available.
 * No DOMContentLoaded needed — we init directly.
 */
try {
  window.App = (() => {
    var currentPaper = null;
    var submitted = false;
    var actionMenuOpen = false;

    // -------------------------------------------------------
    //  Subject → question types mapping
    // -------------------------------------------------------
    var SUBJECT_TYPES = {
      math: ["single_choice", "multiple_choice", "fill_blank", "calculation"],
      physics: [
        "single_choice",
        "multiple_choice",
        "fill_blank",
        "calculation",
      ],
      chemistry: ["single_choice", "fill_blank", "short_answer"],
      biology: ["single_choice", "fill_blank", "true_false", "short_answer"],
      english: [
        "single_choice",
        "cloze",
        "grammar_cloze",
        "seven_choose_five",
        "writing",
      ],
    };

    var TYPE_NAMES = {
      single_choice: "单选题",
      multiple_choice: "多选题",
      fill_blank: "填空题",
      true_false: "判断题",
      short_answer: "简答题",
      calculation: "解答题",
      ordering: "排序题",
      matching: "匹配题",
      cloze: "完形填空",
      seven_choose_five: "七选五",
      writing: "写作题",
      grammar_cloze: "语法填空",
    };

    // -------------------------------------------------------
    //  Public API
    // -------------------------------------------------------

    function isSubmitted() {
      return submitted;
    }

    /** Populate question type selector when subject changes */
    function onSubjectChange() {
      var subject = document.getElementById("selSubject").value;
      var selType = document.getElementById("selType");
      var types = SUBJECT_TYPES[subject] || [];
      selType.innerHTML = "";
      for (var i = 0; i < types.length; i++) {
        var opt = document.createElement("option");
        opt.value = types[i];
        opt.textContent = TYPE_NAMES[types[i]] || types[i];
        selType.appendChild(opt);
      }
    }

    /** Open the generate modal — fetch prompts from declaration files */
    function openGenerateModal() {
      var subject = document.getElementById("selSubject").value;
      var grade = document.getElementById("selGrade").value;
      var difficulty = document.getElementById("selDifficulty").value;
      var topic = document.getElementById("topicInput").value.trim() || "综合";
      var qtype = document.getElementById("selType").value;

      setStatus("正在加载 Prompt...");

      API.fetchPrompts(subject, grade, difficulty, topic, qtype)
        .then(function (data) {
          document.getElementById("modalInitialPrompt").value =
            data.initialPrompt;
          document.getElementById("modalQuestionPrompt").value =
            data.questionPrompt;
          document.getElementById("modalOutput").value = "";
          document.getElementById("generateModal").style.display = "flex";
          setStatus("Prompt 已加载，请复制到大模型生成题目后粘贴输出");
        })
        .catch(function (err) {
          setStatus("加载 Prompt 失败: " + err.message);
          alert("加载 Prompt 失败: " + err.message);
        });
    }

    function closeGenerateModal() {
      document.getElementById("generateModal").style.display = "none";
    }

    /** Copy the content of a textarea to clipboard */
    function copyText(textareaId) {
      var el = document.getElementById(textareaId);
      if (!el) return;
      el.select();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(el.value);
        } else {
          document.execCommand("copy");
        }
        setStatus("已复制到剪贴板");
      } catch (e) {
        setStatus("复制失败");
      }
    }

    /** Import a question from pasted LLM output */
    function importQuestion() {
      var raw = document.getElementById("modalOutput").value.trim();
      if (!raw) {
        alert("请先粘贴大模型输出的 JSON");
        return;
      }

      try {
        var jsonStr = API.extractJSON(raw);
        var parsed = JSON.parse(jsonStr);

        var paper;
        if (parsed.questions && Array.isArray(parsed.questions)) {
          paper = parsed;
        } else {
          paper = {
            subject: document.getElementById("selSubject").value,
            grade: document.getElementById("selGrade").value,
            difficulty: document.getElementById("selDifficulty").value,
            topic: document.getElementById("topicInput").value.trim() || "综合",
            questions: [parsed],
          };
        }

        if (!paper.questions || paper.questions.length === 0) {
          throw new Error("JSON 中没有找到题目");
        }

        currentPaper = paper;
        submitted = false;

        Renderer.renderAll(
          paper,
          document.getElementById("questionsContainer"),
          document.getElementById("answersContainer"),
        );

        _processMermaidInQuestions(paper);
        _setActionButtonsEnabled(true);

        closeGenerateModal();
        setStatus("题目导入成功");
      } catch (err) {
        alert("解析 JSON 失败: " + err.message);
        console.error("Import error:", err);
      }
    }

    /** Toggle the action dropdown menu */
    function toggleActionMenu() {
      actionMenuOpen = !actionMenuOpen;
      document.getElementById("actionMenu").style.display = actionMenuOpen
        ? "block"
        : "none";
    }

    /** Submit answers for grading */
    function submit() {
      if (!currentPaper || submitted) return;
      submitted = true;

      var result = Grader.grade(currentPaper.questions);
      Grader.applyResults(currentPaper.questions, result.details);

      var scoreEl = document.getElementById("scoreDisplay");
      scoreEl.style.display = "block";
      scoreEl.className = "score-display";

      var gradable = result.details.filter(function (d) {
        return d.correct !== null;
      });
      var gradableCorrect = gradable.filter(function (d) {
        return d.correct;
      }).length;
      var partial = result.details.filter(function (d) {
        return d.partial;
      }).length;
      var unanswered = result.unanswered;

      var msg = "客观题得分：" + gradableCorrect + " / " + gradable.length;
      if (partial > 0) msg += "　（主观题 " + partial + " 题请自评）";
      if (unanswered > 0) msg += "　（" + unanswered + " 题未作答）";
      scoreEl.textContent = msg;
      setStatus(
        "批改完成 — " + gradableCorrect + "/" + gradable.length + " 正确",
      );
      _closeActionMenu();
    }

    /** Show all correct answers */
    function showAnswers() {
      if (!currentPaper) return;
      submitted = true;

      var result = Grader.grade(currentPaper.questions);
      Grader.applyResults(currentPaper.questions, result.details);
      setStatus("已显示答案");
      _closeActionMenu();
    }

    /** Export current question as JSON file */
    function exportJSON() {
      if (!currentPaper) return;
      var jsonStr = JSON.stringify(currentPaper, null, 2);
      var blob = new Blob([jsonStr], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      var subject = currentPaper.subject || "question";
      var type =
        (currentPaper.questions[0] && currentPaper.questions[0].type) ||
        "unknown";
      a.href = url;
      a.download =
        "question_" + subject + "_" + type + "_" + Date.now() + ".json";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("JSON 已导出");
      _closeActionMenu();
    }

    /** Import JSON from a file */
    function importJSONFile() {
      _closeActionMenu();
      document.getElementById("jsonFileInput").click();
    }

    // -------------------------------------------------------
    //  Internal helpers
    // -------------------------------------------------------

    function _setActionButtonsEnabled(enabled) {
      document.getElementById("menuSubmit").disabled = !enabled;
      document.getElementById("menuShowAnswer").disabled = !enabled;
      document.getElementById("menuExportJSON").disabled = !enabled;
    }

    function _closeActionMenu() {
      actionMenuOpen = false;
      document.getElementById("actionMenu").style.display = "none";
    }

    function _processMermaidInQuestions(paper) {
      for (var i = 0; i < paper.questions.length; i++) {
        if (paper.questions[i].mermaid) {
          var block = document.getElementById("qblock-" + i);
          if (block) {
            var container = MermaidInit.createContainer(
              paper.questions[i].mermaid,
            );
            block.appendChild(container);
          }
        }
      }
      MermaidInit.renderAll();
    }

    function _initDivider() {
      var divider = document.getElementById("divider");
      var panelLeft = document.getElementById("panelLeft");
      var panelRight = document.getElementById("panelRight");
      var mainEl = document.querySelector(".main");
      if (!divider || !mainEl) return;
      var isDragging = false;

      divider.addEventListener("mousedown", function (e) {
        isDragging = true;
        divider.classList.add("active");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        e.preventDefault();
      });

      document.addEventListener("mousemove", function (e) {
        if (!isDragging) return;
        var rect = mainEl.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var leftPercent = Math.max(20, Math.min(80, (x / rect.width) * 100));
        var rightPercent = 100 - leftPercent - (6 / rect.width) * 100;
        panelLeft.style.width = leftPercent + "%";
        panelRight.style.width = rightPercent + "%";
      });

      document.addEventListener("mouseup", function () {
        if (isDragging) {
          isDragging = false;
          divider.classList.remove("active");
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        }
      });
    }

    function setStatus(msg) {
      var el = document.getElementById("statusBar");
      if (el) el.textContent = msg;
    }

    function _handleFileImport(e) {
      var file = e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var parsed = JSON.parse(ev.target.result);

          var paper;
          if (parsed.questions && Array.isArray(parsed.questions)) {
            paper = parsed;
          } else if (Array.isArray(parsed)) {
            paper = {
              subject: document.getElementById("selSubject").value,
              grade: document.getElementById("selGrade").value,
              difficulty: document.getElementById("selDifficulty").value,
              topic:
                document.getElementById("topicInput").value.trim() || "综合",
              questions: parsed,
            };
          } else {
            paper = {
              subject: document.getElementById("selSubject").value,
              grade: document.getElementById("selGrade").value,
              difficulty: document.getElementById("selDifficulty").value,
              topic:
                document.getElementById("topicInput").value.trim() || "综合",
              questions: [parsed],
            };
          }

          if (!paper.questions || paper.questions.length === 0) {
            throw new Error("JSON 文件中没有找到题目");
          }

          currentPaper = paper;
          submitted = false;

          Renderer.renderAll(
            paper,
            document.getElementById("questionsContainer"),
            document.getElementById("answersContainer"),
          );

          _processMermaidInQuestions(paper);
          _setActionButtonsEnabled(true);
          setStatus("JSON 文件导入成功");
        } catch (err) {
          alert("解析 JSON 文件失败: " + err.message);
          console.error("File import error:", err);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    }

    // -------------------------------------------------------
    //  Init — run directly, DOM is already available
    //  (scripts are at bottom of <body>)
    // -------------------------------------------------------
    try {
      // Populate type selector
      onSubjectChange();

      // Init divider drag
      _initDivider();

      // Top bar buttons
      document
        .getElementById("btnGenerate")
        .addEventListener("click", openGenerateModal);
      document
        .getElementById("btnAction")
        .addEventListener("click", toggleActionMenu);
      document
        .getElementById("selSubject")
        .addEventListener("change", onSubjectChange);

      // Action menu buttons
      document.getElementById("menuSubmit").addEventListener("click", submit);
      document
        .getElementById("menuShowAnswer")
        .addEventListener("click", showAnswers);
      document
        .getElementById("menuExportJSON")
        .addEventListener("click", exportJSON);
      document
        .getElementById("menuImportJSON")
        .addEventListener("click", importJSONFile);

      // File input
      document
        .getElementById("jsonFileInput")
        .addEventListener("change", _handleFileImport);

      // Modal buttons
      document
        .getElementById("btnModalClose")
        .addEventListener("click", closeGenerateModal);
      document
        .getElementById("btnCancel")
        .addEventListener("click", closeGenerateModal);
      document
        .getElementById("btnImport")
        .addEventListener("click", importQuestion);
      document
        .getElementById("btnCopyInitial")
        .addEventListener("click", function () {
          copyText("modalInitialPrompt");
        });
      document
        .getElementById("btnCopyQuestion")
        .addEventListener("click", function () {
          copyText("modalQuestionPrompt");
        });

      // Close action menu on outside click
      document.addEventListener("click", function (e) {
        if (actionMenuOpen && !e.target.closest(".action-dropdown")) {
          _closeActionMenu();
        }
      });

      // Close modal on overlay click
      document
        .getElementById("generateModal")
        .addEventListener("click", function (e) {
          if (e.target === e.currentTarget) closeGenerateModal();
        });

      // Close modal on Escape
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          var modal = document.getElementById("generateModal");
          if (modal && modal.style.display !== "none") closeGenerateModal();
        }
      });

      setStatus("就绪");
    } catch (err) {
      console.error("App init error:", err);
    }

    return {
      onSubjectChange: onSubjectChange,
      openGenerateModal: openGenerateModal,
      closeGenerateModal: closeGenerateModal,
      copyText: copyText,
      importQuestion: importQuestion,
      toggleActionMenu: toggleActionMenu,
      submit: submit,
      showAnswers: showAnswers,
      exportJSON: exportJSON,
      importJSONFile: importJSONFile,
      isSubmitted: isSubmitted,
    };
  })();
  if (window.__scriptProbe) window.__scriptProbe.loaded.push("App");
  console.log("[task_generator] App loaded");
} catch (e) {
  console.error("[task_generator] App failed:", e);
}
