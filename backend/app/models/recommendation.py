from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PathRecommendation(Base):
    __tablename__ = "path_recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    learning_path_id: Mapped[int] = mapped_column(
        ForeignKey("learning_paths.id", ondelete="CASCADE"), index=True
    )

    pace_assessment: Mapped[str] = mapped_column(String(20))
    recommended_experience_level: Mapped[str] = mapped_column(String(20))
    recommended_module_id: Mapped[int | None] = mapped_column(
        ForeignKey("modules.id", ondelete="SET NULL"), nullable=True
    )
    rationale: Mapped[str] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    learning_path: Mapped["LearningPath"] = relationship(back_populates="recommendations")
    recommended_module: Mapped["Module | None"] = relationship()
