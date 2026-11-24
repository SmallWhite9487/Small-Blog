import hashlib
import json
import os
import re
import secrets
import tempfile
import threading
import webbrowser
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory
from werkzeug.serving import make_server

ROOT = Path(__file__).resolve().parent
ARTICLES = ROOT / "articles"
POSTS = ROOT / "posts.json"
TOKEN = secrets.token_urlsafe(32)
LOCK = threading.Lock()
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024


@app.before_request
def check_local_request():
    if request.host != app.config["EDITOR_HOST"]:
        abort(403)
    if request.path.startswith("/_editor/"):
        origin = request.headers.get("Origin")
        if origin is not None and origin != f"http://{app.config['EDITOR_HOST']}":
            abort(403)
        if not secrets.compare_digest(request.headers.get("X-Editor-Token", ""), TOKEN):
            abort(403)


@app.after_request
def secure_response(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


def article_path(filename):
    if (not isinstance(filename, str) or not filename.lower().endswith(".md") or
            not filename or filename in {".", ".."} or
            any(char in filename for char in '\\/:*?"<>|') or
            any(ord(char) < 32 for char in filename) or
            filename.rstrip(" .") != filename or
            re.match(r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", filename, re.I)):
        raise ValueError("檔名無效，請使用 articles 內的 .md 檔名。")
    path = ARTICLES / filename
    if path.is_symlink() or path.resolve().parent != ARTICLES.resolve():
        raise ValueError("不允許使用符號連結或 articles 以外的路徑。")
    return path


def revision(data):
    return hashlib.sha256(data).hexdigest()


def atomic_write(path, data):
    temp = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
            temp = Path(handle.name)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        if temp is not None and temp.exists():
            temp.unlink()


def post_entry(filename):
    name = filename
    priority = 0
    secret = False
    while True:
        match = re.match(r"^\[(T[1-3]?|S)\]", name)
        if not match:
            break
        tag = match.group(1)
        if tag == "S":
            secret = True
        else:
            level = 1 if tag == "T" else int(tag[1:])
            priority = max(priority, 4 - level)
        name = name[match.end():]
    date = re.match(r"^\d{4}-\d{2}-\d{2}", name)
    title = re.sub(r"^\d{4}-\d{2}-\d{2}[-_\s]+", "", name[:-3])
    return {"file": f"articles/{filename}", "title": title, "date": date.group() if date else "",
            "pinned": priority > 0, "priority": priority, "secret": secret}


@app.get("/")
def index():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    bootstrap = (f'<script>window.localEditorToken={json.dumps(TOKEN)};</script>'
                 '<script src="/editor.js"></script>')
    if "</body>" not in html:
        abort(500, "index.html 缺少 body 結尾。")
    return html.replace("</body>", bootstrap + "</body>", 1)


@app.get("/_editor/articles")
def list_articles():
    names = sorted((p.name for p in ARTICLES.iterdir()
                    if p.is_file() and not p.is_symlink() and p.suffix.lower() == ".md"), reverse=True)
    return jsonify(names)


@app.get("/_editor/article")
def get_article():
    try:
        path = article_path(request.args.get("name"))
        data = path.read_bytes()
        return jsonify(name=path.name, source=data.decode("utf-8"), revision=revision(data))
    except (ValueError, UnicodeError) as error:
        return jsonify(error=str(error)), 400
    except FileNotFoundError:
        return jsonify(error="文章不存在。"), 404


@app.post("/_editor/article")
def save_article():
    payload = request.get_json()
    if not isinstance(payload, dict) or not isinstance(payload.get("source"), str):
        return jsonify(error="請提供文章內容。"), 400
    try:
        path = article_path(payload.get("name"))
        source = payload["source"].encode("utf-8")
        expected = payload.get("revision")
        with LOCK:
            if expected is None:
                posts = json.loads(POSTS.read_text(encoding="utf-8"))
                if not isinstance(posts, list):
                    raise ValueError("posts.json 格式錯誤。")
                if any(isinstance(post, dict) and post.get("file") == f"articles/{path.name}" for post in posts):
                    return jsonify(error="文章列表中已有同名檔案，請檢查後再試。"), 409
                with path.open("xb") as handle:
                    handle.write(source)
                    handle.flush()
                    os.fsync(handle.fileno())
                try:
                    posts.insert(0, post_entry(path.name))
                    atomic_write(POSTS, (json.dumps(posts, ensure_ascii=False, indent=4) + "\n").encode("utf-8"))
                except (OSError, ValueError):
                    if path.exists() and revision(path.read_bytes()) == revision(source):
                        path.unlink()
                    raise
            else:
                if not isinstance(expected, str) or not re.fullmatch(r"[a-f0-9]{64}", expected):
                    return jsonify(error="文章版本無效。"), 400
                if revision(path.read_bytes()) != expected:
                    return jsonify(error="文章已在外部修改，未覆蓋。請複製內容後重新載入。"), 409
                atomic_write(path, source)
        return jsonify(name=path.name, revision=revision(source))
    except FileExistsError:
        return jsonify(error="同名文章已存在，未覆蓋。"), 409
    except FileNotFoundError:
        return jsonify(error="文章或 posts.json 不存在，未儲存。"), 404
    except (ValueError, UnicodeError) as error:
        return jsonify(error=str(error)), 400
    except OSError as error:
        app.logger.exception("儲存文章失敗")
        return jsonify(error=f"儲存失敗：{error}"), 500


@app.get("/<path:filename>")
def static_file(filename):
    path = (ROOT / filename).resolve()
    allowed = (filename in {"editor.js", "style.css", "banner.js", "blog.js",
                            "timer-profile.js", "markdown-extensions.js", "posts.json"} or
               filename.startswith(("articles/", "items/")))
    if not allowed or not path.is_relative_to(ROOT) or not path.is_file():
        abort(404)
    return send_from_directory(ROOT, filename)


if __name__ == "__main__":
    server = make_server("127.0.0.1", 0, app, threaded=True)
    app.config["EDITOR_HOST"] = f"127.0.0.1:{server.server_port}"
    url = f"http://{app.config['EDITOR_HOST']}/"
    print(f"本地文章編輯器：{url}\n按 Ctrl+C 結束。", flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n編輯器已關閉。")
    finally:
        server.server_close()
