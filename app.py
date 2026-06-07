import os
import random
import secrets
from flask import Flask, render_template, request, jsonify, session
import firebase_admin
from firebase_admin import auth, credentials, db

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# ---------------------------------------------------------------------------
# Firebase – inicializácia
# ---------------------------------------------------------------------------

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://wordle-e5e3d-default-rtdb.europe-west1.firebasedatabase.app"
})

WORDS = [
    "MACKA", "KNIHA", "SKOLA", "HRADY", "KVETY",
    "MESTO", "PLAME", "STROM", "VLAKY", "OBLAK",
    "MOREA", "KARTA", "LAMPA", "CESTA", "PESIA",
    "RUKAV", "SLOVO", "DENIK", "NOZIK", "ZEBRA",
]

# ---------------------------------------------------------------------------
# Pomocné funkcie
# ---------------------------------------------------------------------------

def current_user_id():
    return session.get("user_id")


def verify_token(id_token: str):
    try:
        return auth.verify_id_token(id_token)
    except Exception:
        return None


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

    try:
        user = auth.create_user(email=email, password=password, display_name=name)

        db.reference(f"users/{user.uid}").set({"name": name, "email": email})
        db.reference(f"players/{user.uid}").set({"name": name})

        return jsonify({"uid": user.uid, "name": name, "email": email})
    except auth.EmailAlreadyExistsError:
        return jsonify({"error": "Email je už zaregistrovaný."}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    id_token = data.get("idToken") or ""

    decoded = verify_token(id_token)
    if not decoded:
        return jsonify({"error": "Neplatný token."}), 401

    uid = decoded["uid"]
    user = auth.get_user(uid)
    name = user.display_name or user.email.split("@")[0]

    session["user_id"] = uid
    session["user_name"] = name

    db.reference(f"players/{uid}").update({"lastLoginAt": {".sv": "timestamp"}})
    db.reference(f"users/{uid}").update({
        "name": name,
        "email": user.email,
        "lastLoginAt": {".sv": "timestamp"},
    })

    return jsonify({"uid": uid, "name": name, "email": user.email})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me")
def me():
    uid = current_user_id()
    if not uid:
        return jsonify({"user": None})
    try:
        user = auth.get_user(uid)
        name = user.display_name or user.email.split("@")[0]
        return jsonify({"user": {"uid": uid, "name": name, "email": user.email}})
    except Exception:
        return jsonify({"user": None})


# ---------------------------------------------------------------------------
# API – meno používateľa
# ---------------------------------------------------------------------------

@app.route("/api/user/name", methods=["POST"])
def update_name():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "Nie si prihlásený."}), 401

    data = request.get_json()
    new_name = (data.get("name") or "").strip()
    if not new_name:
        return jsonify({"error": "Meno nemôže byť prázdne."}), 400

    try:
        auth.update_user(uid, display_name=new_name)
        db.reference(f"users/{uid}").update({"name": new_name})
        db.reference(f"players/{uid}").update({"name": new_name})

        score_ref = db.reference(f"scores/{uid}")
        existing = score_ref.get()
        if existing:
            score_ref.update({"name": new_name})

        session["user_name"] = new_name
        return jsonify({"ok": True, "name": new_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# API – slová
# ---------------------------------------------------------------------------

@app.route("/api/word/random")
def random_word():
    return jsonify({"word": random.choice(WORDS)})


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
    won = bool(data.get("won", True))
    score = attempts * 1000 + elapsed

    user = auth.get_user(uid)
    name = user.display_name or user.email.split("@")[0]

    import time
    timestamp = int(time.time() * 1000)

    # Uložiť do histórie (každá hra zvlášť)
    history_entry = {
        "attempts": attempts,
        "elapsedSeconds": elapsed,
        "word": word,
        "won": won,
        "playedAt": timestamp,
    }
    db.reference(f"history/{uid}").push(history_entry)

    # Uložiť/aktualizovať najlepšie skóre (len ak výhra)
    if not won:
        return jsonify({"saved": True, "newRecord": False, "won": False})

    score_ref = db.reference(f"scores/{uid}")
    existing = score_ref.get()

    if not existing or score < existing.get("score", float("inf")):
        score_ref.set({
            "name": name,
            "attempts": attempts,
            "elapsedSeconds": elapsed,
            "score": score,
            "word": word,
            "updatedAt": {".sv": "timestamp"},
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
    data = db.reference("scores").get()
    if not data:
        return jsonify([])
    entries = sorted(data.values(), key=lambda x: x.get("score", float("inf")))[:10]
    return jsonify(entries)


# ---------------------------------------------------------------------------
# API – história hier
# ---------------------------------------------------------------------------

@app.route("/api/history")
def get_history():
    uid = current_user_id()
    print(uid)
    if not uid:
        return jsonify({"error": "Nie si prihlásený."}), 401

    data = db.reference(f"history/{uid}").get()
    if not data:
        return jsonify([])
    

    entries = sorted(data.values(), key=lambda x: x.get("playedAt", 0), reverse=True)[:50]
    return jsonify(entries)


# ---------------------------------------------------------------------------
# API – vymazanie účtu
# ---------------------------------------------------------------------------

@app.route("/api/user/delete", methods=["POST"])
def delete_account():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "Nie si prihlásený."}), 401

    try:
        db.reference(f"scores/{uid}").delete()
        db.reference(f"history/{uid}").delete()
        db.reference(f"players/{uid}").delete()
        db.reference(f"users/{uid}").delete()
        auth.delete_user(uid)
        session.clear()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True)
