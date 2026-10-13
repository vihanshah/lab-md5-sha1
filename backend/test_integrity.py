"""
Automated Test Suite for Message Integrity Checker.
Covers all required scenarios:
1. Save file baseline.
2. Verify same unchanged file -> 'File is unchanged'.
3. Verify modified file content -> 'File has been modified'.
4. Verify completely different file -> 'File has been modified'.
5. Verify renamed file with identical content -> 'File is unchanged'.
6. Verify empty file (0 bytes).
7. Verify binary files (PNG/PDF header simulations).
8. Confirm database persistence across sessions.
9. Verify custom algorithms against RFC/FIPS reference vectors and standard hashlib.
"""

import os
import hashlib
import tempfile
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.crypto_hashes import md5_custom, sha1_custom, compute_file_hashes
from backend.database import init_db, get_all_baselines, get_baseline_by_id

client = TestClient(app)


# Scenario 9: Algorithm accuracy against reference vectors and standard library
class TestAlgorithmReferenceVectors:
    @pytest.mark.parametrize("text", [
        "",
        "a",
        "abc",
        "message digest",
        "abcdefghijklmnopqrstuvwxyz",
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        "12345678901234567890123456789012345678901234567890123456789012345678901234567890",
        "Cryptography and System Security Practical: MD5 vs SHA-1 Integrity Checker",
    ])
    def test_custom_hashes_match_standard_library(self, text):
        data = text.encode("utf-8")
        
        # Verify custom MD5 matches standard hashlib.md5
        expected_md5 = hashlib.md5(data).hexdigest()
        actual_md5 = md5_custom(data)
        assert actual_md5 == expected_md5, f"MD5 mismatch for input '{text}'"

        # Verify custom SHA-1 matches standard hashlib.sha1
        expected_sha1 = hashlib.sha1(data).hexdigest()
        actual_sha1 = sha1_custom(data)
        assert actual_sha1 == expected_sha1, f"SHA-1 mismatch for input '{text}'"


# Scenarios 1 to 8: Application Workflow Tests
class TestIntegrityCheckerWorkflow:
    def setup_method(self):
        init_db()

    def test_scenario_1_and_2_save_and_verify_unchanged(self):
        content = b"Original document content for laboratory integrity verification test."
        filename = "contract_v1.txt"

        # 1. Save baseline
        response = client.post(
            "/api/baselines",
            files={"file": (filename, content, "text/plain")},
            data={"notes": "Original baseline"}
        )
        assert response.status_code == 200
        res_data = response.json()
        assert res_data["success"] is True
        baseline = res_data["baseline"]
        baseline_id = baseline["id"]

        assert baseline["md5_hash"] == hashlib.md5(content).hexdigest()
        assert baseline["sha1_hash"] == hashlib.sha1(content).hexdigest()

        # 2. Verify unchanged file
        verify_resp = client.post(
            "/api/verify",
            data={"baseline_id": baseline_id},
            files={"file": (filename, content, "text/plain")}
        )
        assert verify_resp.status_code == 200
        v_data = verify_resp.json()
        assert v_data["is_unchanged"] is True
        assert v_data["status_message"] == "File is unchanged"
        assert v_data["md5_matched"] is True
        assert v_data["sha1_matched"] is True

    def test_scenario_3_modified_file(self):
        content_orig = b"Original banking ledger: Alice sends Bob $100."
        content_modified = b"Modified banking ledger: Alice sends Bob $999."
        filename = "ledger.txt"

        # Save baseline
        save_resp = client.post(
            "/api/baselines",
            files={"file": (filename, content_orig, "text/plain")},
            data={"notes": "Banking ledger baseline"}
        )
        baseline_id = save_resp.json()["baseline"]["id"]

        # Verify modified file
        verify_resp = client.post(
            "/api/verify",
            data={"baseline_id": baseline_id},
            files={"file": (filename, content_modified, "text/plain")}
        )
        assert verify_resp.status_code == 200
        v_data = verify_resp.json()
        assert v_data["is_unchanged"] is False
        assert v_data["status_message"] == "File has been modified"
        assert v_data["md5_matched"] is False
        assert v_data["sha1_matched"] is False

    def test_scenario_4_different_file(self):
        orig_content = b"Report A: Quarterly sales are up 12%."
        diff_content = b"Report B: Engineering roadmaps for Q3."

        save_resp = client.post(
            "/api/baselines",
            files={"file": ("reportA.txt", orig_content, "text/plain")}
        )
        baseline_id = save_resp.json()["baseline"]["id"]

        verify_resp = client.post(
            "/api/verify",
            data={"baseline_id": baseline_id},
            files={"file": ("reportB.txt", diff_content, "text/plain")}
        )
        assert verify_resp.status_code == 200
        v_data = verify_resp.json()
        assert v_data["is_unchanged"] is False
        assert v_data["status_message"] == "File has been modified"

    def test_scenario_5_renamed_file_with_same_content(self):
        content = b"Confidential business agreement payload."
        
        save_resp = client.post(
            "/api/baselines",
            files={"file": ("original_name.pdf", content, "application/pdf")}
        )
        baseline_id = save_resp.json()["baseline"]["id"]

        # Verify with different filename but identical content
        verify_resp = client.post(
            "/api/verify",
            data={"baseline_id": baseline_id},
            files={"file": ("renamed_copy.pdf", content, "application/pdf")}
        )
        assert verify_resp.status_code == 200
        v_data = verify_resp.json()
        # Content hashes match, so file is considered UNCHANGED
        assert v_data["is_unchanged"] is True
        assert v_data["status_message"] == "File is unchanged"
        assert v_data["metadata"]["is_filename_same"] is False

    def test_scenario_6_empty_file(self):
        empty_content = b""

        save_resp = client.post(
            "/api/baselines",
            files={"file": ("empty.txt", empty_content, "text/plain")}
        )
        baseline_id = save_resp.json()["baseline"]["id"]
        assert save_resp.json()["baseline"]["file_size"] == 0

        verify_resp = client.post(
            "/api/verify",
            data={"baseline_id": baseline_id},
            files={"file": ("empty.txt", empty_content, "text/plain")}
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["is_unchanged"] is True

    def test_scenario_7_binary_files(self):
        # Simulated binary image with PNG magic header bytes + random bytes
        png_magic = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + os.urandom(1024)
        
        save_resp = client.post(
            "/api/baselines",
            files={"file": ("photo.png", png_magic, "image/png")}
        )
        baseline_id = save_resp.json()["baseline"]["id"]

        # Verify unchanged binary
        verify_resp = client.post(
            "/api/verify",
            data={"baseline_id": baseline_id},
            files={"file": ("photo.png", png_magic, "image/png")}
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["is_unchanged"] is True

        # Mutate 1 bit in binary file
        tampered_bytes = bytearray(png_magic)
        tampered_bytes[50] ^= 0x01  # Flip 1 bit
        tampered_resp = client.post(
            "/api/verify",
            data={"baseline_id": baseline_id},
            files={"file": ("photo.png", bytes(tampered_bytes), "image/png")}
        )
        assert tampered_resp.status_code == 200
        assert tampered_resp.json()["is_unchanged"] is False
        assert tampered_resp.json()["status_message"] == "File has been modified"

    def test_scenario_8_persistence(self):
        content = b"Persistence test record."
        save_resp = client.post(
            "/api/baselines",
            files={"file": ("persist.dat", content, "application/octet-stream")}
        )
        baseline_id = save_resp.json()["baseline"]["id"]

        # Re-query baseline directly from DB
        fetched = get_baseline_by_id(baseline_id)
        assert fetched is not None
        assert fetched["filename"] == "persist.dat"
        assert fetched["file_size"] == len(content)
