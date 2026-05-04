/**
 * grader.js — Answer grading and result display
 */
try {
  window.Grader = (() => {
    const LABELS = "ABCD";

    /**
     * Grade all questions and return results.
     * @param {Array} questions
     * @returns {{ total: number, correct: number, details: Array, unanswered: number }}
     */
    function grade(questions) {
      let correct = 0;
      let unanswered = 0;
      const details = [];

      questions.forEach((q, i) => {
        const result = _gradeOne(q, i);
        details.push(result);
        if (result.unanswered) unanswered++;
        if (result.correct) correct++;
      });

      return { total: questions.length, correct, unanswered, details };
    }

    /**
     * Apply grading results to the DOM (color coding).
     */
    function applyResults(questions, details) {
      questions.forEach((q, i) => {
        _applyOne(q, i, details[i]);
      });
    }

    // =======================================================

    function _gradeOne(q, idx) {
      switch (q.type) {
        case "single_choice":
          return _gradeSingleChoice(q, idx);
        case "multiple_choice":
          return _gradeMultipleChoice(q, idx);
        case "true_false":
          return _gradeTrueFalse(q, idx);
        case "fill_blank":
          return _gradeFillBlank(q, idx);
        case "calculation":
          return _gradeCalculation(q, idx);
        case "ordering":
          return _gradeOrdering(q, idx);
        case "matching":
          return _gradeMatching(q, idx);
        case "cloze":
          return _gradeCloze(q, idx);
        case "grammar_cloze":
          return _gradeGrammarCloze(q, idx);
        case "seven_choose_five":
          return _gradeSCF(q, idx);
        case "short_answer":
        case "writing":
          return { correct: null, unanswered: false, partial: true };
        default:
          return { correct: false, unanswered: true };
      }
    }

    // -- Single Choice --
    function _gradeSingleChoice(q, idx) {
      let userAns = null;
      for (let i = 0; i < q.options.length; i++) {
        const btn = document.getElementById(`opt-${idx}-${i}`);
        if (btn && btn.classList.contains("selected")) {
          userAns = i;
          break;
        }
      }
      if (userAns === null)
        return {
          correct: false,
          unanswered: true,
          userAns,
          correctAns: q.answer,
        };
      return {
        correct: userAns === q.answer,
        unanswered: false,
        userAns,
        correctAns: q.answer,
      };
    }

    // -- Multiple Choice --
    function _gradeMultipleChoice(q, idx) {
      const userSet = new Set();
      for (let i = 0; i < q.options.length; i++) {
        const btn = document.getElementById(`opt-${idx}-${i}`);
        if (btn && btn.classList.contains("selected")) userSet.add(i);
      }
      const correctSet = new Set(q.answers);
      if (userSet.size === 0)
        return {
          correct: false,
          unanswered: true,
          userSet: [...userSet],
          correctSet: [...correctSet],
          partial: false,
        };
      const isExact =
        userSet.size === correctSet.size &&
        [...userSet].every((x) => correctSet.has(x));
      const isPartial =
        [...userSet].every((x) => correctSet.has(x)) &&
        userSet.size < correctSet.size &&
        userSet.size > 0;
      return {
        correct: isExact,
        unanswered: false,
        userSet: [...userSet],
        correctSet: [...correctSet],
        partial: isPartial,
      };
    }

    // -- True/False --
    function _gradeTrueFalse(q, idx) {
      const btn0 = document.getElementById(`tf-${idx}-0`);
      const btn1 = document.getElementById(`tf-${idx}-1`);
      let userAns = null;
      if (btn0 && btn0.classList.contains("selected")) userAns = true;
      if (btn1 && btn1.classList.contains("selected")) userAns = false;
      if (userAns === null)
        return {
          correct: false,
          unanswered: true,
          userAns,
          correctAns: q.answer,
        };
      return {
        correct: userAns === q.answer,
        unanswered: false,
        userAns,
        correctAns: q.answer,
      };
    }

    // -- Fill Blank --
    function _gradeFillBlank(q, idx) {
      if (!q.blanks) return { correct: false, unanswered: true };
      let allCorrect = true;
      let anyFilled = false;
      const blankResults = [];

      q.blanks.forEach((b, bi) => {
        const input = document.getElementById(`fb-${idx}-${bi}`);
        const userVal = input ? input.value.trim() : "";
        if (userVal) anyFilled = true;
        const isCorrect = b.acceptable_answers.some(
          (a) => userVal.toLowerCase() === a.toLowerCase(),
        );
        blankResults.push({ index: bi, userVal, isCorrect });
        if (!isCorrect) allCorrect = false;
      });

      return {
        correct: allCorrect && anyFilled,
        unanswered: !anyFilled,
        blankResults,
      };
    }

    // -- Calculation --
    function _gradeCalculation(q, idx) {
      const input = document.getElementById(`calc-ans-${idx}`);
      const userVal = input ? input.value.trim() : "";
      if (!userVal) return { correct: false, unanswered: true };
      const isCorrect = q.acceptable_answers
        ? q.acceptable_answers.some(
            (a) => userVal.toLowerCase() === a.toLowerCase(),
          )
        : userVal.toLowerCase() === q.final_answer.toLowerCase();
      return { correct: isCorrect, unanswered: false, userVal };
    }

    // -- Ordering --
    function _gradeOrdering(q, idx) {
      const list = document.getElementById(`order-${idx}`);
      if (!list) return { correct: false, unanswered: true };
      const items = list.querySelectorAll(".order-item");
      const userOrder = [...items].map((li) => parseInt(li.dataset.origIdx));
      const isCorrect = q.correct_order.every((v, i) => v === userOrder[i]);
      return { correct: isCorrect, unanswered: false, userOrder };
    }

    // -- Matching --
    function _gradeMatching(q, idx) {
      let allCorrect = true;
      const pairResults = [];
      q.left.forEach((_, li) => {
        const sel = document.getElementById(`match-sel-${idx}-${li}`);
        const userVal = sel ? sel.value : "";
        const correctVal = String(q.correct_pairs[String(li)]);
        const isCorrect = userVal === correctVal;
        if (!isCorrect) allCorrect = false;
        pairResults.push({ leftIdx: li, userVal, correctVal, isCorrect });
      });
      return { correct: allCorrect, unanswered: false, pairResults };
    }

    // -- Cloze --
    function _gradeCloze(q, idx) {
      if (!q.blanks) return { correct: false, unanswered: true };
      let allCorrect = true;
      const blankResults = [];
      q.blanks.forEach((b) => {
        const sel = document.getElementById(`cloze-${idx}-${b.index}`);
        const userVal = sel ? sel.value : "";
        const isCorrect = parseInt(userVal) === b.answer;
        if (!isCorrect) allCorrect = false;
        blankResults.push({ index: b.index, userVal, isCorrect });
      });
      return { correct: allCorrect, unanswered: false, blankResults };
    }

    // -- Grammar Cloze --
    function _gradeGrammarCloze(q, idx) {
      if (!q.blanks) return { correct: false, unanswered: true };
      let allCorrect = true;
      const blankResults = [];
      q.blanks.forEach((b) => {
        const input = document.getElementById(`cloze-${idx}-${b.index}`);
        const userVal = input ? input.value.trim() : "";
        const isCorrect = b.acceptable_answers
          ? b.acceptable_answers.some(
              (a) => userVal.toLowerCase() === a.toLowerCase(),
            )
          : userVal.toLowerCase() === b.answer.toLowerCase();
        if (!isCorrect) allCorrect = false;
        blankResults.push({ index: b.index, userVal, isCorrect });
      });
      return { correct: allCorrect, unanswered: false, blankResults };
    }

    // -- Seven Choose Five --
    function _gradeSCF(q, idx) {
      let allCorrect = true;
      const blankResults = [];
      for (let num = 1; num <= 5; num++) {
        const sel = document.getElementById(`scf-${idx}-${num}`);
        const userVal = sel ? sel.value : "";
        const correctVal = q.answers[String(num)];
        const isCorrect = parseInt(userVal) === correctVal;
        if (!isCorrect) allCorrect = false;
        blankResults.push({ index: num, userVal, isCorrect });
      }
      return { correct: allCorrect, unanswered: false, blankResults };
    }

    // =======================================================
    //  Apply grading results to DOM
    // =======================================================

    function _applyOne(q, idx, result) {
      switch (q.type) {
        case "single_choice":
          _applySingleChoice(q, idx, result);
          break;
        case "multiple_choice":
          _applyMultipleChoice(q, idx, result);
          break;
        case "true_false":
          _applyTrueFalse(q, idx, result);
          break;
        case "fill_blank":
          _applyFillBlank(q, idx, result);
          break;
        case "calculation":
          _applyCalculation(q, idx, result);
          break;
        case "ordering":
          _applyOrdering(q, idx, result);
          break;
        case "matching":
          _applyMatching(q, idx, result);
          break;
        case "cloze":
          _applyCloze(q, idx, result);
          break;
        case "grammar_cloze":
          _applyGrammarCloze(q, idx, result);
          break;
        case "seven_choose_five":
          _applySCF(q, idx, result);
          break;
        case "short_answer":
          _applyShortAnswer(q, idx);
          break;
        case "writing":
          _applyWriting(q, idx);
          break;
      }
    }

    function _applySingleChoice(q, idx, r) {
      for (let i = 0; i < q.options.length; i++) {
        const btn = document.getElementById(`opt-${idx}-${i}`);
        if (!btn) continue;
        if (i === r.correctAns) {
          btn.className = "option-btn correct-answer";
        } else if (i === r.userAns && !r.correct) {
          btn.className = "option-btn wrong";
        }
      }
    }

    function _applyMultipleChoice(q, idx, r) {
      const correctSet = new Set(r.correctSet);
      const userSet = new Set(r.userSet);
      for (let i = 0; i < q.options.length; i++) {
        const btn = document.getElementById(`opt-${idx}-${i}`);
        if (!btn) continue;
        if (correctSet.has(i)) btn.className = "option-btn correct-answer";
        else if (userSet.has(i)) btn.className = "option-btn wrong";
      }
    }

    function _applyTrueFalse(q, idx, r) {
      for (let i = 0; i < 2; i++) {
        const btn = document.getElementById(`tf-${idx}-${i}`);
        if (!btn) continue;
        const val = i === 0;
        if (val === r.correctAns) btn.className = "tf-btn correct-answer";
        else if (val === r.userAns && !r.correct)
          btn.className = "tf-btn wrong";
      }
    }

    function _applyFillBlank(q, idx, r) {
      if (!r.blankResults) return;
      r.blankResults.forEach((br) => {
        const input = document.getElementById(`fb-${idx}-${br.index}`);
        if (input)
          input.className = `blank-input ${br.isCorrect ? "correct" : "wrong"}`;
        const exp = document.getElementById(`fb-exp-${idx}-${br.index}`);
        if (exp) exp.classList.add("visible");
      });
    }

    function _applyCalculation(q, idx, r) {
      const input = document.getElementById(`calc-ans-${idx}`);
      if (input)
        input.className = `blank-input ${r.correct ? "correct" : "wrong"}`;
      const steps = document.getElementById(`calc-steps-${idx}`);
      if (steps) steps.classList.add("visible");
    }

    function _applyOrdering(q, idx, r) {
      const list = document.getElementById(`order-${idx}`);
      if (!list) return;
      const items = list.querySelectorAll(".order-item");
      items.forEach((li, i) => {
        const origIdx = parseInt(li.dataset.origIdx);
        li.className = `order-item ${origIdx === q.correct_order[i] ? "correct" : "wrong"}`;
      });
    }

    function _applyMatching(q, idx, r) {
      if (!r.pairResults) return;
      r.pairResults.forEach((pr) => {
        const row = document.getElementById(`match-${idx}-${pr.leftIdx}`);
        if (row)
          row.className = `match-row ${pr.isCorrect ? "correct" : "wrong"}`;
      });
    }

    function _applyCloze(q, idx, r) {
      if (!r.blankResults) return;
      r.blankResults.forEach((br) => {
        const sel = document.getElementById(`cloze-${idx}-${br.index}`);
        if (sel)
          sel.className = `cloze-select ${br.isCorrect ? "correct" : "wrong"}`;
      });
    }

    function _applyGrammarCloze(q, idx, r) {
      if (!r.blankResults) return;
      r.blankResults.forEach((br) => {
        const input = document.getElementById(`cloze-${idx}-${br.index}`);
        if (input)
          input.className = `cloze-input ${br.isCorrect ? "correct" : "wrong"}`;
      });
    }

    function _applySCF(q, idx, r) {
      if (!r.blankResults) return;
      r.blankResults.forEach((br) => {
        const sel = document.getElementById(`scf-${idx}-${br.index}`);
        if (sel)
          sel.className = `cloze-select ${br.isCorrect ? "correct" : "wrong"}`;
      });
    }

    function _applyShortAnswer(q, idx) {
      const ref = document.getElementById(`sa-ref-${idx}`);
      if (ref) ref.classList.add("visible");
      // Highlight keywords
      const ta = document.getElementById(`sa-${idx}`);
      if (ta && q.keywords) {
        const text = ta.value.toLowerCase();
        ref.querySelectorAll(".keywords span").forEach((span) => {
          const kw = span.textContent.trim();
          if (text.includes(kw.toLowerCase())) span.classList.add("hit");
        });
      }
    }

    function _applyWriting(q, idx) {
      const ref = document.getElementById(`writing-ref-${idx}`);
      if (ref) ref.classList.add("visible");
    }

    return { grade, applyResults };
  })();
  if (window.__scriptProbe) window.__scriptProbe.loaded.push("Grader");
  console.log("[task_generator] Grader loaded");
} catch (e) {
  console.error("[task_generator] Grader failed:", e);
}
