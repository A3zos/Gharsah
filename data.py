"""Read/write endpoints that feed the Manara web app screens
(lessons, student progress, parent dashboard, task completion)."""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db import fetch_all, fetch_one, execute

router = APIRouter(prefix="/api", tags=["app"])


def _uid(value: str) -> str:
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise HTTPException(status_code=404, detail="not found")


@router.get("/students")
def students():
    return fetch_all(
        """SELECT u.id, u.name, u.parent_id, s.age, s.level, s.avatar_key
           FROM students s JOIN users u ON u.id = s.user_id
           ORDER BY u.name"""
    )


@router.get("/lessons")
def lessons():
    rows = fetch_all("SELECT * FROM lessons ORDER BY order_index, id")
    out = []
    for lesson in rows:
        ayat = fetch_all(
            """SELECT id, surah_no, surah_name, ayah_no, text_ar, tafsir_simple
               FROM quran_ayat
               WHERE (surah_no, ayah_no) >= (%s, %s) AND (surah_no, ayah_no) <= (%s, %s)
               ORDER BY surah_no, ayah_no""",
            (lesson["surah_from"], lesson["ayah_from"], lesson["surah_to"], lesson["ayah_to"]),
        )
        hadith = None
        if lesson["hadith_id"]:
            hadith = fetch_one(
                "SELECT text_ar, source, explanation_simple FROM hadiths WHERE id=%s",
                (lesson["hadith_id"],),
            )
        tasks = fetch_all(
            "SELECT id, description FROM practical_tasks WHERE lesson_id=%s ORDER BY id",
            (lesson["id"],),
        )
        out.append({**lesson, "ayat": ayat, "hadith": hadith, "tasks": tasks})
    return out


def _student_summary(sid: str) -> dict:
    stats = fetch_one(
        """SELECT count(*)::int AS attempts,
                  COALESCE(round(avg(ai_score), 1), 0) AS avg_score
           FROM recitation_attempts WHERE student_id=%s""",
        (sid,),
    )
    prog = fetch_one(
        """SELECT count(*) FILTER (WHERE status='mastered')::int AS mastered,
                  count(*) FILTER (WHERE status IN ('learning','review'))::int AS learning
           FROM memorization_progress WHERE student_id=%s""",
        (sid,),
    )
    return {**stats, **prog}


@router.get("/student/{sid}/progress")
def student_progress(sid: str):
    sid = _uid(sid)
    if not fetch_one("SELECT 1 AS ok FROM students WHERE user_id=%s", (sid,)):
        raise HTTPException(status_code=404, detail="student not found")
    return {
        "summary": _student_summary(sid),
        "ayat": fetch_all(
            """SELECT p.ayah_id, p.status, p.next_review_at, a.surah_name, a.ayah_no
               FROM memorization_progress p JOIN quran_ayat a ON a.id = p.ayah_id
               WHERE p.student_id=%s ORDER BY a.surah_no, a.ayah_no""",
            (sid,),
        ),
        "attempts": fetch_all(
            """SELECT r.id, r.ai_score, r.created_at, a.surah_name, a.ayah_no
               FROM recitation_attempts r JOIN quran_ayat a ON a.id = r.ayah_id
               WHERE r.student_id=%s ORDER BY r.created_at DESC LIMIT 10""",
            (sid,),
        ),
        "recommendations": fetch_all(
            """SELECT id, type, content, created_at FROM ai_recommendations
               WHERE student_id=%s AND dismissed=false
               ORDER BY priority DESC, created_at DESC LIMIT 5""",
            (sid,),
        ),
        "completed_tasks": [
            r["task_id"]
            for r in fetch_all("SELECT task_id FROM task_completions WHERE student_id=%s", (sid,))
        ],
    }


@router.get("/parent/{pid}/dashboard")
def parent_dashboard(pid: str):
    pid = _uid(pid)
    kids = fetch_all(
        """SELECT u.id, u.name, s.age, s.level
           FROM users u JOIN students s ON s.user_id = u.id
           WHERE u.parent_id=%s ORDER BY u.name""",
        (pid,),
    )
    children = []
    for kid in kids:
        sid = str(kid["id"])
        children.append({
            **kid,
            "summary": _student_summary(sid),
            "recent_attempts": fetch_all(
                """SELECT r.ai_score, r.created_at, a.surah_name, a.ayah_no
                   FROM recitation_attempts r JOIN quran_ayat a ON a.id = r.ayah_id
                   WHERE r.student_id=%s ORDER BY r.created_at DESC LIMIT 3""",
                (sid,),
            ),
            "recommendations": fetch_all(
                """SELECT type, content FROM ai_recommendations
                   WHERE student_id=%s AND dismissed=false
                   ORDER BY priority DESC, created_at DESC LIMIT 3""",
                (sid,),
            ),
            "next_session": fetch_one(
                """SELECT l.scheduled_at, l.status, t.name AS teacher_name
                   FROM live_sessions l LEFT JOIN users t ON t.id = l.teacher_id
                   WHERE l.student_id=%s AND l.status='scheduled'
                   ORDER BY l.scheduled_at LIMIT 1""",
                (sid,),
            ),
        })
    return {"children": children}


class TaskIn(BaseModel):
    student_id: str
    task_id: int
    done: bool = True


@router.post("/tasks/complete")
def complete_task(body: TaskIn):
    sid = _uid(body.student_id)
    if body.done:
        execute(
            """INSERT INTO task_completions (student_id, task_id) VALUES (%s,%s)
               ON CONFLICT (student_id, task_id) DO NOTHING""",
            (sid, body.task_id),
        )
    else:
        execute("DELETE FROM task_completions WHERE student_id=%s AND task_id=%s", (sid, body.task_id))
    return {"ok": True}
