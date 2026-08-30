from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
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

    # Set when this module was auto-inserted by the monitoring agent as
    # practice for a module the learner struggled with (see source_module_id).
    is_remediation: Mapped[bool] = mapped_column(Boolean, default=False)
    source_module_id: Mapped[int | None] = mapped_column(
        ForeignKey("modules.id", ondelete="SET NULL"), nullable=True
    )

    learning_path: Mapped["LearningPath"] = relationship(back_populates="modules")
    materials: Mapped[list["Material"]] = relationship(
        back_populates="module", cascade="all, delete-orphan"
    )
    progress_entries: Mapped[list["Progress"]] = relationship(
        back_populates="module", cascade="all, delete-orphan"
    )
