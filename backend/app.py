"""
FastAPI Backend Application for Message Integrity Checker Using MD5 and SHA-1.
All hash calculations strictly use custom algorithms from crypto_hashes.py.
"""

import os
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .crypto_hashes import compute_file_hashes, md5_custom, sha1_custom
from .database import (
    init_db,
    save_baseline,
    get_all_baselines,
    get_baseline_by_id,
    delete_baseline,
    record_verification,
    get_recent_verifications,
    DB_PATH
)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Message Integrity Checker API",
    description="File Integrity Checker using custom MD5 and SHA-1 implementations according to practical syllabus",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for React frontend (Vite dev server default 5173 / localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "database_file": DB_PATH,
        "database_exists": os.path.exists(DB_PATH)
    }


@app.get("/api/baselines")
def list_baselines():
    baselines = get_all_baselines()
    return {"baselines": baselines, "total": len(baselines)}


@app.post("/api/baselines")
async def create_baseline(
    file: UploadFile = File(...),
    notes: Optional[str] = Form("")
):
    """
    Accepts an uploaded file (binary safe for text, images, PDFs, executables),
    computes MD5 and SHA-1 using custom pure-Python algorithms,
    and stores the baseline in SQLite.
    """
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    file_size = len(content)
    filename = file.filename or "unnamed_file"

    hash_results = compute_file_hashes(content)
    
    baseline = save_baseline(
        filename=filename,
        file_size=file_size,
        md5_hash=hash_results["md5"],
        sha1_hash=hash_results["sha1"],
        notes=notes or ""
    )

    return {
        "success": True,
        "baseline": baseline,
        "performance": {
            "md5_time_ms": hash_results["md5_time_ms"],
            "sha1_time_ms": hash_results["sha1_time_ms"],
            "total_time_ms": hash_results["total_time_ms"],
            "file_size_bytes": file_size
        }
    }


@app.get("/api/baselines/{baseline_id}")
def get_baseline(baseline_id: str):
    baseline = get_baseline_by_id(baseline_id)
    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")
    return baseline


@app.delete("/api/baselines/{baseline_id}")
def remove_baseline(baseline_id: str):
    success = delete_baseline(baseline_id)
    if not success:
        raise HTTPException(status_code=404, detail="Baseline not found")
    return {"success": True, "deleted_id": baseline_id}


@app.post("/api/verify")
async def verify_file(
    baseline_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Recalculates MD5 and SHA-1 hashes of the uploaded file using custom algorithms,
    compares them with the stored baseline, and returns detailed integrity status.
    """
    baseline = get_baseline_by_id(baseline_id)
    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline record not found")

    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    current_filesize = len(content)
    checked_filename = file.filename or "unnamed_file"

    hash_results = compute_file_hashes(content)
    current_md5 = hash_results["md5"]
    current_sha1 = hash_results["sha1"]

    orig_md5 = baseline["md5_hash"]
    orig_sha1 = baseline["sha1_hash"]

    md5_matched = (current_md5.lower() == orig_md5.lower())
    sha1_matched = (current_sha1.lower() == orig_sha1.lower())

    # File is unchanged ONLY if both hashes match
    is_unchanged = md5_matched and sha1_matched

    status_message = "File is unchanged" if is_unchanged else "File has been modified"

    # Audit log persistence
    log_entry = record_verification(
        baseline_id=baseline_id,
        baseline_filename=baseline["filename"],
        checked_filename=checked_filename,
        original_filesize=baseline["file_size"],
        checked_filesize=current_filesize,
        original_md5=orig_md5,
        current_md5=current_md5,
        original_sha1=orig_sha1,
        current_sha1=current_sha1,
        md5_matched=md5_matched,
        sha1_matched=sha1_matched,
        is_unchanged=is_unchanged
    )

    return {
        "status_message": status_message,
        "is_unchanged": is_unchanged,
        "md5_matched": md5_matched,
        "sha1_matched": sha1_matched,
        "comparison": {
            "original_md5": orig_md5,
            "current_md5": current_md5,
            "md5_diff_indices": [i for i in range(len(orig_md5)) if i < len(current_md5) and orig_md5[i] != current_md5[i]],
            "original_sha1": orig_sha1,
            "current_sha1": current_sha1,
            "sha1_diff_indices": [i for i in range(len(orig_sha1)) if i < len(current_sha1) and orig_sha1[i] != current_sha1[i]],
        },
        "metadata": {
            "baseline_id": baseline_id,
            "original_filename": baseline["filename"],
            "checked_filename": checked_filename,
            "is_filename_same": (baseline["filename"] == checked_filename),
            "original_filesize": baseline["file_size"],
            "checked_filesize": current_filesize,
            "filesize_diff_bytes": current_filesize - baseline["file_size"],
            "baseline_created_at": baseline["created_at"]
        },
        "performance": {
            "md5_time_ms": hash_results["md5_time_ms"],
            "sha1_time_ms": hash_results["sha1_time_ms"],
            "total_time_ms": hash_results["total_time_ms"]
        },
        "audit_id": log_entry["id"]
    }


@app.get("/api/recent-checks")
def recent_checks(limit: int = 10):
    logs = get_recent_verifications(limit=limit)
    return {"recent_verifications": logs}


class CollisionCheckRequest(BaseModel):
    messages: List[str]


@app.post("/api/collision-demo")
def collision_demo(req: CollisionCheckRequest):
    """
    Demonstrates Question 3 from the practical lab manual:
    Accepts multiple messages as input and generates their MD5 and SHA-1 hash values.
    Checks whether any two different messages produce the same hash value.
    """
    results = []
    md5_seen = {}
    sha1_seen = {}
    md5_collisions = []
    sha1_collisions = []

    for idx, msg in enumerate(req.messages):
        msg_bytes = msg.encode('utf-8')
        md5_h = md5_custom(msg_bytes)
        sha1_h = sha1_custom(msg_bytes)

        if md5_h in md5_seen:
            md5_collisions.append({
                "hash": md5_h,
                "msg1": md5_seen[md5_h],
                "msg2": msg
            })
        else:
            md5_seen[md5_h] = msg

        if sha1_h in sha1_seen:
            sha1_collisions.append({
                "hash": sha1_h,
                "msg1": sha1_seen[sha1_h],
                "msg2": msg
            })
        else:
            sha1_seen[sha1_h] = msg

        results.append({
            "index": idx + 1,
            "message": msg,
            "byte_length": len(msg_bytes),
            "md5": md5_h,
            "sha1": sha1_h
        })

    return {
        "items": results,
        "md5_collision_found": len(md5_collisions) > 0,
        "md5_collisions": md5_collisions,
        "sha1_collision_found": len(sha1_collisions) > 0,
        "sha1_collisions": sha1_collisions,
        "explanation": (
            "A hash collision occurs when two distinct inputs produce identical digests. "
            "Because MD5 produces 128-bit digests and SHA-1 produces 160-bit digests, "
            "by Pigeonhole Principle collisions mathematically exist across the infinite set of all files. "
            "Modern attacks (e.g., Wang 2005 for MD5, SHAttered 2017 for SHA-1) prove both are cryptographically "
            "broken against active adversaries, which is why SHA-256 and SHA-3 are mandated today."
        )
    }


@app.get("/api/benchmark-presets")
def benchmark_presets():
    """
    Returns timing comparisons for standard sizes (1 KB, 5 KB, 10 KB, 50 KB)
    as outlined in the practical lab manual timing table.
    """
    sizes = [1024, 5 * 1024, 10 * 1024, 50 * 1024]
    benchmark_results = []

    for sz in sizes:
        sample_data = (b"The quick brown fox jumps over the lazy dog. 1234567890! " * ((sz // 50) + 1))[:sz]
        timing = compute_file_hashes(sample_data)
        benchmark_results.append({
            "size_label": f"{sz // 1024} KB",
            "size_bytes": sz,
            "md5_time_ms": timing["md5_time_ms"],
            "sha1_time_ms": timing["sha1_time_ms"],
            "speed_ratio": round(timing["sha1_time_ms"] / max(timing["md5_time_ms"], 0.001), 2)
        })

    return {"benchmarks": benchmark_results}


# Mount production frontend build if available
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

