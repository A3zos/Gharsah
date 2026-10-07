from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import agent_service
from app.services.lesson_content import LESSON, HADITHS

router = APIRouter(prefix="/agent", tags=["agent"])


class StartIn(BaseModel):
    child_name: Optional[str] = "يا بطل"


class MessageIn(BaseModel):
    session_id: str
    text: str


@router.post("/start")
def start(body: StartIn):
    return agent_service.start(body.child_name or "يا بطل")


@router.post("/message")
def message(body: MessageIn):
    s = agent_service.get_session(body.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="session expired, please start again")
    return agent_service.handle(s, body.text)


@router.get("/status")
def status():
    return {"llm": agent_service.llm_available(), "model": agent_service.MODEL_NAME}


@router.get("/content")
def content():
    return {"lesson": {"title": LESSON["title"], "meta": LESSON["meta"], "ayat": LESSON["ayat"]}, "hadiths": HADITHS}
