import logging
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("app.database")

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns added to a table after it first shipped. This project has no
# migration tool (Alembic) — Base.metadata.create_all() only creates missing
# *tables*, so a table an older version of the code already created never
# gains the columns a newer model added. Each entry is a raw ADD COLUMN
# clause, applied only when the table already exists and the column doesn't
# — a brand-new database created by create_all() gets every column (FKs
# included) straight from the model, so this never runs for it.
#
# Foreign keys aren't recreated here (SQLite can't add them via ALTER TABLE,
# and the app's cascades run at the ORM/relationship level, not the DB level)
# — an intentional gap for these specific nullable, SET-NULL columns.
_ADDED_COLUMNS: list[tuple[str, str, str]] = [
    ("modules", "is_remediation", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("modules", "source_module_id", "INTEGER"),
    ("path_recommendations", "needs_remediation", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("path_recommendations", "remediation_module_id", "INTEGER"),
]


def sync_added_columns(engine: Engine) -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table, column, ddl in _ADDED_COLUMNS:
            if table not in existing_tables:
                continue
            existing_columns = {c["name"] for c in inspector.get_columns(table)}
            if column in existing_columns:
                continue
            logger.info("Patching existing schema: adding %s.%s", table, column)
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
