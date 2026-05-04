#!/usr/bin/env python3
"""Task Generator - Local server.

Serves the frontend and provides API endpoints:
  GET  /api/prompts       — generate prompts from declaration files
  POST /export-mermaid    — render Mermaid diagrams to SVG (via mermaid-cli)
  GET  /*                 — static files from static/
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import uuid
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import parse_qs, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
IMAGE_DIR = os.path.join(BASE_DIR, "images")
DECLARATION_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "declaration"))

SUBJECT_DECLARATION = {
    "math": "数学.md",
    "physics": "物理.md",
    "chemistry": "化学.md",
    "biology": "生物.md",
    "english": "英语.md",
}

SUBJECT_NAMES = {
    "math": "数学",
    "physics": "物理",
    "chemistry": "化学",
    "biology": "生物",
    "english": "英语",
}

TYPE_NAMES = {
    "single_choice": "单选题",
    "multiple_choice": "多选题",
    "fill_blank": "填空题",
    "true_false": "判断题",
    "short_answer": "简答题",
    "calculation": "解答题",
    "ordering": "排序题",
    "matching": "匹配题",
    "cloze": "完形填空",
    "seven_choose_five": "七选五",
    "writing": "写作题",
    "grammar_cloze": "语法填空",
}


def read_declaration(filename):
    path = os.path.join(DECLARATION_DIR, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return None


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path == "/" or path == "/index.html":
            return os.path.join(STATIC_DIR, "index.html")
        rel = path.lstrip("/")
        abspath = os.path.join(STATIC_DIR, rel)
        if os.path.isfile(abspath):
            return abspath
        return os.path.join(STATIC_DIR, "index.html")

    def do_GET(self):
        if self.path.startswith("/api/prompts"):
            self._handle_prompts()
            return
        if self.path.startswith("/images/"):
            img_path = os.path.join(BASE_DIR, self.path.lstrip("/"))
            if os.path.isfile(img_path):
                self._serve_file(img_path)
                return
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/export-mermaid":
            self._handle_export_mermaid()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "3600")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    # ------------------------------------------------------------------ #
    #  GET /api/prompts  —  Generate prompts from declaration files       #
    # ------------------------------------------------------------------ #
    def _handle_prompts(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        subject = params.get("subject", ["math"])[0]
        grade = params.get("grade", ["高三"])[0]
        difficulty = params.get("difficulty", ["高考"])[0]
        topic = params.get("topic", ["综合"])[0]
        qtype = params.get("type", ["single_choice"])[0]

        # Read 题目类型.md for initial prompt
        schema_content = read_declaration("题目类型.md")
        if schema_content is None:
            self._json_error(500, "题目类型.md not found in declaration directory")
            return

        initial_prompt = (
            "你是一个高考出题专家。以下是所有题目类型的JSON格式规范，"
            "请严格按照此规范输出题目。\n\n"
            "--- 题目类型与JSON格式规范 ---\n\n" + schema_content
        )

        # Read subject-specific declaration for question prompt
        subject_file = SUBJECT_DECLARATION.get(subject)
        subject_name = SUBJECT_NAMES.get(subject, subject)
        type_name = TYPE_NAMES.get(qtype, qtype)

        subject_content = ""
        if subject_file:
            subject_content = read_declaration(subject_file) or ""

        question_prompt = (
            f'请生成一道{grade}{difficulty}{subject_name}{type_name}，主题为"{topic}"。\n\n'
            f"--- {subject_name}出题指南 ---\n\n"
            + subject_content
            + f"\n\n--- 具体要求 ---\n\n"
            f"1. 只生成一道{type_name}\n"
            f"2. 严格按照上方JSON格式规范输出\n"
            f"3. 难度为{difficulty}水平\n"
            f'4. 主题为"{topic}"\n'
            f"5. 只返回单个题目对象的JSON，不要包含外层的subject/grade/difficulty包装\n"
            f"6. 只返回JSON，不要返回其他内容"
        )

        self._json_response(
            200,
            {
                "initialPrompt": initial_prompt,
                "questionPrompt": question_prompt,
            },
        )

    # ------------------------------------------------------------------ #
    #  POST /export-mermaid  —  Render Mermaid to SVG                    #
    # ------------------------------------------------------------------ #
    def _handle_export_mermaid(self):
        body = self._read_body()
        if body is None:
            return

        try:
            req = json.loads(body)
        except json.JSONDecodeError:
            self._json_error(400, "Invalid JSON body")
            return

        mermaid_code = req.get("code", "")
        if not mermaid_code:
            self._json_error(400, "Missing 'code' field")
            return

        os.makedirs(IMAGE_DIR, exist_ok=True)
        mmd_id = uuid.uuid4().hex[:12]
        mmd_path = os.path.join(IMAGE_DIR, f"{mmd_id}.mmd")
        svg_path = os.path.join(IMAGE_DIR, f"{mmd_id}.svg")

        with open(mmd_path, "w") as f:
            f.write(mermaid_code)

        mmdc = shutil.which("mmdc")
        if mmdc:
            try:
                subprocess.run(
                    [mmdc, "-i", mmd_path, "-o", svg_path, "-b", "transparent"],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if os.path.isfile(svg_path):
                    with open(svg_path, "r") as f:
                        svg = f.read()
                    os.remove(mmd_path)
                    self.send_response(200)
                    self.send_header("Content-Type", "image/svg+xml")
                    self._cors_headers()
                    self.end_headers()
                    self.wfile.write(svg.encode("utf-8"))
                    return
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass

        os.remove(mmd_path) if os.path.exists(mmd_path) else None
        self._json_response(200, {"mermaid": mermaid_code, "rendered": False})

    # ------------------------------------------------------------------ #
    #  Helpers                                                            #
    # ------------------------------------------------------------------ #
    def _read_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self._json_error(400, "Empty body")
            return None
        return self.rfile.read(content_length)

    def _serve_file(self, filepath):
        try:
            with open(filepath, "rb") as f:
                data = f.read()
            ext = os.path.splitext(filepath)[1].lower()
            ct = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
                ".webp": "image/webp",
            }.get(ext, "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", ct)
            self.send_header("Content-Length", str(len(data)))
            self._cors_headers()
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404)

    def _json_response(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json_error(self, code, message):
        self._json_response(code, {"error": message})

    def log_message(self, format, *args):
        sys.stderr.write(f"[server] {format % args}\n")
        sys.stderr.flush()


def main():
    parser = argparse.ArgumentParser(description="Task Generator - Local Server")
    parser.add_argument("--port", type=int, default=8080, help="Port (default: 8080)")
    args = parser.parse_args()

    os.makedirs(IMAGE_DIR, exist_ok=True)

    server = ThreadedHTTPServer(("", args.port), Handler)
    print(f"Serving at http://localhost:{args.port}")
    print(
        f"Prompts:   GET  http://localhost:{args.port}/api/prompts?subject=math&grade=高三&difficulty=高考&type=single_choice"
    )
    print(f"Mermaid:   POST http://localhost:{args.port}/export-mermaid")
    print(f"Static dir: {STATIC_DIR}")
    print(f"Declaration dir: {DECLARATION_DIR}")
    print(f"Image dir: {IMAGE_DIR}")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
