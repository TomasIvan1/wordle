# Wordle Online

Flask verzia Wordle s Firebase prihlásením a online leaderboardom.

## Spustenie

```powershell
pip install -r requirements.txt
python app.py
```

Potom otvor `http://127.0.0.1:5000`.

## Firebase

V projekte je použitý Firebase projekt `wordle-e5e3d` a Realtime Database:

```text
https://wordle-e5e3d-default-rtdb.europe-west1.firebasedatabase.app/
```

V Firebase Console zapni `Authentication -> Sign-in method -> Email/Password`.

Odporúčané pravidlá pre Realtime Database:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "players": {
      ".read": true,
      "$uid": {
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "scores": {
      ".read": true,
      ".indexOn": ["score"],
      "$uid": {
        ".write": "auth != null && auth.uid == $uid",
        ".validate": "newData.hasChildren(['name', 'attempts', 'elapsedSeconds', 'score', 'word', 'updatedAt'])"
      }
    }
  }
}
```
