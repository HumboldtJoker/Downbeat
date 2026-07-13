"""SQLite database layer — ad inventory, impressions, earnings.

Single file, zero config, ships anywhere. Swap to Postgres when
traffic justifies it — the schema is identical.
"""

import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


DB_PATH = Path(__file__).parent.parent / "data" / "downbeat.db"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS publishers (
                api_key TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                balance_cents INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ads (
                id TEXT PRIMARY KEY,
                advertiser TEXT NOT NULL,
                text TEXT NOT NULL,
                url TEXT NOT NULL,
                cpm_ambient_cents INTEGER NOT NULL DEFAULT 200,
                cpm_verified_cents INTEGER NOT NULL DEFAULT 800,
                budget_cents INTEGER NOT NULL DEFAULT 0,
                spent_cents INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS impressions (
                id TEXT PRIMARY KEY,
                ad_id TEXT NOT NULL REFERENCES ads(id),
                publisher_key TEXT NOT NULL REFERENCES publishers(api_key),
                tier TEXT NOT NULL DEFAULT 'ambient',
                duration_ms INTEGER NOT NULL DEFAULT 0,
                clicked INTEGER NOT NULL DEFAULT 0,
                recorded INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_impressions_publisher
                ON impressions(publisher_key);
            CREATE INDEX IF NOT EXISTS idx_impressions_ad
                ON impressions(ad_id);
            CREATE INDEX IF NOT EXISTS idx_impressions_created
                ON impressions(created_at);
        """)


def create_publisher(name: str, email: str = "") -> str:
    api_key = f"db_{uuid.uuid4().hex[:24]}"
    with connect() as conn:
        conn.execute(
            "INSERT INTO publishers (api_key, name, email, created_at) VALUES (?, ?, ?, ?)",
            (api_key, name, email, _now()),
        )
    return api_key


def get_publisher(api_key: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM publishers WHERE api_key = ?", (api_key,)
        ).fetchone()
        return dict(row) if row else None


def create_ad(advertiser: str, text: str, url: str,
              cpm_ambient_cents: int = 200, cpm_verified_cents: int = 800,
              budget_cents: int = 10000) -> str:
    ad_id = f"ad_{uuid.uuid4().hex[:16]}"
    with connect() as conn:
        conn.execute(
            """INSERT INTO ads (id, advertiser, text, url, cpm_ambient_cents,
               cpm_verified_cents, budget_cents, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (ad_id, advertiser, text, url, cpm_ambient_cents,
             cpm_verified_cents, budget_cents, _now()),
        )
    return ad_id


def fetch_active_ad() -> dict | None:
    with connect() as conn:
        row = conn.execute(
            """SELECT * FROM ads
               WHERE active = 1 AND spent_cents < budget_cents
               ORDER BY RANDOM() LIMIT 1"""
        ).fetchone()
        return dict(row) if row else None


def create_impression(ad_id: str, publisher_key: str) -> str:
    imp_id = f"imp_{uuid.uuid4().hex[:16]}"
    with connect() as conn:
        conn.execute(
            """INSERT INTO impressions (id, ad_id, publisher_key, created_at)
               VALUES (?, ?, ?, ?)""",
            (imp_id, ad_id, publisher_key, _now()),
        )
    return imp_id


def record_impression(impression_id: str, duration_ms: int, clicked: bool,
                      tier: str) -> bool:
    with connect() as conn:
        row = conn.execute(
            "SELECT ad_id, publisher_key, recorded FROM impressions WHERE id = ?",
            (impression_id,),
        ).fetchone()
        if not row or row["recorded"]:
            return False

        conn.execute(
            """UPDATE impressions
               SET duration_ms = ?, clicked = ?, tier = ?, recorded = 1
               WHERE id = ?""",
            (duration_ms, int(clicked), tier, impression_id),
        )

        ad = conn.execute(
            "SELECT cpm_ambient_cents, cpm_verified_cents FROM ads WHERE id = ?",
            (row["ad_id"],),
        ).fetchone()
        if not ad:
            return False

        cpm = ad["cpm_verified_cents"] if tier == "verified" else ad["cpm_ambient_cents"]
        # CPM is in cents per 1000 impressions.
        # Per-impression cost in dollars: cpm / 100 / 1000 = cpm / 100000
        # Track in microdollars (1/10000 dollar) to avoid rounding loss:
        # per-impression in microdollars = cpm * 10000 / 100 / 1000 = cpm / 10
        cost_ud = cpm * 10000 // 100000
        publisher_ud = cost_ud // 2

        conn.execute(
            "UPDATE ads SET spent_cents = spent_cents + ? WHERE id = ?",
            (cost_ud, row["ad_id"]),
        )
        conn.execute(
            "UPDATE publishers SET balance_cents = balance_cents + ? WHERE api_key = ?",
            (publisher_ud, row["publisher_key"]),
        )
    return True


def get_earnings(publisher_key: str) -> dict:
    with connect() as conn:
        total = conn.execute(
            "SELECT balance_cents FROM publishers WHERE api_key = ?",
            (publisher_key,),
        ).fetchone()
        if not total:
            return {"today": 0.0, "total": 0.0}

        today_start = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00")
        today_row = conn.execute(
            """SELECT COUNT(*) as cnt FROM impressions
               WHERE publisher_key = ? AND recorded = 1 AND created_at >= ?""",
            (publisher_key, today_start),
        ).fetchone()

        today_row2 = conn.execute(
            """SELECT COALESCE(SUM(
                CASE WHEN i.tier = 'verified'
                     THEN a.cpm_verified_cents * 10000 / 100000 / 2
                     ELSE a.cpm_ambient_cents * 10000 / 100000 / 2 END
               ), 0) as earned_ud
               FROM impressions i JOIN ads a ON i.ad_id = a.id
               WHERE i.publisher_key = ? AND i.recorded = 1
               AND i.created_at >= ?""",
            (publisher_key, today_start),
        ).fetchone()

        today_ud = today_row2["earned_ud"] if today_row2 else 0

        return {
            "today": today_ud / 10000,
            "total": total["balance_cents"] / 10000,
        }


def seed_demo_data():
    with connect() as conn:
        if conn.execute("SELECT COUNT(*) as c FROM ads").fetchone()["c"] > 0:
            return

    create_ad(
        "Liberation Labs",
        "Build resistance infrastructure — liberationlabs.tech",
        "https://liberationlabs.tech",
        cpm_ambient_cents=100,
        cpm_verified_cents=400,
        budget_cents=100000,
    )
    create_ad(
        "Downbeat Demo",
        "You're earning money right now. Downbeat — get paid while AI thinks.",
        "https://github.com/HumboldtJoker/Downbeat",
        cpm_ambient_cents=150,
        cpm_verified_cents=600,
        budget_cents=100000,
    )
