"""
Google Calendar integration for AIMEA.
"""
import os
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build

from aimea.config import GOOGLE_CALENDAR_ID

# Scope for calendar events
SCOPES = ['https://www.googleapis.com/auth/calendar.events']

def get_calendar_service():
    """Authenticate using service account and return a Calendar API service instance."""
    # Expecting service account JSON path in GOOGLE_APPLICATION_CREDENTIALS env var
    creds_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    if not creds_path:
        raise RuntimeError('GOOGLE_APPLICATION_CREDENTIALS not set')
    credentials = service_account.Credentials.from_service_account_file(
        creds_path, scopes=SCOPES
    )
    service = build('calendar', 'v3', credentials=credentials)
    return service

def schedule_meeting(
    summary: str,
    start: str,
    end: str,
    attendees: list = None,
    description: str = None,
) -> dict:
    """
    Create a Google Calendar event.

    :param summary: Event title or summary.
    :param start: ISO 8601 start datetime string (e.g., '2025-07-10T10:00:00').
    :param end: ISO 8601 end datetime string.
    :param attendees: List of attendee email strings.
    :param description: (Optional) Event description.
    :return: Created event resource as dict.
    """
    service = get_calendar_service()
    event_body = {
        'summary': summary,
        'start': {'dateTime': start, 'timeZone': 'UTC'},
        'end': {'dateTime': end, 'timeZone': 'UTC'},
    }
    if description:
        event_body['description'] = description
    if attendees:
        event_body['attendees'] = [{'email': email} for email in attendees]
    try:
        event = service.events().insert(
            calendarId=GOOGLE_CALENDAR_ID,
            body=event_body,
            sendUpdates='all'
        ).execute()
    except Exception as e:
        # Handle service account restrictions on inviting attendees
        from googleapiclient.errors import HttpError
        if isinstance(e, HttpError) and e.resp.status == 403:
            # Retry without attendees/invitations
            retry_body = event_body.copy()
            retry_body.pop('attendees', None)
            # Retry insertion without sendUpdates
            event = service.events().insert(
                calendarId=GOOGLE_CALENDAR_ID,
                body=retry_body
            ).execute()
        else:
            raise
    return event