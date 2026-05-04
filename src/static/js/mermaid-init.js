/**
 * mermaid-init.js — Mermaid diagram initialization and rendering
 * Handles the case where Mermaid CDN loads async and may not be ready yet.
 */
try {
  window.MermaidInit = (() => {
    var initialized = false;
    var pendingRenders = [];

    function init() {
      if (initialized) return true;
      if (typeof mermaid === "undefined") return false;
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          fontFamily:
            '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        });
        initialized = true;
        // Flush any pending renders
        if (pendingRenders.length > 0) {
          pendingRenders.forEach(function (fn) {
            fn();
          });
          pendingRenders = [];
        }
        return true;
      } catch (err) {
        console.warn("Mermaid init error:", err);
        return false;
      }
    }

    /**
     * Find all .mermaid-container elements with data-code
     * and render them as Mermaid diagrams.
     */
    function renderAll() {
      if (!init()) {
        // Mermaid not loaded yet — try again when it loads
        pendingRenders.push(renderAll);
        return;
      }
      var containers = document.querySelectorAll(
        ".mermaid-container[data-code]",
      );
      for (var i = 0; i < containers.length; i++) {
        var el = containers[i];
        if (el.dataset.rendered) continue;
        try {
          (function (element) {
            mermaid
              .render(
                "mermaid-" +
                  Date.now() +
                  "-" +
                  Math.random().toString(36).slice(2, 6),
                element.dataset.code,
              )
              .then(function (result) {
                element.innerHTML = result.svg;
                element.dataset.rendered = "true";
              })
              .catch(function (err) {
                console.warn("Mermaid render error:", err);
                element.innerHTML =
                  '<pre style="color:#ff4d4f;font-size:13px;">Mermaid 渲染失败</pre>';
              });
          })(el);
        } catch (err) {
          console.warn("Mermaid render error:", err);
          el.innerHTML =
            '<pre style="color:#ff4d4f;font-size:13px;">Mermaid 渲染失败</pre>';
        }
      }
    }

    /**
     * Create a Mermaid container element from code.
     */
    function createContainer(code) {
      var div = document.createElement("div");
      div.className = "mermaid-container";
      div.dataset.code = code;
      div.textContent = "加载图表...";
      return div;
    }

    return {
      init: init,
      renderAll: renderAll,
      createContainer: createContainer,
    };
  })();
  if (window.__scriptProbe) window.__scriptProbe.loaded.push("MermaidInit");
  console.log("[task_generator] MermaidInit loaded");
} catch (e) {
  console.error("[task_generator] MermaidInit failed:", e);
}
