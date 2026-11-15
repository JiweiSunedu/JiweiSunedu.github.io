#!/usr/bin/env python3
"""Build _data/ssci_journals.yml from the JCR 2025 spreadsheet.

Keeps only SSCI journals in education-related categories and keeps the fields
the ranking page needs. Re-run whenever the spreadsheet is updated:

    python bin/build_journal_data.py "/path/to/JCR2025 journal metrics.xlsx"

CiteScore, first-decision time and acceptance rate are *not* in the JCR file;
they live in _data/journal_extra.yml (keyed by ISSN) and are merged at render
time by the page.
"""

import json
import sys
from pathlib import Path

import openpyxl
import yaml

DEFAULT_SOURCE = Path("/Users/jasonsun/Library/Mobile Documents/com~apple~CloudDocs/PHD/JCR2025期刊影响因子.xlsx")
OUTPUT = Path(__file__).resolve().parent.parent / "_data" / "ssci_journals.yml"

EDUCATION_CATEGORIES = {
    "EDUCATION & EDUCATIONAL RESEARCH",
    "EDUCATION, SPECIAL",
    "PSYCHOLOGY, EDUCATIONAL",
}

TAG_MAP = {
    "EDUCATION & EDUCATIONAL RESEARCH": "Education",
    "EDUCATION, SPECIAL": "Special Education",
    "PSYCHOLOGY, EDUCATIONAL": "Educational Psychology",
    "PSYCHOLOGY, MULTIDISCIPLINARY": "Psychology",
    "PSYCHOLOGY, APPLIED": "Applied Psychology",
    "PSYCHOLOGY, DEVELOPMENTAL": "Developmental Psychology",
    "PSYCHOLOGY, SOCIAL": "Social Psychology",
    "COMPUTER SCIENCE, INTERDISCIPLINARY APPLICATIONS": "Computer Science",
    "INFORMATION SCIENCE & LIBRARY SCIENCE": "Information Science",
    "SOCIAL SCIENCES, INTERDISCIPLINARY": "Social Sciences",
    "MANAGEMENT": "Management",
    "BUSINESS": "Business",
    "ECONOMICS": "Economics",
    "COMMUNICATION": "Communication",
    "LINGUISTICS": "Linguistics",
    "NURSING": "Nursing",
    "REHABILITATION": "Rehabilitation",
    "HEALTH CARE SCIENCES & SERVICES": "Health Care",
    "MEDICINE, GENERAL & INTERNAL": "Medicine",
    "MULTIDISCIPLINARY SCIENCES": "Multidisciplinary",
    "SOCIAL WORK": "Social Work",
    "SOCIOLOGY": "Sociology",
    "ANTHROPOLOGY": "Anthropology",
    "PHILOSOPHY": "Philosophy",
    "HISTORY": "History",
    "LAW": "Law",
    "POLITICAL SCIENCE": "Political Science",
}


def pretty_category(raw):
    """Short, human-readable tag for a JCR category."""
    if raw in TAG_MAP:
        return TAG_MAP[raw]
    return raw.title().replace(",", " ").replace("  ", " ").strip()


def edition_is_ssci(value):
    return "SSCI" in str(value or "")


def main():
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not source.exists():
        sys.exit("Spreadsheet not found: {}".format(source))

    workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
    sheet = workbook["Journals"]
    rows = sheet.iter_rows(values_only=True)
    header = next(rows)
    col = {name: index for index, name in enumerate(header)}

    journals = []
    seen = set()

    for row in rows:
        if not edition_is_ssci(row[col["Editions"]]):
            continue
        # The "Categories" column only says "Multiple" for multi-category
        # journals, so read the per-category JSON instead.
        raw_categories = []
        try:
            for entry in json.loads(row[col["Category quartiles JSON"]] or "[]"):
                category = str(entry.get("category") or "").strip()
                if category and category not in raw_categories:
                    raw_categories.append(category)
        except (TypeError, ValueError):
            raw_categories = [c.strip() for c in str(row[col["Categories"]] or "").split(";") if c.strip()]
        if not raw_categories:
            raw_categories = [c.strip() for c in str(row[col["Categories"]] or "").split(";") if c.strip()]
        if not any(category in EDUCATION_CATEGORIES for category in raw_categories):
            continue

        issn = str(row[col["ISSN"]] or "").strip()
        name = str(row[col["Journal name"]] or "").strip()
        key = issn or name.lower()
        if not name or key in seen:
            continue
        seen.add(key)

        jif = row[col["2025 JIF"]]
        try:
            jif = round(float(jif), 1)
        except (TypeError, ValueError):
            jif = None

        journals.append(
            {
                "name": name,
                "abbr": str(row[col["Abbreviated journal"]] or "").strip(),
                "publisher": str(row[col["Publisher"]] or "").strip(),
                "issn": issn,
                "edition": "SSCI",
                "jif": jif,
                "jif5": row[col["5-year JIF"]],
                "quartile": str(row[col["JIF quartile"]] or "").strip(),
                "percentile": row[col["JIF percentile"]],
                "rank": str(row[col["JIF rank"]] or "").strip(),
                "jci": row[col["JCI"]],
                "cites": row[col["Total citations"]],
                "oa_pct": row[col["% OA gold"]],
                "tags": [pretty_category(c) for c in raw_categories][:3],
            }
        )

    journals.sort(key=lambda j: (j["jif"] is None, -(j["jif"] or 0), j["name"].lower()))

    OUTPUT.write_text(
        "# Generated by bin/build_journal_data.py from the JCR 2025 workbook.\n"
        "# SSCI journals with an education-related JCR category.\n"
        + yaml.safe_dump(journals, allow_unicode=True, sort_keys=False, width=1000),
        encoding="utf-8",
    )
    print("Wrote {} journals to {}".format(len(journals), OUTPUT))


if __name__ == "__main__":
    main()
