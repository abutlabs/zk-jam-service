#!/usr/bin/env python3
"""Measure per-op refine gas for ed25519-compact verify and Blake2s256 hash on lasair.

Method: run op with two different iteration counts; the delta / (n2-n1) isolates the
pure per-op cost (keygen+sign+deserialize setup and loop overhead cancel out)."""
import json, os, struct, urllib.request

RPC = os.environ.get("LASAIR_RPC", "http://127.0.0.1:19901")

def rpc(method, path, body=None):
    req = urllib.request.Request(RPC + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"content-type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read() or "null")

def deploy(jam_path):
    jam = open(jam_path, "rb").read()
    return rpc("POST", "/v1/service", {"jam_hex": jam.hex()})["service_id"]

def run(sid, op, count):
    payload = bytes([op]) + struct.pack("<I", count)
    r = rpc("POST", f"/v1/service/{sid}/item", {"payload_hex": payload.hex()})
    return r["refine_gas"], r.get("verdict")

def per_op(sid, op, n1, n2, label):
    g1, v1 = run(sid, op, n1)
    g2, v2 = run(sid, op, n2)
    per = (g2 - g1) / (n2 - n1)
    print(f"{label:22s} n={n1}: {g1:>12,} gas ({v1}) | n={n2}: {g2:>12,} gas ({v2}) "
          f"| per-op = {per:,.1f} gas")
    return per

def main():
    sid = deploy(os.environ["JAM"])
    print(f"deployed crypto-service sid={sid}\n")
    ed = per_op(sid, 0, 10, 110, "ed25519 verify")
    bl = per_op(sid, 1, 100, 1100, "blake2s (64B msg)")
    print()
    print(f"ed25519-compact verify: ~{ed:,.0f} gas/op")
    print(f"Blake2s256 (64B):       ~{bl:,.0f} gas/op")
    # refine budget context
    print(f"\nAt G_R full (5e9): ~{5_000_000_000/ed:,.0f} ed25519 verifies/refine")
    print(f"At G_R tiny (1e9): ~{1_000_000_000/ed:,.0f} ed25519 verifies/refine")

if __name__ == "__main__":
    main()
