import os
import logging
import requests
from datetime import datetime

logger = logging.getLogger("calendar_service")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN", "")

def generate_ics_calendar_event(
    summary: str,
    description: str,
    date_str: str,
    start_time_str: str,
    end_time_str: str,
    location: str = "SwasthyaCare Clinic"
) -> str:
    start_dt = datetime.strptime(f"{date_str} {start_time_str}", "%Y-%m-%d %H:%M")
    end_dt = datetime.strptime(f"{date_str} {end_time_str}", "%Y-%m-%d %H:%M")

    dtstart = start_dt.strftime("%Y%m%dT%H%M00")
    dtend = end_dt.strftime("%Y%m%dT%H%M00")
    dtstamp = datetime.utcnow().strftime("%Y%m%dT%H%M00Z")

    return f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SwasthyaCare AI India//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:appointment-{dtstart}-{start_time_str.replace(':', '')}@swasthya.in
DTSTAMP:{dtstamp}
DTSTART:{dtstart}
DTEND:{dtend}
SUMMARY:{summary}
DESCRIPTION:{description}
LOCATION:{location}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR"""


def get_google_oauth_access_token() -> str:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REFRESH_TOKEN:
        return ""

    try:
        url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": GOOGLE_REFRESH_TOKEN,
            "grant_type": "refresh_token"
        }
        resp = requests.post(url, data=data, timeout=5)
        if resp.status_code == 200:
            return resp.json().get("access_token", "")
        return ""
    except Exception as e:
        logger.warning(f"Google OAuth token refresh failed: {e}")
        return ""


def sync_event_to_google_calendar(
    summary: str,
    description: str,
    date_str: str,
    start_time_str: str,
    end_time_str: str,
    location: str = "SwasthyaCare Clinic, India",
    attendee_email: str = None
) -> (bool, str):
    access_token = get_google_oauth_access_token()
    if not access_token:
        return True, "mock_event_id_123"

    try:
        start_iso = f"{date_str}T{start_time_str}:00+05:30"
        end_iso = f"{date_str}T{end_time_str}:00+05:30"

        event_body = {
            "summary": summary,
            "location": location,
            "description": description,
            "start": {"dateTime": start_iso, "timeZone": "Asia/Kolkata"},
            "end": {"dateTime": end_iso, "timeZone": "Asia/Kolkata"}
        }
        if attendee_email:
            event_body["attendees"] = [{"email": attendee_email}]

        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        resp = requests.post("https://www.googleapis.com/calendar/v3/calendars/primary/events", headers=headers, json=event_body, timeout=5)

        if resp.status_code in [200, 201]:
            event_id = resp.json().get("id", "")
            return True, event_id
        return False, ""
    except Exception as e:
        logger.warning(f"Google Calendar create event failed ({e}).")
        return False, ""


def update_google_calendar_event(
    event_id: str,
    summary: str,
    description: str,
    date_str: str,
    start_time_str: str,
    end_time_str: str,
    location: str = "SwasthyaCare Clinic"
) -> bool:
    if not event_id or event_id == "mock_event_id_123":
        return True

    access_token = get_google_oauth_access_token()
    if not access_token:
        return True

    try:
        start_iso = f"{date_str}T{start_time_str}:00+05:30"
        end_iso = f"{date_str}T{end_time_str}:00+05:30"

        event_body = {
            "summary": summary,
            "location": location,
            "description": description,
            "start": {"dateTime": start_iso, "timeZone": "Asia/Kolkata"},
            "end": {"dateTime": end_iso, "timeZone": "Asia/Kolkata"}
        }

        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        resp = requests.put(f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}", headers=headers, json=event_body, timeout=5)
        return resp.status_code == 200
    except Exception as e:
        logger.warning(f"Google Calendar update event failed ({e}).")
        return False


def delete_google_calendar_event(event_id: str) -> bool:
    if not event_id or event_id == "mock_event_id_123":
        return True

    access_token = get_google_oauth_access_token()
    if not access_token:
        return True

    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = requests.delete(f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}", headers=headers, timeout=5)
        return resp.status_code in [200, 204]
    except Exception as e:
        logger.warning(f"Google Calendar delete event failed ({e}).")
        return False
