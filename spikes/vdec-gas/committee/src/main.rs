//! Offchain committee sidecar. Simulates an n-member committee: keygen, encrypt one order
//! to the joint key, and produce each member's proven partial decryption. Emits the
//! vdec-service refine payload (honest + a tampered variant) as hex for the gas bench.
//!
//! Usage: gen-round <n>   -> prints two lines:  "honest <hex>"  and  "tampered <hex>"

use vdec_core::{keygen, joint_pk, encrypt, partial_decrypt, pack_committee, Member, POINT_LEN, PARTIAL_LEN};

fn build_payload(n: usize, tamper: bool) -> Vec<u8> {
    let members: Vec<Member> = (0..n).map(|i| keygen(&[i as u8, 42, 7])).collect();
    let pk_affines: Vec<_> = members.iter().map(|m| m.pk).collect();
    let joint = joint_pk(&pk_affines);

    // A realistic 17-byte jamswap order: account:u32 ‖ id:u32 ‖ side:u8 ‖ price:u32 ‖ qty:u32
    let order: [u8; 17] = [
        8, 0, 0, 0, // account
        1, 0, 0, 0, // id
        0, // side buy
        160, 134, 1, 0, // price 100000 (100.0000 * 1e4)
        80, 195, 0, 0, // qty 50000
    ];

    let (c1, body) = encrypt(&order, &joint, b"ephemeral-seed-for-this-order");
    let pks = pack_committee(&pk_affines);
    let mut partials = Vec::new();
    for (i, m) in members.iter().enumerate() {
        let p = partial_decrypt(&c1, m, &[i as u8, 99]).expect("partial");
        partials.extend_from_slice(&p);
    }
    if tamper {
        // flip a byte inside the first partial's z scalar -> proof must fail
        let z_off = POINT_LEN + POINT_LEN + 1; // S_i(32) + e(32) + 1
        partials[z_off] ^= 0x01;
    }

    let mut out = Vec::new();
    out.push(n as u8);
    out.extend_from_slice(&c1);
    out.push(order.len() as u8);
    out.extend_from_slice(&body);
    out.extend_from_slice(&pks);
    out.extend_from_slice(&partials);
    debug_assert_eq!(out.len(), 1 + POINT_LEN + 1 + order.len() + n * POINT_LEN + n * PARTIAL_LEN);
    out
}

fn hex(b: &[u8]) -> String {
    let mut s = String::with_capacity(b.len() * 2);
    for x in b {
        s.push_str(&format!("{:02x}", x));
    }
    s
}

fn main() {
    let n: usize = std::env::args().nth(1).and_then(|a| a.parse().ok()).unwrap_or(1);
    println!("honest {}", hex(&build_payload(n, false)));
    println!("tampered {}", hex(&build_payload(n, true)));
}
