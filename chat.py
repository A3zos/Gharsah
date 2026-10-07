import uuid
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.services import llm_service
from app.services import rate_limit
from app.services import error_log
from app.db import execute

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatIn(BaseModel):
    student_id: Optional[str] = None
    message: str


def _valid_uuid(value):
    try:
        return str(uuid.UUID(value))
    except (ValueError, TypeError, AttributeError):
        return None


@router.post("", dependencies=[Depends(rate_limit.limit_chat)])
def chat(body: ChatIn):
    try:
        result = llm_service.ask(body.message)
    except Exception as e:  # e.g. Claude API error: keep the app usable
        error_log.record("chat.ask", e)  # razan's request #2: durable error record
        return {"context_used": "", "reply": None, "note": f"تعذّر الاتصال بالمعلّم الذكي: {e}"}
    uid = _valid_uuid(body.student_id)
    if uid:  # only log real (UUID) users; the public demo uses a fake id
        try:
            execute(
                "INSERT INTO support_messages (user_id, role, body) VALUES (%s,'user',%s)",
                (uid, body.message),
            )
            if result["reply"]:
                execute(
                    "INSERT INTO support_messages (user_id, role, body) VALUES (%s,'bot',%s)",
                    (uid, result["reply"]),
                )
        except Exception:
            pass
    return result
