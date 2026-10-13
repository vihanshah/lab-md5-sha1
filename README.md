# Message Integrity Checker Using MD5 and SHA-1

**Computer Engineering — Cryptography and System Security (CSS) Practical**  
Based on the College Lab Specification: `Pract-MD5VsSHA-1.pdf`

---

## 📌 Project Overview

This application is a **File Integrity Checker** designed to verify whether files have remained unchanged or have been modified/tampered with. It compares a file's previously stored **MD5** (128-bit) and **SHA-1** (160-bit) cryptographic hashes with freshly recalculated digests.

### ⚠️ Strict Algorithm Implementation Rule
Both MD5 and SHA-1 are implemented **purely from scratch in Python** (`backend/crypto_hashes.py`) without utilizing Python's `hashlib.md5()` or `hashlib.sha1()` for calculation:
- **Custom MD5**: Full padding (1-bit + zero padding to 448 mod 512 bits), 64-bit little-endian length, four 32-bit registers ($A, B, C, D$), four auxiliary non-linear Boolean functions ($F, G, H, I$), 64 trigonometric constants $K[i] = \lfloor 2^{32} \cdot |\sin(i+1)| \rfloor$, 4 rounds of 16 operations each, per-round shifts, and little-endian hex formatting.
- **Custom SHA-1**: Full padding (0x80 + zero padding to 448 mod 512 bits), 64-bit big-endian length, five 32-bit chaining variables ($H_0, H_1, H_2, H_3, H_4$), message schedule expansion from 16 to 80 words ($W[t] = S^1(W[t-3] \oplus W[t-8] \oplus W[t-14] \oplus W[t-16])$), four Boolean logic functions, round constants, 80 rounds, and big-endian hex formatting.

---

## 🚀 Key Features

1. **Save File Baseline**:
   - Supports any binary file (text documents, images, PDFs, executables).
   - Generates custom MD5 & SHA-1 hashes and records execution time in milliseconds.
   - Saves baseline record to a local SQLite database (`backend/integrity_checker.db`) with unique ID, filename, file size, hashes, and timestamp.
2. **Verify File Integrity**:
   - Compares candidate files against stored baselines.
   - Prominently displays:
     - 🟢 **"File is unchanged"** (both hashes match).
     - 🔴 **"File has been modified"** (either hash differs).
   - Character-by-character side-by-side hash comparison and file size delta.
   - Renaming detection: Renaming a file without altering contents preserves integrity and passes verification.
3. **Saved Baselines Management**:
   - Interactive table of persistent baselines stored in SQLite.
   - Allows quick one-click verification and copying of digests.
4. **Performance & Timing Benchmark**:
   - Matches the practical PDF timing table comparing MD5 vs SHA-1 across varying payload sizes (1 KB, 5 KB, 10 KB, 50 KB).
5. **Practical Lab Analysis & Collision Demonstration**:
   - Lab Question 1: In-depth theoretical explanation of why SHA-1 is more secure than MD5.
   - Lab Question 3: Interactive collision demo and security advisory on collision attacks (Wang 2005, SHAttered 2017) and why SHA-256 is used today.

---

## 📁 Repository Structure

```
c:/meow/css/
├── backend/
│   ├── app.py              # FastAPI backend with REST endpoints & static frontend serving
│   ├── crypto_hashes.py    # Custom pure Python MD5 & SHA-1 algorithm implementations
│   ├── database.py         # SQLite persistence for baselines & audit verification logs
│   ├── integrity_checker.db # Local SQLite database
│   ├── test_integrity.py   # Comprehensive automated test suite (15 tests)
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Modern React application
│   │   ├── index.css       # Custom cyber-dark aesthetic & design system
│   │   └── main.jsx
│   ├── dist/               # Production frontend build
│   ├── package.json
│   ├── index.html
│   └── vite.config.js
└── README.md
```

---

## 🛠️ Installation & Startup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+ (for frontend development)

### 1. Install Backend Dependencies
```bash
pip install -r backend/requirements.txt
```

### 2. Run the Application
The application can be started with a single command. The FastAPI backend serves both the API and the React frontend:

```bash
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```
Open your web browser and navigate to:
👉 **`http://localhost:8000/`**

*(Optional) For frontend live development:*
```bash
cd frontend
npm install
npm run dev
```
*(Runs on `http://localhost:5173/` and proxies API requests to port 8000)*

---

## 🧪 Running Automated Tests

Run the automated test suite using `pytest`:

```bash
python -m pytest backend/test_integrity.py -v
```

### Verified Test Scenarios:
1. **Scenario 1 & 2**: Save baseline and verify the same unchanged file (`File is unchanged`).
2. **Scenario 3**: Modify file content and verify (`File has been modified`).
3. **Scenario 4**: Verify a completely different file (`File has been modified`).
4. **Scenario 5**: Rename a file without changing content (`File is unchanged`).
5. **Scenario 6**: Verify empty file (0 bytes).
6. **Scenario 7**: Verify binary files (PNG and PDF bytes).
7. **Scenario 8**: Confirm persistence in SQLite database across sessions.
8. **Scenario 9**: Validate custom MD5 and SHA-1 against standard RFC & FIPS test vectors.
