"""The worker reads reports and commits embeddings directly to Postgres."""
import atexit
import os
import tempfile
from functools import lru_cache
from pathlib import Path

import psycopg
from dotenv import dotenv_values
from psycopg import sql
from psycopg.rows import dict_row


def load_worker_env():
    app = Path(__file__).resolve().parent
    # Reuse local DB/Redis settings; Docker supplies these through its environment.
    for path in [app / ".env.local", app.parent / "api/.env.development.local",
                 app.parent / "api/.env.development", app.parent / "api/.env"]:
        for key, value in dotenv_values(path).items():
            if value is not None and (key.startswith(("DB_", "REDIS_", "AI_"))
                                      or key in {"DATABASE_URL", "QUEUE_PREFIX"}):
                os.environ.setdefault(key, value)
    os.environ.setdefault("UPLOAD_DIR", str(app.parent / "api/uploads"))


@lru_cache(maxsize=1)
def connection_options():
    options = {"connect_timeout": 5}
    if not os.getenv("DATABASE_URL", "").strip():
        for option, env, default in [
            ("host", "DB_HOST_NEST", "localhost"), ("port", "DB_PORT_NEST", "5432"),
            ("user", "DB_USER_NEST", "postgres"), ("password", "DB_PASSWORD_NEST", "postgres"),
            ("dbname", "DB_NAME_NEST", "pawsrescue"),
        ]:
            options[option] = os.getenv(env, default)
    if os.getenv("DB_SSL") == "true":
        options["sslmode"] = "require" if os.getenv("DB_SSL_REJECT_UNAUTHORIZED") == "false" else "verify-full"
        if os.getenv("DB_SSL_CA"):
            with tempfile.NamedTemporaryFile(mode="w", suffix=".pem", delete=False) as ca:
                ca.write(os.environ["DB_SSL_CA"].replace("\\n", "\n"))
                options["sslrootcert"] = ca.name
            atexit.register(Path(ca.name).unlink, missing_ok=True)
    return options


class ReportStore:
    def __init__(self):
        self.table = sql.Identifier(os.getenv("DB_SCHEMA", "public"), "lost_pets")

    async def query(self, statement, params=()):
        async with await psycopg.AsyncConnection.connect(
            os.getenv("DATABASE_URL", ""), **connection_options(),
            autocommit=True, row_factory=dict_row,
        ) as connection:
            cursor = await connection.execute(sql.SQL(statement).format(table=self.table), params)
            return await cursor.fetchall() if cursor.description else []

    async def get(self, pet_id):
        rows = await self.query(
            'select id, image_urls, embedding_status from {table} where id = %s', (pet_id,))
        return rows[0] if rows else None

    async def set_status(self, pet_id, status):
        await self.query(
            "update {table} set embedding_status = %s, updated_at = now() "
            "where id = %s and embedding_status <> 'ready'", (status, pet_id))

    async def save(self, pet_id, result):
        await self.query(
            "update {table} set embedding = %s::vector, embedding_model = %s, "
            "embedding_fallback_used = false, embedding_warning = %s, "
            "embedding_status = 'ready', updated_at = now() "
            "where id = %s and embedding_status <> 'ready'",
            (str(result["embedding"]), result["model"], result.get("warning"), pet_id))

    async def pending(self):
        return await self.query(
            "select id from {table} where embedding_status in ('pending', 'processing') "
            "order by updated_at, id limit 100")
