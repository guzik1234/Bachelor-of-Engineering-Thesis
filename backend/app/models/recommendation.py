from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
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

    # True when the monitoring agent detected the learner struggling with a
    # module (low exercise pass rate and/or low feedback rating) and thinks
    # they should practice it before moving on.
    needs_remediation: Mapped[bool] = mapped_column(Boolean, default=False)
    remediation_module_id: Mapped[int | None] = mapped_column(
        ForeignKey("modules.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    learning_path: Mapped["LearningPath"] = relationship(back_populates="recommendations")
    recommended_module: Mapped["Module | None"] = relationship(foreign_keys=[recommended_module_id])
    remediation_module: Mapped["Module | None"] = relationship(foreign_keys=[remediation_module_id])
