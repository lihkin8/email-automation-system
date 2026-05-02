from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import User, Recruiter, Email, EmailTracking, EmailType
from app.services.auth_service import get_current_user, get_db

router = APIRouter(tags=["analytics"])


def _open_count_subq():
    return (
        select(EmailTracking.email_id, func.count(EmailTracking.id).label("open_count"))
        .group_by(EmailTracking.email_id)
        .subquery()
    )


def _row_to_email_dict(row) -> dict:
    return {
        "email_id": row["email_id"],
        "recruiter_name": row["recruiter_name"],
        "company": row["company"],
        "email_type": row["email_type"],
        "status": row["status"],
        "is_opened": row["is_opened"],
        "open_count": row["open_count"],
        "sent_date": row["sent_date"].isoformat() if row["sent_date"] else None,
    }


@router.get("/companies")
async def get_companies(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(distinct(Recruiter.company))
        .where(Recruiter.user_id == current_user.id)
        .order_by(Recruiter.company)
    )
    return {"companies": [row[0] for row in result.fetchall()]}


@router.get("/analytics")
async def get_analytics(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    total = (await session.execute(
        select(func.count(Email.id)).where(Email.user_id == current_user.id)
    )).scalar()

    ocsq = _open_count_subq()
    result = await session.execute(
        select(
            Email.id.label("email_id"),
            Recruiter.name.label("recruiter_name"),
            Recruiter.company,
            Email.email_type,
            Email.status,
            Email.is_opened,
            Email.created_at.label("sent_date"),
            func.coalesce(ocsq.c.open_count, 0).label("open_count"),
        )
        .join(Recruiter, Email.recruiter_id == Recruiter.id)
        .outerjoin(ocsq, Email.id == ocsq.c.email_id)
        .where(Email.user_id == current_user.id)
        .order_by(Email.created_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    rows = result.mappings().all()
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "analytics": [_row_to_email_dict(r) for r in rows],
        "pagination": {"total": total, "page": page, "page_size": page_size, "total_pages": total_pages},
    }


@router.get("/company-analytics")
async def get_company_analytics(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    ocsq = _open_count_subq()
    result = await session.execute(
        select(
            Recruiter.company,
            func.count(distinct(Email.id)).label("total_emails"),
            func.count(distinct(Email.id)).filter(Email.is_opened.is_(True)).label("opened_emails"),
            func.count(distinct(Email.id)).filter(Email.email_type == EmailType.FOLLOW_UP).label("follow_ups"),
            func.coalesce(func.sum(ocsq.c.open_count), 0).label("total_opens"),
            func.max(EmailTracking.opened_at).label("last_interaction"),
        )
        .select_from(Recruiter)
        .join(Email, Recruiter.id == Email.recruiter_id)
        .outerjoin(ocsq, Email.id == ocsq.c.email_id)
        .outerjoin(EmailTracking, Email.id == EmailTracking.email_id)
        .where(Recruiter.user_id == current_user.id)
        .group_by(Recruiter.company)
        .order_by(Recruiter.company)
    )
    agg_rows = result.mappings().all()

    status_result = await session.execute(
        select(Recruiter.company, Email.status)
        .join(Email, Recruiter.id == Email.recruiter_id)
        .where(Recruiter.user_id == current_user.id)
        .distinct()
    )
    statuses: dict[str, set] = {}
    for company, status in status_result.fetchall():
        statuses.setdefault(company, set()).add(status)

    return {
        "company_analytics": [
            {
                "company": row["company"],
                "total_emails": row["total_emails"],
                "opened_emails": row["opened_emails"],
                "follow_ups": row["follow_ups"],
                "total_opens": int(row["total_opens"]),
                "last_interaction": row["last_interaction"].isoformat() if row["last_interaction"] else None,
                "email_statuses": ", ".join(sorted(statuses.get(row["company"], set()))),
            }
            for row in agg_rows
        ]
    }


@router.get("/company/{company_name}")
async def get_company_details(
    company_name: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    ocsq = _open_count_subq()
    result = await session.execute(
        select(
            func.count(distinct(Email.id)).label("total_emails"),
            func.count(distinct(Email.id)).filter(Email.is_opened.is_(True)).label("opened_emails"),
            func.count(distinct(Email.id)).filter(Email.email_type == EmailType.FOLLOW_UP).label("follow_ups"),
            func.coalesce(func.sum(ocsq.c.open_count), 0).label("total_opens"),
            func.max(EmailTracking.opened_at).label("last_interaction"),
        )
        .select_from(Recruiter)
        .join(Email, Recruiter.id == Email.recruiter_id)
        .outerjoin(ocsq, Email.id == ocsq.c.email_id)
        .outerjoin(EmailTracking, Email.id == EmailTracking.email_id)
        .where(Recruiter.user_id == current_user.id, Recruiter.company == company_name)
    )
    row = result.mappings().first()
    if row is None or row["total_emails"] == 0:
        raise HTTPException(status_code=404, detail="Company not found")

    return {
        "company_details": {
            "total_emails": row["total_emails"],
            "opened_emails": row["opened_emails"],
            "follow_ups": row["follow_ups"],
            "total_opens": int(row["total_opens"]),
            "last_interaction": row["last_interaction"].isoformat() if row["last_interaction"] else None,
        }
    }


@router.get("/company/{company_name}/emails")
async def get_company_emails(
    company_name: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    ocsq = _open_count_subq()
    result = await session.execute(
        select(
            Email.id.label("email_id"),
            Recruiter.name.label("recruiter_name"),
            Recruiter.company,
            Email.email_type,
            Email.status,
            Email.is_opened,
            Email.created_at.label("sent_date"),
            func.coalesce(ocsq.c.open_count, 0).label("open_count"),
        )
        .join(Recruiter, Email.recruiter_id == Recruiter.id)
        .outerjoin(ocsq, Email.id == ocsq.c.email_id)
        .where(Email.user_id == current_user.id, Recruiter.company == company_name)
        .order_by(Email.created_at.desc())
    )
    return {"company_emails": [_row_to_email_dict(r) for r in result.mappings().all()]}
