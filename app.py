import sqlite3
import os
import hashlib
import secrets
from flask import Flask, render_template, request, jsonify, session

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

DB_PATH = os.path.join(os.path.dirname(__file__), "wordle.db")


# ---------------------------------------------------------------------------
# Databáza – inicializácia
# ---------------------------------------------------------------------------

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    # Tabuľka používateľov
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            email     TEXT    UNIQUE NOT NULL,
            password  TEXT    NOT NULL,
            name      TEXT    NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now'))
        )
    """)

    # Tabuľka slov
    c.execute("""
        CREATE TABLE IF NOT EXISTS words (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT UNIQUE NOT NULL
        )
    """)

    # Tabuľka skóre (jedno najlepšie skóre na používateľa)
    c.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id        INTEGER NOT NULL REFERENCES users(id),
            attempts       INTEGER NOT NULL,
            elapsed_seconds INTEGER NOT NULL,
            score          INTEGER NOT NULL,
            word           TEXT    NOT NULL,
            updated_at     INTEGER DEFAULT (strftime('%s','now'))
        )
    """)

    # Naplniť slová ak je tabuľka prázdna
    words = [
        "MACKA", "KNIHA", "SKOLA", "HRADY", "KVETY",
        "MESTO", "PLAME", "STROM", "VLAKY", "OBLAK",
        "MOREA", "KARTA", "LAMPA", "CESTA", "PESIA",
        "RUKAV", "SLOVO", "DENIK", "NOZIK", "ZEBRA",
    ]
    c.executemany(
        "INSERT OR IGNORE INTO words (word) VALUES (?)",
        [(w,) for w in words]
    )

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Pomocné funkcie
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def current_user_id():
    return session.get("user_id")


# ---------------------------------------------------------------------------
# Routes – stránka
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# API – auth
# ---------------------------------------------------------------------------

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or email.split("@")[0]).strip()

    if not email or not password:
        return jsonify({"error": "Email a heslo sú povinné."}), 400
    if len(password) < 6:
        return jsonify({"error": "Heslo musí mať aspoň 6 znakov."}), 400

    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
            (email, hash_password(password), name)
        )
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        session["user_id"] = user["id"]
        session["user_name"] = user["name"]
        return jsonify({"id": user["id"], "name": user["name"], "email": email})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email je už zaregistrovaný."}), 409
    finally:
        conn.close()


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE email = ? AND password = ?",
        (email, hash_password(password))
    ).fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "Nesprávny email alebo heslo."}), 401

    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    return jsonify({"id": user["id"], "name": user["name"], "email": email})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me")
def me():
    uid = current_user_id()
    if not uid:
        return jsonify({"user": None})
    conn = get_db()
    user = conn.execute("SELECT id, name, email FROM users WHERE id = ?", (uid,)).fetchone()
    conn.close()
    if not user:
        return jsonify({"user": None})
    return jsonify({"user": {"id": user["id"], "name": user["name"], "email": user["email"]}})


# ---------------------------------------------------------------------------
# API – slová
# ---------------------------------------------------------------------------

@app.route("/api/word/random")
def random_word():
    conn = get_db()
    row = conn.execute("SELECT word FROM words ORDER BY RANDOM() LIMIT 1").fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Žiadne slová v databáze."}), 500
    return jsonify({"word": row["word"]})


# ---------------------------------------------------------------------------
# API – skóre
# ---------------------------------------------------------------------------

@app.route("/api/score", methods=["POST"])
def save_score():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "Nie si prihlásený."}), 401

    data = request.get_json()
    attempts = int(data["attempts"])
    elapsed = int(data["elapsedSeconds"])
    word = data["word"]
    score = attempts * 1000 + elapsed

    conn = get_db()
    existing = conn.execute("SELECT * FROM scores WHERE user_id = ?", (uid,)).fetchone()

    if not existing:
        conn.execute(
            "INSERT INTO scores (user_id, attempts, elapsed_seconds, score, word) VALUES (?, ?, ?, ?, ?)",
            (uid, attempts, elapsed, score, word)
        )
        conn.commit()
        conn.close()
        return jsonify({"saved": True, "newRecord": True})

    if score < existing["score"]:
        conn.execute(
            """UPDATE scores
               SET attempts=?, elapsed_seconds=?, score=?, word=?,
                   updated_at=strftime('%s','now')
               WHERE user_id=?""",
            (attempts, elapsed, score, word, uid)
        )
        conn.commit()
        conn.close()
        return jsonify({"saved": True, "newRecord": True})

    conn.close()
    return jsonify({
        "saved": False,
        "newRecord": False,
        "oldAttempts": existing["attempts"],
        "oldSeconds": existing["elapsed_seconds"],
    })


@app.route("/api/leaderboard")
def leaderboard():
    conn = get_db()
    rows = conn.execute("""
        SELECT u.name, s.attempts, s.elapsed_seconds, s.score, s.word
        FROM scores s
        JOIN users u ON u.id = s.user_id
        ORDER BY s.score ASC
        LIMIT 10
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    app.run(debug=True)