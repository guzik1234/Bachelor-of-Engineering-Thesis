from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id", ondelete="CASCADE"), index=True)

    material_type: Mapped[str] = mapped_column(String(20))
    content: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    module: Mapped["Module"] = relationship(back_populates="materials")
    feedback_entries: Mapped[list["Feedback"]] = relationship(
        back_populates="material", cascade="all, delete-orphan"
    )
    submissions: Mapped[list["ExerciseSubmission"]] = relationship(
        back_populates="material", cascade="all, delete-orphan"
    )
