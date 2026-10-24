#!/usr/bin/env python3
"""Optional: IMDb ratings on titles, loaded nightly into Watch's D1 database.

IMDb's non-commercial dataset title.ratings.tsv.gz (https://datasets.imdbws.com/, refreshed daily,
for personal and non-commercial use) has every title's average rating and vote count. Titles with
at least MIN_VOTES are kept; each night only the rows that changed since the last good run are
written (D1 counts every row written), through the D1 API. The state file is replaced only
after every batch went in. Standard library only. Without this, title pages simply show no
IMDb rating.

    ACCOUNT_ID=… DATABASE_ID=… TOKEN_FILE=~/.config/watch/d1-token python3 imdb_ratings.py

The token needs D1 Edit on that account.
"""

import gzip
import json
import os
import re
import sys
import tempfile
import urllib.request

ACCOUNT = os.environ.get("ACCOUNT_ID", "")
DATABASE = os.environ.get("DATABASE_ID", "")
URL = "https://datasets.imdbws.com/title.ratings.tsv.gz"
TOKEN_FILE = os.path.expanduser(os.environ.get("TOKEN_FILE", "~/.config/watch/d1-token"))
STATE = os.path.expanduser(os.environ.get("STATE", "~/.local/share/imdb-ratings/last.tsv"))
MIN_VOTES = int(os.environ.get("MIN_VOTES", "100"))
# One statement per batch; D1's statement limit is 100 KB and a row is about 30 bytes.
BATCH = 1000

ID = re.compile(r"^tt\d{7,10}$")


def parse(lines, min_votes: int = MIN_VOTES) -> dict[str, tuple[float, int]]:
    """tconst → (rating, votes) for titles with enough votes; the header and bad rows are skipped."""
    out = {}
    for line in lines:
        parts = line.rstrip("\n").split("\t")
        if len(parts) != 3 or not ID.match(parts[0]):
            continue
        try:
            rating, votes = float(parts[1]), int(parts[2])
        except ValueError:
            continue
        if votes >= min_votes and 0 <= rating <= 10:
            out[parts[0]] = (rating, votes)
    return out


def changed(new: dict, old: dict) -> list[tuple[str, float, int]]:
    """Rows to write: new titles and those whose rating or votes moved. Titles that dropped below
    the floor keep their last rating rather than vanishing."""
    return sorted((k, *v) for k, v in new.items() if old.get(k) != v)


def upsert_sql(rows: list[tuple[str, float, int]]) -> str:
    # Values come from parse(): ids match ID and the numbers are floats and ints, so they are
    # written as literals (D1 binds at most 100 values a query).
    values = ",".join(f"('{i}',{r:.1f},{v})" for i, r, v in rows)
    return (
        "INSERT INTO imdb_ratings (imdb_id, rating, votes) VALUES "
        + values
        + " ON CONFLICT(imdb_id) DO UPDATE SET rating = excluded.rating, votes = excluded.votes"
    )


def read_state(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    with open(path) as fh:
        return parse(fh, 0)


def write_state(path: str, rows: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
    with os.fdopen(fd, "w") as fh:
        for k, (r, v) in sorted(rows.items()):
            fh.write(f"{k}\t{r}\t{v}\n")
    os.replace(tmp, path)


def d1(token: str, sql: str) -> list[dict]:
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DATABASE}/query",
        data=json.dumps({"sql": sql}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        out = json.load(res)
    if not out.get("success"):
        raise RuntimeError(f"D1 query failed: {out.get('errors')}")
    return out["result"][0]["results"]


def main() -> int:
    if not ACCOUNT or not DATABASE:
        print("set ACCOUNT_ID and DATABASE_ID (the D1 database Watch uses)", file=sys.stderr)
        return 2
    with open(TOKEN_FILE) as fh:
        token = fh.read().strip()
    with urllib.request.urlopen(URL, timeout=300) as res:
        data = gzip.decompress(res.read()).decode()
    new = parse(data.splitlines())
    if len(new) < 100_000:
        # A truncated or changed file must not be taken for the truth.
        print(f"only {len(new)} titles in the file; nothing written", file=sys.stderr)
        return 1
    old = read_state(STATE)
    rows = changed(new, old)
    for i in range(0, len(rows), BATCH):
        d1(token, upsert_sql(rows[i : i + BATCH]))
    total = d1(token, "SELECT count(*) AS n FROM imdb_ratings")[0]["n"]
    if total < len(new):
        print(f"D1 has {total} ratings, the file {len(new)}; state kept", file=sys.stderr)
        return 1
    write_state(STATE, new)
    print(f"imdb ratings: {len(new)} titles, {len(rows)} written, {total} in D1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
