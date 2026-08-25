from fastapi import APIRouter

from app.api.routes import auth, feedback, learning_paths, materials, preferences, progress, stats, tutor, users

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(preferences.router, prefix="/preferences", tags=["preferences"])
api_router.include_router(learning_paths.router, prefix="/learning-paths", tags=["learning-paths"])
api_router.include_router(materials.router, prefix="/materials", tags=["materials"])
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(tutor.router, prefix="/tutor", tags=["tutor"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
