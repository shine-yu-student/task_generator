/**
 * api.js — Server communication module
 */
try {
  window.API = (function () {
    function _post(endpoint, body) {
      return fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "请求失败: " + res.status);
          return data;
        });
      });
    }

    function _get(endpoint) {
      return fetch(endpoint).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "请求失败: " + res.status);
          return data;
        });
      });
    }

    function fetchPrompts(subject, grade, difficulty, topic, type) {
      var params = new URLSearchParams({
        subject: subject,
        grade: grade,
        difficulty: difficulty,
        topic: topic,
        type: type,
      });
      return _get("/api/prompts?" + params);
    }

    function exportMermaid(code) {
      return _post("/export-mermaid", { code: code });
    }

    function exportGclc(code) {
      return _post("/export-gclc", { code: code });
    }

    function extractJSON(text) {
      var match = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (match) return match[1].trim();
      try {
        JSON.parse(text);
        return text;
      } catch (e) {}
      return text;
    }

    return {
      fetchPrompts: fetchPrompts,
      exportMermaid: exportMermaid,
      exportGclc: exportGclc,
      extractJSON: extractJSON,
    };
  })();
  console.log("[task_generator] API loaded");
} catch (e) {
  console.error("[task_generator] API failed:", e);
}
