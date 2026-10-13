"""
Custom implementations of MD5 and SHA-1 Cryptographic Hash Algorithms.
Written strictly according to the specifications in RFC 1321 (MD5), FIPS PUB 180-1 (SHA-1),
and the college practical lab manual 'Pract-MD5VsSHA-1.pdf'.

CRITICAL REQUIREMENT:
No standard-library hashlib is used for hash calculations.
All bitwise operations, padding, scheduling, rotations, and constants are implemented manually.
"""

import math
import struct
import time
from typing import Tuple, Dict, Any


def left_rotate_32(val: int, n: int) -> int:
    """32-bit left circular shift."""
    return ((val << n) | (val >> (32 - n))) & 0xFFFFFFFF


# Precomputed 64 MD5 constant table: Ki = floor(abs(sin(i + 1)) * 2^32)
MD5_K = [int(abs(math.sin(i + 1)) * (2**32)) & 0xFFFFFFFF for i in range(64)]

# Per-round shift amounts for MD5
MD5_SHIFTS = (
    [7, 12, 17, 22] * 4 +   # Round 1
    [5,  9, 14, 20] * 4 +   # Round 2
    [4, 11, 16, 23] * 4 +   # Round 3
    [6, 10, 15, 21] * 4     # Round 4
)


def md5_custom(data: bytes) -> str:
    """
    Computes 128-bit MD5 digest for arbitrary binary data.
    Implements RFC 1321 & Lab Manual specifications:
    - 512-bit block processing
    - Padding: 0x80 followed by 0x00s until 448 mod 512 bits (56 mod 64 bytes)
    - 64-bit little-endian message bit-length
    - 4 state registers A, B, C, D
    - 4 nonlinear auxiliary functions F, G, H, I
    - 64 rounds with trigonometric constants
    - Little-endian digest output (128-bit / 32 hex chars)
    """
    original_byte_len = len(data)
    original_bit_len = (original_byte_len * 8) & 0xFFFFFFFFFFFFFFFF

    # Step 1: Append padding bits
    padded = bytearray(data)
    padded.append(0x80)
    while (len(padded) % 64) != 56:
        padded.append(0x00)

    # Step 2: Append 64-bit original length as little-endian integer
    padded += struct.pack('<Q', original_bit_len)

    # Step 3 & 4: Initialize MD Buffer (32-bit registers)
    # word A: 01 23 45 67 -> 0x67452301
    # word B: 89 ab cd ef -> 0xefcdab89
    # word C: fe dc ba 98 -> 0x98badcfe
    # word D: 76 54 32 10 -> 0x10325476
    A = 0x67452301
    B = 0xEFCDAB89
    C = 0x98BADCFE
    D = 0x10325476

    # Step 5: Process message in 16-word (512-bit / 64-byte) blocks
    for offset in range(0, len(padded), 64):
        block = padded[offset:offset + 64]
        M = list(struct.unpack('<16I', block))
        
        a, b, c, d = A, B, C, D

        for i in range(64):
            if 0 <= i <= 15:
                # Round 1: F(b, c, d) = (b & c) | (~b & d)
                f = (b & c) | ((~b) & d)
                g = i
            elif 16 <= i <= 31:
                # Round 2: G(b, c, d) = (b & d) | (c & ~d)
                f = (d & b) | ((~d) & c)
                g = (5 * i + 1) % 16
            elif 32 <= i <= 47:
                # Round 3: H(b, c, d) = b ^ c ^ d
                f = b ^ c ^ d
                g = (3 * i + 5) % 16
            else:
                # Round 4: I(b, c, d) = c ^ (b | ~d)
                f = c ^ (b | (~d))
                g = (7 * i) % 16

            temp = (f + a + MD5_K[i] + M[g]) & 0xFFFFFFFF
            a, d, c, b = d, c, b, (b + left_rotate_32(temp, MD5_SHIFTS[i])) & 0xFFFFFFFF

        A = (A + a) & 0xFFFFFFFF
        B = (B + b) & 0xFFFFFFFF
        C = (C + c) & 0xFFFFFFFF
        D = (D + d) & 0xFFFFFFFF

    # Step 6: Output digest (low-order byte of A to high-order byte of D)
    return struct.pack('<4I', A, B, C, D).hex()


def sha1_custom(data: bytes) -> str:
    """
    Computes 160-bit SHA-1 digest for arbitrary binary data.
    Implements FIPS PUB 180-1 & Lab Manual specifications:
    - 512-bit block processing
    - Padding: 0x80 followed by 0x00s until 448 mod 512 bits (56 mod 64 bytes)
    - 64-bit big-endian message bit-length
    - 5 chaining variables H0, H1, H2, H3, H4
    - 80-word message schedule expansion: W[t] = S^1(W[t-3] ^ W[t-8] ^ W[t-14] ^ W[t-16])
    - 4 Boolean-function groups and round constants
    - Big-endian digest output (160-bit / 40 hex chars)
    """
    original_byte_len = len(data)
    original_bit_len = (original_byte_len * 8) & 0xFFFFFFFFFFFFFFFF

    # Step 1: Append padding bits
    padded = bytearray(data)
    padded.append(0x80)
    while (len(padded) % 64) != 56:
        padded.append(0x00)

    # Step 2: Append 64-bit original length as big-endian integer
    padded += struct.pack('>Q', original_bit_len)

    # Step 3 & 4: Initialize chaining variables
    H0 = 0x67452301
    H1 = 0xEFCDAB89
    H2 = 0x98BADCFE
    H3 = 0x10325476
    H4 = 0xC3D2E1F0

    # Step 5: Process each 512-bit block
    for offset in range(0, len(padded), 64):
        block = padded[offset:offset + 64]
        # 16 32-bit big-endian words + 64 zeros for schedule
        W = list(struct.unpack('>16I', block)) + [0] * 64

        # Expand 16 words into 80 words
        for t in range(16, 80):
            W[t] = left_rotate_32(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1)

        a, b, c, d, e = H0, H1, H2, H3, H4

        # 80 rounds in 4 stages of 20 rounds each
        for t in range(80):
            if 0 <= t <= 19:
                f = (b & c) | ((~b) & d)
                k = 0x5A827999
            elif 20 <= t <= 39:
                f = b ^ c ^ d
                k = 0x6ED9EBA1
            elif 40 <= t <= 59:
                f = (b & c) | (b & d) | (c & d)
                k = 0x8F1BBCDC
            else:
                f = b ^ c ^ d
                k = 0xCA62C1D6

            temp = (left_rotate_32(a, 5) + f + e + k + W[t]) & 0xFFFFFFFF
            e = d
            d = c
            c = left_rotate_32(b, 30)
            b = a
            a = temp

        H0 = (H0 + a) & 0xFFFFFFFF
        H1 = (H1 + b) & 0xFFFFFFFF
        H2 = (H2 + c) & 0xFFFFFFFF
        H3 = (H3 + d) & 0xFFFFFFFF
        H4 = (H4 + e) & 0xFFFFFFFF

    # Step 6: Output 160-bit digest as 40 hexadecimal characters
    return f"{H0:08x}{H1:08x}{H2:08x}{H3:08x}{H4:08x}"


def compute_file_hashes(data: bytes) -> Dict[str, Any]:
    """
    Computes both MD5 and SHA-1 hashes using the manual algorithms,
    recording high-resolution execution time for performance analysis.
    """
    t0 = time.perf_counter()
    md5_hash = md5_custom(data)
    md5_time_ms = (time.perf_counter() - t0) * 1000

    t1 = time.perf_counter()
    sha1_hash = sha1_custom(data)
    sha1_time_ms = (time.perf_counter() - t1) * 1000

    return {
        "md5": md5_hash,
        "sha1": sha1_hash,
        "md5_time_ms": round(md5_time_ms, 3),
        "sha1_time_ms": round(sha1_time_ms, 3),
        "total_time_ms": round(md5_time_ms + sha1_time_ms, 3)
    }
