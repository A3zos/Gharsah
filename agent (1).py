from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import agent_service, hadith_agent, quran_data
from app.services.lesson_content import LESSON, HADITHS

router = APIRouter(prefix="/agent", tags=["agent"])


class StartIn(BaseModel):
    child_name: Optional[str] = "يا بطل"
    mode: Optional[str] = "quran"
    gender: Optional[str] = "boy"


class MessageIn(BaseModel):
    session_id: str
    text: str
    mode: Optional[str] = None


@router.post("/start")
def start(body: StartIn):
    if body.mode == "hadith":
        return hadith_agent.start(body.gender or "")
    return agent_service.start(body.child_name or "يا بطل", body.gender or "")


@router.post("/message")
def message(body: MessageIn):
    hs = hadith_agent.get_session(body.session_id)
    if hs:
        return hadith_agent.handle(hs, body.text)
    s = agent_service.get_session(body.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="session expired, please start again")
    return agent_service.handle(s, body.text)


@router.get("/status")
def status():
    return {"llm": agent_service.llm_available(), "model": agent_service.MODEL_NAME, "last_error": agent_service.LAST_ERROR["msg"]}


@router.get("/content")
def content():
    return {"lesson": {"title": LESSON["title"], "meta": LESSON["meta"], "ayat": LESSON["ayat"]}, "hadiths": HADITHS}


@router.get("/surahs")
def surahs():
    return {"surahs": quran_data.surah_list()}
