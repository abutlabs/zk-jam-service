#!/usr/bin/env python3
"""E2E: verify a zk FBA-clearing proof in a lasair refine and measure the gas.

Proves the zk-rollup-matcher architecture: ONE Groth16 verify settles a whole batch
(order count doesn't change the cost), the chain sees only commitments + price + volume,
and a lie about the public settlement is rejected because the proof binds it.

Artifacts come from `cargo run --release` in circuit/ (writes artifacts/{submission,submission_bad}.bin)."""
import json, os, struct, urllib.request

RPC = os.environ.get("LASAIR_RPC", "http://127.0.0.1:19904")
JAM = os.environ["JAM"]
ART = os.environ["ART"]  # circuit/artifacts dir

def rpc(method, path, body=None):
    req = urllib.request.Request(RPC + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"content-type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read() or "null")

def submit(sid, blob):
    return rpc("POST", f"/v1/service/{sid}/item", {"payload_hex": blob.hex()})

def storage(sid, key):
    v = rpc("GET", f"/v1/service/{sid}/storage/{key.hex()}")
    if isinstance(v, dict): v = v.get("value_hex")
    return bytes.fromhex(v) if v else b""

def leu64(b): return struct.unpack("<Q", b.ljust(8, b"\0")[:8])[0] if b else 0

def main():
    sid = rpc("POST", "/v1/service", {"jam_hex": open(JAM, "rb").read().hex()})["service_id"]
    print(f"deployed fba-service sid={sid}\n")

    honest = open(os.path.join(ART, "submission.bin"), "rb").read()
    bad = open(os.path.join(ART, "submission_bad.bin"), "rb").read()

    r = submit(sid, honest)
    g = r["refine_gas"]; out = r["refine_output_hex"]
    ok = out.startswith("01")
    print(f"honest batch:   refine_gas={g:>11,}  out={out[:2]}… {'VALID' if ok else 'REJECTED'}"
          f"  ({g/5e9*100:.2f}% of G_R full)")
    assert ok, "honest clearing proof must verify in refine"

    rb = submit(sid, bad)
    okb = rb["refine_output_hex"].startswith("01")
    print(f"inflated volume: refine_gas={rb['refine_gas']:>11,}  out={rb['refine_output_hex']} "
          f"{'LEAK!' if okb else 'REJECTED'}  (same proof, lied public input)")
    assert not okb, "a lie about the settlement must be rejected"

    # settlement recorded on-chain by the honest batch (accumulate)
    print(f"\non-chain settlement: last_price={leu64(storage(sid, b'last_price'))} "
          f"last_volume={leu64(storage(sid, b'last_volume'))} "
          f"rounds={leu64(storage(sid, b'rounds'))} "
          f"batch_commit_len={len(storage(sid, b'last_batch'))}B (orders themselves never on-chain)")
    print("\nALL ASSERTIONS PASSED — zk FBA clearing verified in refine "
          "(one proof settles the batch; a lied settlement is rejected)")

if __name__ == "__main__":
    main()
