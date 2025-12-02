import re
import requests
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def get_google_sheet_csv_url(url: str) -> Optional[str]:
    """
    Transform a Google Sheet URL to a CSV export URL.
    Handles:
    - https://docs.google.com/spreadsheets/d/KEY/edit...
    - https://docs.google.com/spreadsheets/d/KEY/export...
    """
    # Extract Key
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
    if not match:
        return None
        
    key = match.group(1)
    
    # Extract gid if present (sheet ID)
    gid = None
    gid_match = re.search(r'[#&?]gid=([0-9]+)', url)
    if gid_match:
        gid = gid_match.group(1)
        
    export_url = f"https://docs.google.com/spreadsheets/d/{key}/export?format=csv"
    if gid:
        export_url += f"&gid={gid}"
        
    return export_url

def fetch_url_content(url: str) -> bytes:
    """
    Fetch content from a URL.
    Handles Google Sheets transformation if applicable.
    """
    target_url = url
    
    # Check if it's a Google Sheet
    if "docs.google.com/spreadsheets" in url:
        csv_url = get_google_sheet_csv_url(url)
        if csv_url:
            target_url = csv_url
            logger.info(f"Transformed Google Sheet URL to: {target_url}")
            
    try:
        response = requests.get(target_url, timeout=10)
        response.raise_for_status()
        return response.content
    except Exception as e:
        logger.error(f"Failed to fetch URL {target_url}: {e}")
        raise ValueError(f"Failed to fetch URL: {str(e)}")

