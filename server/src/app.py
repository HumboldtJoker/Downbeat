"""Downbeat API server — ad serving, impression tracking, earnings.

Privacy guarantees (server-side):
- No user data is ever received, stored, or logged
- Impressions contain only: impression_id, duration_ms, clicked, tier
- Publisher identified by API key only — no email required for signup
- No cross-publisher data sharing
- Request logs contain only method, path, status — no bodies
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    db.seed_demo_data()
    yield


app = FastAPI(
    title="Downbeat API",
    description="Privacy-first ad revenue sharing for developer tools",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["X-Downbeat-Key", "Content-Type"],
)


def _require_publisher(api_key: str) -> dict:
    if not api_key:
        raise HTTPException(401, "Missing X-Downbeat-Key header")
    pub = db.get_publisher(api_key)
    if not pub:
        raise HTTPException(401, "Invalid API key")
    return pub


# --- Ad serving ---

class AdResponse(BaseModel):
    text: str
    url: str
    impression_id: str


@app.get("/api/v1/ad", response_model=AdResponse)
async def fetch_ad(x_downbeat_key: str = Header("")):
    pub = _require_publisher(x_downbeat_key)
    ad = db.fetch_active_ad()
    if not ad:
        raise HTTPException(204, "No ads available")

    impression_id = db.create_impression(ad["id"], pub["api_key"])
    return AdResponse(
        text=ad["text"],
        url=ad["url"],
        impression_id=impression_id,
    )


# --- Impression recording ---

class ImpressionItem(BaseModel):
    impression_id: str
    duration_ms: int = Field(ge=0, le=600000)
    clicked: bool = False
    tier: str = "ambient"


class ImpressionBatch(BaseModel):
    impressions: list[ImpressionItem] = Field(max_length=100)


@app.post("/api/v1/impressions/batch")
async def record_impressions(
    batch: ImpressionBatch,
    x_downbeat_key: str = Header(""),
):
    _require_publisher(x_downbeat_key)

    recorded = 0
    for imp in batch.impressions:
        tier = imp.tier if imp.tier in ("ambient", "verified") else "ambient"
        if db.record_impression(imp.impression_id, imp.duration_ms,
                                imp.clicked, tier):
            recorded += 1

    return {"recorded": recorded, "total": len(batch.impressions)}


# --- Earnings ---

class EarningsResponse(BaseModel):
    today: float
    total: float


@app.get("/api/v1/earnings", response_model=EarningsResponse)
async def get_earnings(x_downbeat_key: str = Header("")):
    pub = _require_publisher(x_downbeat_key)
    earnings = db.get_earnings(pub["api_key"])
    return EarningsResponse(**earnings)


# --- Publisher signup ---

class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = ""


class SignupResponse(BaseModel):
    api_key: str
    message: str


@app.post("/api/v1/signup", response_model=SignupResponse)
async def signup(req: SignupRequest):
    api_key = db.create_publisher(req.name, req.email)
    return SignupResponse(
        api_key=api_key,
        message="Welcome to Downbeat. Keep this API key safe — it's your identity.",
    )


# --- Health ---

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
