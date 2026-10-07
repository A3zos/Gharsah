"""Real database connection layer — plain psycopg2, no ORM magic,
so it's easy to read line by line and swap out later if needed."""
import os
import psycopg2
import psycopg2.extras

def _load_env_file():
    """Load KEY=VALUE lines from a .env file at the project root (if present),
    without overriding variables already set in the environment."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres@localhost:5432/manara",
)


def get_conn():
    """One short-lived connection per request. Fine for a hackathon/MVP;
    swap for a connection pool (e.g. psycopg2.pool or asyncpg) once traffic grows."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def fetch_all(query, params=None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            return cur.fetchall()


def fetch_one(query, params=None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            return cur.fetchone()


def execute(query, params=None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            conn.commit()
            try:
                return cur.fetchone()
            except psycopg2.ProgrammingError:
                return None
