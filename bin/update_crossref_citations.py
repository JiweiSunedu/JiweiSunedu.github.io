#!/usr/bin/env python3
"""Refresh the Crossref citation snapshot used by the custom pages.

Reads every DOI in _data/jiwei_publications.yml and rewrites
_data/jiwei_citations.json. The browser still refreshes the counts live from
api.crossref.org; this snapshot is the server-rendered fallback (and the
value shown when JavaScript is unavailable).

Run locally with:  python bin/update_crossref_citations.py
"""

import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone

import yaml

PUBLICATIONS = "_data/jiwei_publications.yml"
SNAPSHOT = "_data/jiwei_citations.json"
MAILTO = os.environ.get("CROSSREF_MAILTO", "yc47104@um.edu.mo")
TIMEOUT = 20
ATTEMPTS = 3


def load_dois():
    """Return the DOI keys (without the https://doi.org/ prefix) to refresh."""
    with open(PUBLICATIONS, encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    dois = []
    for paper in data.get("papers", []):
        raw = str(paper.get("doi") or "").strip()
        if not raw:
            continue
        key = raw.split("doi.org/")[-1].strip().lower()
        if key and key not in dois:
            dois.append(key)
    return dois


def fetch_count(doi):
    """Return the Crossref "cited-by" count for one DOI."""
    url = "https://api.crossref.org/works/{}?mailto={}".format(doi, MAILTO)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "jiwei-site/1.0 (mailto:{})".format(MAILTO),
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        payload = json.load(response)
    message = payload.get("message") or {}
    if str(message.get("DOI", "")).lower() != doi:
        raise ValueError("DOI mismatch")
    count = message.get("is-referenced-by-count")
    if not isinstance(count, int) or count < 0:
        raise ValueError("invalid citation count")
    return count


def main():
    dois = load_dois()
    if not dois:
        print("No DOIs found in {}; nothing to do.".format(PUBLICATIONS))
        return 0

    snapshot = {}
    if os.path.exists(SNAPSHOT):
        try:
            with open(SNAPSHOT, encoding="utf-8") as handle:
                snapshot = json.load(handle) or {}
        except json.JSONDecodeError:
            print("Existing snapshot is not valid JSON; rebuilding it.")
            snapshot = {}

    retrieved_at = datetime.now(timezone.utc).isoformat()
    failures = 0

    for doi in dois:
        for attempt in range(1, ATTEMPTS + 1):
            try:
                count = fetch_count(doi)
            except Exception as error:  # noqa: BLE001 - network/API errors are expected
                print("  ! {} attempt {} failed: {}".format(doi, attempt, error))
                time.sleep(2 * attempt)
                continue
            snapshot[doi] = {
                "count": count,
                "retrieved_at": retrieved_at,
                "source": "Crossref",
            }
            print("  {}: {} citations".format(doi, count))
            break
        else:
            failures += 1
            print("  ! keeping the previous snapshot for {}".format(doi))

    with open(SNAPSHOT, "w", encoding="utf-8") as handle:
        json.dump(dict(sorted(snapshot.items())), handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print("Wrote {} ({} DOIs, {} failures).".format(SNAPSHOT, len(snapshot), failures))
    return 1 if failures == len(dois) else 0


if __name__ == "__main__":
    sys.exit(main())
