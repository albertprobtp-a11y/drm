"""Scrape public contact info (email / phone) from prospects' official websites.

Uses Scrapling to fetch each company's official site / contact page and extract
any professional contact details already published there (emails, phone numbers,
mailto: links). Only scrapes pages the companies themselves publish for that
purpose — LinkedIn is intentionally excluded (scraping personal profile pages
violates LinkedIn's Terms of Service and is not attempted here).

Run this where outbound internet access is available (this sandbox blocks it):
    pip install -r requirements.txt
    python prospects_contacts.py

Output: prospects_contacts.csv
"""
import csv
import re
import time

from scrapling.fetchers import Fetcher

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?){3,5}\d{2,4}")
# Domains that show up in emails but are never a real contact address.
EMAIL_DOMAIN_BLOCKLIST = ("sentry.io", "example.com", "wixpress.com", "godaddy.com")

# (company, url) — url is the best-known official/contact page from the prospecting
# research. Leave as None where no public URL was confirmed; fill in manually.
PROSPECTS = [
    ("Destinus", "https://www.destinus.com/contact-us"),
    ("Prem AI", "https://info.premai.io/contact.html"),
    ("Alzprotect", "https://www.alzprotect.com/investisseurs/contact-investisseurs"),
    ("Brique House", "https://briquehouse.shop/pages/contact"),
    ("Opus Aerospace", "https://www.opus-aerospace.com/aboutus"),
    ("BHealthcare", "https://bhealthcare.com/legal-notice/"),
    ("EverEver", "https://www.everever.eu/"),
    ("ClimateCamp", "https://www.climatecamp.io/company/contact-us"),
    ("Sequana Medical", "https://www.sequanamedical.com/investors/contact/"),
    ("Mobius Pack", "https://www.mobiuspack.com/"),
    ("BBR Energie", "https://www.bbr-energie.fr/wp/contact/"),
    ("AIRMO", "https://www.airmo.io/imprint"),
    ("Umamy", "https://umamy.io/"),
    ("KaliSpot", "https://www.kalispot.com/"),
    ("WafR / Waly Cash", None),
    ("ORA Technologies", None),
    ("Partao", "https://partao.com/"),
    ("Kidola", "https://kidola.lu/en/legal-notice/"),
    ("Hôpital privé de Ngabou", None),
    ("Weego", "https://weegolife.com/en/contact"),
    ("Demefco", "https://www.demefco.be/fr/sur-demefco/je-cherche-un-investisseur/"),
    ("GoSwap", None),
    ("REasy", "https://www.reasy.fr/en"),
]


def extract_contacts(html_text: str, page):
    emails = {
        e for e in EMAIL_RE.findall(html_text)
        if not any(bad in e.lower() for bad in EMAIL_DOMAIN_BLOCKLIST)
    }
    # mailto: links are the highest-confidence signal
    mailto_links = page.css("a[href^='mailto:']::attr(href)")
    for link in mailto_links:
        emails.add(link.replace("mailto:", "").split("?")[0])

    phones = set()
    tel_links = page.css("a[href^='tel:']::attr(href)")
    for link in tel_links:
        phones.add(link.replace("tel:", ""))
    # Loose text match as a fallback, capped to avoid noise (dates, IDs, etc.)
    for m in PHONE_RE.findall(html_text):
        digits = re.sub(r"\D", "", m)
        if 8 <= len(digits) <= 13:
            phones.add(m.strip())

    return sorted(emails), sorted(phones)[:5]


def main():
    rows = []
    for company, url in PROSPECTS:
        if not url:
            rows.append({"company": company, "url": "", "status": "URL non confirmée — à compléter manuellement", "emails": "", "phones": ""})
            continue

        print(f"[{company}] fetching {url} ...")
        try:
            page = Fetcher.get(url, stealthy_headers=True, timeout=20)
            if page.status != 200:
                rows.append({"company": company, "url": url, "status": f"HTTP {page.status}", "emails": "", "phones": ""})
                continue
            emails, phones = extract_contacts(page.body if isinstance(page.body, str) else page.html_content, page)
            rows.append({
                "company": company,
                "url": url,
                "status": "OK" if (emails or phones) else "OK — aucun contact trouvé sur cette page",
                "emails": "; ".join(emails),
                "phones": "; ".join(phones),
            })
        except Exception as exc:
            rows.append({"company": company, "url": url, "status": f"Échec: {exc}", "emails": "", "phones": ""})

        time.sleep(2)  # be polite between requests

    with open("prospects_contacts.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["company", "url", "status", "emails", "phones"])
        writer.writeheader()
        writer.writerows(rows)

    print("\nDone. Results written to prospects_contacts.csv")


if __name__ == "__main__":
    main()
