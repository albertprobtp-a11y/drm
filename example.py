"""Minimal Scrapling usage example.

Run with: python example.py
"""
from scrapling.fetchers import Fetcher

if __name__ == "__main__":
    page = Fetcher.get("https://example.com")
    title = page.css_first("h1::text")
    print(f"Status: {page.status}")
    print(f"Title: {title}")
