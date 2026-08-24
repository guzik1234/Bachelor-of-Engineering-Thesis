from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    learning_path_id: Mapped[int] = mapped_column(
        ForeignKey("learning_paths.id", ondelete="CASCADE"), index=True
    )

    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)

    learning_path: Mapped["LearningPath"] = relationship(back_populates="modules")
    materials: Mapped[list["Material"]] = relationship(
        back_populates="module", cascade="all, delete-orphan"
    )
    progress_entries: Mapped[list["Progress"]] = relationship(
        back_populates="module", cascade="all, delete-orphan"
    )
