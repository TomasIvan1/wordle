import os
import random
import secrets
import requests
from flask import Flask, render_template, request, jsonify, session

import firebase_admin
from firebase_admin import auth, credentials

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

DB_URL = "https://wordle-e5e3d-default-rtdb.europe-west1.firebasedatabase.app"

try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
except Exception as e:
    print("Firebase init error:", e)

WORDS = [
    "OBRAZ", "SLOVO", "MESTO", "STROM", "LISKA", "MACKA", "KNIHA", "SKOLA", "VLAKY", "OBLAK",
    "LAMPA", "CESTA", "RUKAV", "NOZIK", "ZEBRA", "DVERE", "STENA", "KVETY", "HRADY", "PISMO",
    "FARBA", "KARTA", "BRANA", "DUSIK", "HUSLE", "BUBON", "VLAHA", "POHAR", "RYBAR", "DOSKA",
    "HLINA", "SLNKO", "TEPLO", "ZLATO", "KABAT", "BUNDA", "SALKA", "MISKA", "VEDRO", "METLA",
    "ZIVOT", "KAKAO", "MRKVA", "KAPOR", "ZAJAC", "HOLUB", "KOCKA", "SOKOL", "ZAMOK", "KLUCE",
    "KRUHY", "LODKA", "MASLO", "CHYBA", "TIGER", "VODKA", "SIRUP", "ROZOK", "KOLAC", "GULAS",
    "SALAT", "VECER", "VEDEC", "ZOSIT", "PASIK", "SOCHA", "HEREC", "TANEC", "SPORT", "HOKEJ",
    "TENIS", "BAZEN", "SKALA", "KOREN", "TRAVA", "SANKY", "BAGER", "ZAKON", "PRAVO", "VYZVA",
    "NAZOR", "SMERY", "VOLBA", "SATKA", "BRADA", "HLAVA", "PALEC", "NAROD", "ZASAH", "TOVAR",
    "OBJAV", "NAKUP", "VYPIS", "KOSIK", "PEKAR", "MLYNY", "FARMA", "KRAVA", "PRASA", "BARAN",
    "SOMAR", "MIERA", "SKORE", "ANJEL"
]

def current_user_token():
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split("Bearer ")[1]
    return None

def current_user_id():
    token = current_user_token()
    if token:
        decoded = verify_token(token)
        if decoded:
            return decoded["uid"]
    return session.get("user_id")

def current_decoded_token():
    token = current_user_token()
    if token:
        return verify_token(token)
    return None

def verify_token(id_token: str):
    try:
        return auth.verify_id_token(id_token)
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    id_token = data.get("idToken") or ""

    decoded = verify_token(id_token)
    if not decoded:
        return jsonify({"error": "Neplatný token."}), 401

    uid = decoded["uid"]
    email = decoded.get("email", "")
    name = decoded.get("name") or data.get("name") or email.split("@")[0] if email else "Anonym"

    session["user_id"] = uid
    session["user_name"] = name

    auth_param = f"?auth={id_token}"
    requests.patch(f"{DB_URL}/players/{uid}.json{auth_param}", json={"lastLoginAt": {"$sv": "timestamp"}, "name": name})
    requests.patch(f"{DB_URL}/users/{uid}.json{auth_param}", json={
        "name": name,
        "email": email,
        "lastLoginAt": {"$sv": "timestamp"},
    })

    return jsonify({"uid": uid, "name": name, "email": email})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me")
def me():
    decoded = current_decoded_token()
    if not decoded:
        return jsonify({"user": None})
    uid = decoded["uid"]
    name = decoded.get("name") or decoded.get("email", "").split("@")[0]
    return jsonify({"user": {"uid": uid, "name": name, "email": decoded.get("email")}})


@app.route("/api/user/name", methods=["POST"])
def update_name():
    uid = current_user_id()
    token = current_user_token()
    if not uid:
        return jsonify({"error": "Nie si prihlásený."}), 401

    data = request.get_json()
    new_name = (data.get("name") or "").strip()
    if not new_name:
        return jsonify({"error": "Meno nemôže byť prázdne."}), 400

    try:
        # Frontend updates profile directly, backend just updates DB
        auth_param = f"?auth={token}" if token else ""
        requests.patch(f"{DB_URL}/users/{uid}.json{auth_param}", json={"name": new_name})
        requests.patch(f"{DB_URL}/players/{uid}.json{auth_param}", json={"name": new_name})

        score_res = requests.get(f"{DB_URL}/scores/{uid}.json{auth_param}")
        if score_res.status_code == 200 and score_res.json():
            requests.patch(f"{DB_URL}/scores/{uid}.json{auth_param}", json={"name": new_name})

        session["user_name"] = new_name
        return jsonify({"ok": True, "name": new_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/word/random")
def random_word():
    return jsonify({"word": random.choice(WORDS)})


@app.route("/api/score", methods=["POST"])
def save_score():
    decoded = current_decoded_token()
    token = current_user_token()
    if not decoded:
        return jsonify({"error": "Nie si prihlásený."}), 401

    uid = decoded["uid"]
    
    data = request.get_json()
    attempts = int(data["attempts"])
    elapsed = int(data["elapsedSeconds"])
    word = data["word"]
    won = bool(data.get("won", True))
    score = attempts * 1000 + elapsed

    auth_param = f"?auth={token}" if token else ""
    user_res = requests.get(f"{DB_URL}/users/{uid}.json{auth_param}")
    user_data = user_res.json() if user_res.status_code == 200 and user_res.json() else {}
    name = user_data.get("name") or decoded.get("name") or decoded.get("email", "").split("@")[0] or "Anonym"

    import time
    timestamp = int(time.time() * 1000)

    history_entry = {
        "attempts": attempts,
        "elapsedSeconds": elapsed,
        "word": word,
        "won": won,
        "playedAt": timestamp,
    }
    requests.post(f"{DB_URL}/history/{uid}.json{auth_param}", json=history_entry)

    if not won:
        return jsonify({"saved": True, "newRecord": False, "won": False})

    score_res = requests.get(f"{DB_URL}/scores/{uid}.json{auth_param}")
    existing = score_res.json() if score_res.status_code == 200 else None

    if not existing or score < existing.get("score", float("inf")):
        requests.put(f"{DB_URL}/scores/{uid}.json{auth_param}", json={
            "name": name,
            "attempts": attempts,
            "elapsedSeconds": elapsed,
            "score": score,
            "word": word,
            "updatedAt": timestamp,
        })
        return jsonify({"saved": True, "newRecord": True})

    return jsonify({
        "saved": False,
        "newRecord": False,
        "oldAttempts": existing["attempts"],
        "oldSeconds": existing["elapsedSeconds"],
    })


@app.route("/api/leaderboard")
def leaderboard():
    res = requests.get(f"{DB_URL}/scores.json")
    if res.status_code != 200:
        return jsonify({"items": [], "total": 0})
    data = res.json()
    if not data:
        return jsonify({"items": [], "total": 0})
    
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    start = (page - 1) * limit
    end = start + limit

    entries = sorted(data.values(), key=lambda x: x.get("score", float("inf")))
    return jsonify({
        "items": entries[start:end],
        "total": len(entries)
    })


@app.route("/api/history")
def get_history():
    uid = current_user_id()
    token = current_user_token()
    if not uid:
        return jsonify({"error": "Nie si prihlásený."}), 401

    auth_param = f"?auth={token}" if token else ""
    res = requests.get(f"{DB_URL}/history/{uid}.json{auth_param}")
    
    data = res.json() if res.status_code == 200 else None
    if not data:
        return jsonify({"items": [], "total": 0})

    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    start = (page - 1) * limit
    end = start + limit

    entries = sorted(data.values(), key=lambda x: x.get("playedAt", 0), reverse=True)
    return jsonify({
        "items": entries[start:end],
        "total": len(entries)
    })


@app.route("/api/user/delete", methods=["POST"])
def delete_account():
    uid = current_user_id()
    token = current_user_token()
    if not uid:
        return jsonify({"error": "Nie si prihlásený."}), 401

    try:
        auth_param = f"?auth={token}" if token else ""
        requests.delete(f"{DB_URL}/scores/{uid}.json{auth_param}")
        requests.delete(f"{DB_URL}/history/{uid}.json{auth_param}")
        requests.delete(f"{DB_URL}/players/{uid}.json{auth_param}")
        requests.delete(f"{DB_URL}/users/{uid}.json{auth_param}")
        # auth.delete_user(uid) -> we leave this out to bypass Service Account. Frontend can delete if needed.
        session.clear()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True)
