from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    technology: Mapped[str] = mapped_column(String(100))
    experience_level: Mapped[str] = mapped_column(String(20))
    learning_goal: Mapped[str | None] = mapped_column(String(500), nullable=True)

    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="learning_paths")
    modules: Mapped[list["Module"]] = relationship(
        back_populates="learning_path",
        cascade="all, delete-orphan",
        order_by="Module.order_index",
    )
