import datetime
import urllib.request
from email.utils import parsedate_to_datetime

try:
    response = urllib.request.urlopen("https://www.google.com", timeout=2)
    server_date_str = response.headers['Date']
    real_time = parsedate_to_datetime(server_date_str).replace(tzinfo=None)
    local_time = datetime.datetime.utcnow()
    time_offset = (real_time - local_time).total_seconds()
except Exception as e:
    print("Error fetching time:", e)
    time_offset = 0

print("Time offset:", time_offset)

import google.auth._helpers
_orig_auth_utcnow = google.auth._helpers.utcnow
def _mock_auth_utcnow():
    return _orig_auth_utcnow() + datetime.timedelta(seconds=time_offset)
google.auth._helpers.utcnow = _mock_auth_utcnow

# Now import firebase_admin and try to get leaderboard
import firebase_admin
from firebase_admin import credentials, db

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://wordle-e5e3d-default-rtdb.europe-west1.firebasedatabase.app"
})

try:
    data = db.reference("scores").get()
    print("Scores fetched:", data)
except Exception as e:
    print("Failed to fetch:", e)
