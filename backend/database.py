"""
SQLite database persistence for File Baseline records and Verification Audit logs.
"""

import sqlite3
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "integrity_checker.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables for baselines and verification history."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS baselines (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                md5_hash TEXT NOT NULL,
                sha1_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                notes TEXT DEFAULT ''
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS verification_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                baseline_id TEXT NOT NULL,
                baseline_filename TEXT NOT NULL,
                checked_filename TEXT NOT NULL,
                original_filesize INTEGER NOT NULL,
                checked_filesize INTEGER NOT NULL,
                original_md5 TEXT NOT NULL,
                current_md5 TEXT NOT NULL,
                original_sha1 TEXT NOT NULL,
                current_sha1 TEXT NOT NULL,
                md5_matched INTEGER NOT NULL,
                sha1_matched INTEGER NOT NULL,
                is_unchanged INTEGER NOT NULL,
                checked_at TEXT NOT NULL,
                FOREIGN KEY (baseline_id) REFERENCES baselines (id) ON DELETE CASCADE
            )
        """)
        conn.commit()


def save_baseline(filename: str, file_size: int, md5_hash: str, sha1_hash: str, notes: str = "") -> Dict[str, Any]:
    baseline_id = str(uuid.uuid4())[:8]  # Clean 8-char identifier
    created_at = datetime.now().isoformat()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO baselines (id, filename, file_size, md5_hash, sha1_hash, created_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (baseline_id, filename, file_size, md5_hash, sha1_hash, created_at, notes))
        conn.commit()

    return {
        "id": baseline_id,
        "filename": filename,
        "file_size": file_size,
        "md5_hash": md5_hash,
        "sha1_hash": sha1_hash,
        "created_at": created_at,
        "notes": notes
    }


def get_all_baselines() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM baselines ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_baseline_by_id(baseline_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM baselines WHERE id = ?", (baseline_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_baseline(baseline_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM baselines WHERE id = ?", (baseline_id,))
        conn.commit()
        return cursor.rowcount > 0


def record_verification(
    baseline_id: str,
    baseline_filename: str,
    checked_filename: str,
    original_filesize: int,
    checked_filesize: int,
    original_md5: str,
    current_md5: str,
    original_sha1: str,
    current_sha1: str,
    md5_matched: bool,
    sha1_matched: bool,
    is_unchanged: bool
) -> Dict[str, Any]:
    checked_at = datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO verification_logs (
                baseline_id, baseline_filename, checked_filename,
                original_filesize, checked_filesize,
                original_md5, current_md5,
                original_sha1, current_sha1,
                md5_matched, sha1_matched, is_unchanged, checked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            baseline_id, baseline_filename, checked_filename,
            original_filesize, checked_filesize,
            original_md5, current_md5,
            original_sha1, current_sha1,
            1 if md5_matched else 0,
            1 if sha1_matched else 0,
            1 if is_unchanged else 0,
            checked_at
        ))
        log_id = cursor.lastrowid
        conn.commit()

    return {
        "id": log_id,
        "baseline_id": baseline_id,
        "baseline_filename": baseline_filename,
        "checked_filename": checked_filename,
        "original_filesize": original_filesize,
        "checked_filesize": checked_filesize,
        "original_md5": original_md5,
        "current_md5": current_md5,
        "original_sha1": original_sha1,
        "current_sha1": current_sha1,
        "md5_matched": md5_matched,
        "sha1_matched": sha1_matched,
        "is_unchanged": is_unchanged,
        "checked_at": checked_at
    }


def get_recent_verifications(limit: int = 10) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM verification_logs ORDER BY checked_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["md5_matched"] = bool(d["md5_matched"])
            d["sha1_matched"] = bool(d["sha1_matched"])
            d["is_unchanged"] = bool(d["is_unchanged"])
            result.append(d)
        return result
