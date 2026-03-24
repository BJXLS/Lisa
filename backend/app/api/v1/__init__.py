from fastapi import APIRouter

from app.api.v1 import auth, chat, interviews, resumes

router = APIRouter(prefix="/v1")
router.include_router(auth.router)
router.include_router(resumes.router)
router.include_router(interviews.router)
router.include_router(chat.router)
