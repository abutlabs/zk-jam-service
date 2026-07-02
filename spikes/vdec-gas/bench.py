#!/usr/bin/env python3
"""Measure refine gas for verifiable committee decryption on lasair, and prove soundness
e2e: an honest round decrypts (output 01||order); a tampered proof is rejected (output 00).

Per-order cost scales with committee size n (one Chaum-Pedersen verify per member). We
report per-n gas and the per-member marginal cost."""
import json, os, subprocess, urllib.request

RPC = os.environ.get("LASAIR_RPC", "http://127.0.0.1:19902")
GEN = os.environ["GEN"]  # path to the committee gen-round binary
JAM = os.environ["JAM"]  # path to vdec-service.jam
ORDER_HEX = "080000000100000000a0860100050c30000"[:34]  # 17-byte order (informational)

def rpc(method, path, body=None):
    req = urllib.request.Request(RPC + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"content-type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read() or "null")

def gen(n):
    out = subprocess.run([GEN, str(n)], capture_output=True, text=True, check=True).stdout
    d = {}
    for line in out.strip().splitlines():
        k, v = line.split()
        d[k] = v
    return d["honest"], d["tampered"]

def run(sid, payload_hex):
    r = rpc("POST", f"/v1/service/{sid}/item", {"payload_hex": payload_hex})
    return r["refine_gas"], r["refine_output_hex"], r.get("verdict")

def main():
    sid = rpc("POST", "/v1/service", {"jam_hex": open(JAM, "rb").read().hex()})["service_id"]
    print(f"deployed vdec-service sid={sid}\n")
    prev = None
    for n in (1, 2, 3, 5):
        honest, tampered = gen(n)
        g, out, v = run(sid, honest)
        gt, outt, vt = run(sid, tampered)
        # honest output must be 01 || 17-byte order; tampered must be 00
        ok_honest = out.startswith("01") and len(out) == 2 + 17 * 2
        ok_tamper = outt == "00"
        marg = f"  (+{g-prev:,} vs n-1)" if prev is not None else ""
        print(f"n={n}: honest refine_gas={g:>11,}  out={out[:6]}… {'OK' if ok_honest else 'BAD'}"
              f" | tampered gas={gt:>11,} out={outt} {'REJECTED' if ok_tamper else 'LEAK!'}{marg}")
        assert ok_honest, f"n={n} honest round must decrypt"
        assert ok_tamper, f"n={n} tampered round must be rejected"
        prev = g
    print("\nALL SOUNDNESS ASSERTIONS PASSED (honest decrypts, tampered rejected, e2e on lasair)")

if __name__ == "__main__":
    main()
