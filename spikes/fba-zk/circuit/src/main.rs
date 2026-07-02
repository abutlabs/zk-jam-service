// zk FBA-clearing circuit — prove a uniform-price batch auction cleared VALIDLY, in zero
// knowledge, so a JAM service can verify one Groth16 proof instead of running the match.
//
// Statement proven (fixed batch of N orders):
//   "I know N orders (side, price, qty) hashing to the public `orders_commitment`, and N
//    fills hashing to the public `fills_commitment`, such that at the public uniform price
//    p* every filled order is MARKETABLE (buys with price>=p*, sells with price<=p*), every
//    fill is within its order's qty, and total buy fills == total sell fills == public
//    `volume`."
// Public inputs: [orders_commitment, price, volume, fills_commitment].
//
// This is the SETTLEMENT-VALIDITY half of an FBA: it forbids fabricated fills, filling an
// unmarketable order, and violating base conservation — the properties that let a chain trust
// an off-chain matcher. It does NOT yet prove p* is volume-MAXIMIZING (the argmax/optimality
// property); that's the next circuit layer (documented in the README). The public sees only
// commitments + price + volume — never the individual orders (a dark-pool matcher).

use ark_bn254::{Bn254, Fr};
use ark_crypto_primitives::sponge::constraints::CryptographicSpongeVar;
use ark_crypto_primitives::sponge::poseidon::constraints::PoseidonSpongeVar;
use ark_crypto_primitives::sponge::poseidon::{find_poseidon_ark_and_mds, PoseidonConfig, PoseidonSponge};
use ark_crypto_primitives::sponge::CryptographicSponge;
use ark_ff::{One, Zero};
use ark_groth16::Groth16;
use ark_r1cs_std::{
    alloc::AllocVar, boolean::Boolean, eq::EqGadget, fields::fp::FpVar, fields::FieldVar,
    prelude::*,
};
use ark_relations::r1cs::{ConstraintSynthesizer, ConstraintSystem, ConstraintSystemRef, SynthesisError};
use ark_serialize::CanonicalSerialize;
use ark_snark::SNARK;
use ark_std::rand::SeedableRng;

const N: usize = 4; // batch size for the spike
const WIDTH: usize = 40; // bit width for price/qty/volume comparisons (2^40 ≈ 1.1e12)
const SCALE: u64 = 10_000; // display × SCALE, matching jamswap

// ---- Poseidon (BN254, rate 2, width 3), identical params to circuits/voting ----
fn poseidon_config() -> PoseidonConfig<Fr> {
    let (ark, mds) = find_poseidon_ark_and_mds::<Fr>(254, 2, 8, 57, 0);
    PoseidonConfig::new(8, 57, 5, mds, ark, 2, 1)
}
fn hash_native(cfg: &PoseidonConfig<Fr>, inputs: &[Fr]) -> Fr {
    let mut s = PoseidonSponge::new(cfg);
    s.absorb(&inputs.to_vec());
    s.squeeze_field_elements(1)[0]
}
fn hash_gadget(
    cfg: &PoseidonConfig<Fr>,
    cs: ConstraintSystemRef<Fr>,
    inputs: &[FpVar<Fr>],
) -> Result<FpVar<Fr>, SynthesisError> {
    let mut s = PoseidonSpongeVar::new(cs, cfg);
    s.absorb(&inputs.to_vec())?;
    Ok(s.squeeze_field_elements(1)?[0].clone())
}

// fixed-width little-endian bits of x, enforcing x < 2^width (range check).
fn bits_fixed(x: &FpVar<Fr>, width: usize) -> Result<Vec<Boolean<Fr>>, SynthesisError> {
    let bits = x.to_bits_le()?; // enforces Σ bit_i·2^i == x
    for b in &bits[width..] {
        b.enforce_equal(&Boolean::FALSE)?; // high bits zero => x < 2^width
    }
    Ok(bits[..width].to_vec())
}
// Boolean: a >= b, for a,b known to be < 2^WIDTH. t = a-b+2^WIDTH ∈ (0, 2^{WIDTH+1});
// the top (WIDTH-th) bit is 1 iff a-b >= 0.
fn ge(a: &FpVar<Fr>, b: &FpVar<Fr>) -> Result<Boolean<Fr>, SynthesisError> {
    let two_w = FpVar::constant(Fr::from(1u128 << WIDTH));
    let t = a - b + &two_w;
    let bits = bits_fixed(&t, WIDTH + 1)?;
    Ok(bits[WIDTH].clone())
}
// min(a, b) for bounded a,b, computed from the comparison (no extra witness).
fn min_var(a: &FpVar<Fr>, b: &FpVar<Fr>) -> Result<FpVar<Fr>, SynthesisError> {
    let a_le_b = ge(b, a)?; // b >= a  <=>  a is the min
    a_le_b.select(a, b)
}

#[derive(Clone)]
struct Order {
    is_sell: bool,
    price: u64,
    qty: u64,
    fill: u64,
}

#[derive(Clone)]
struct FbaCircuit {
    cfg: PoseidonConfig<Fr>,
    // public
    orders_commitment: Fr,
    price: Fr,
    volume: Fr,
    fills_commitment: Fr,
    // private
    orders: Vec<Order>,
}

impl ConstraintSynthesizer<Fr> for FbaCircuit {
    fn generate_constraints(self, cs: ConstraintSystemRef<Fr>) -> Result<(), SynthesisError> {
        let oc_v = FpVar::new_input(cs.clone(), || Ok(self.orders_commitment))?;
        let price_v = FpVar::new_input(cs.clone(), || Ok(self.price))?;
        let vol_v = FpVar::new_input(cs.clone(), || Ok(self.volume))?;
        let fc_v = FpVar::new_input(cs.clone(), || Ok(self.fills_commitment))?;

        // price p* itself must be a bounded value so the comparisons are sound.
        let _ = bits_fixed(&price_v, WIDTH)?;

        let mut order_hash_inputs: Vec<FpVar<Fr>> = Vec::with_capacity(3 * N);
        let mut fill_hash_inputs: Vec<FpVar<Fr>> = Vec::with_capacity(N);
        let mut buy_vol = FpVar::<Fr>::zero();
        let mut sell_vol = FpVar::<Fr>::zero();
        let one = FpVar::one();
        // keep per-order vars for the optimality pass
        let mut is_sell_fps: Vec<FpVar<Fr>> = Vec::with_capacity(N);
        let mut prices: Vec<FpVar<Fr>> = Vec::with_capacity(N);
        let mut qtys: Vec<FpVar<Fr>> = Vec::with_capacity(N);

        for o in &self.orders {
            let is_sell = Boolean::new_witness(cs.clone(), || Ok(o.is_sell))?;
            let price = FpVar::new_witness(cs.clone(), || Ok(Fr::from(o.price)))?;
            let qty = FpVar::new_witness(cs.clone(), || Ok(Fr::from(o.qty)))?;
            let fill = FpVar::new_witness(cs.clone(), || Ok(Fr::from(o.fill)))?;

            // range-bound price/qty/fill so comparisons are sound
            let _ = bits_fixed(&price, WIDTH)?;
            let _ = bits_fixed(&qty, WIDTH)?;
            let _ = bits_fixed(&fill, WIDTH)?;

            // fill <= qty
            ge(&qty, &fill)?.enforce_equal(&Boolean::TRUE)?;

            // marketability: buy needs price>=p*, sell needs price<=p* (i.e. p*>=price)
            let buy_ok = ge(&price, &price_v)?;
            let sell_ok = ge(&price_v, &price)?;
            let marketable = is_sell.select(&FpVar::from(sell_ok), &FpVar::from(buy_ok))?;
            // if NOT marketable, fill must be 0:  fill · (1 - marketable) == 0
            (&fill * (&one - &marketable)).enforce_equal(&FpVar::zero())?;

            // accumulate per-side matched volume (buy weight = 1 - is_sell)
            let is_sell_fp = FpVar::from(is_sell.clone());
            buy_vol += (&one - &is_sell_fp) * &fill;
            sell_vol += &is_sell_fp * &fill;

            // commitment inputs: side as field (0=buy,1=sell), price, qty
            order_hash_inputs.push(FpVar::from(is_sell));
            order_hash_inputs.push(price.clone());
            order_hash_inputs.push(qty.clone());
            fill_hash_inputs.push(fill);
            is_sell_fps.push(is_sell_fp);
            prices.push(price);
            qtys.push(qty);
        }

        // base conservation at the uniform price: buys bought == sells sold == volume.
        // Combined with marketability + fill<=qty this already gives volume <= V(p*) =
        // min(demand(p*), supply(p*)) — you can't fill more than is marketable at p*.
        buy_vol.enforce_equal(&vol_v)?;
        sell_vol.enforce_equal(&vol_v)?;

        // OPTIMALITY: p* achieves the MAXIMUM matchable volume. V(p) = min(demand(p),
        // supply(p)) changes value only at order limit prices, so its global max over all
        // prices equals its max over the order prices. We enforce volume >= V(p_j) for every
        // order price p_j; with volume <= V(p*) above, this forces volume == max_p V(p), i.e.
        // p* is volume-maximizing (a matcher cannot under-fill to favour anyone).
        for j in 0..N {
            let pj = &prices[j];
            let mut demand = FpVar::<Fr>::zero(); // Σ buy qty with price_i >= pj
            let mut supply = FpVar::<Fr>::zero(); // Σ sell qty with price_i <= pj
            for i in 0..N {
                let buy_here = ge(&prices[i], pj)?; // price_i >= pj
                let sell_here = ge(pj, &prices[i])?; // price_i <= pj
                let is_buy = &one - &is_sell_fps[i];
                demand += &is_buy * &qtys[i] * FpVar::from(buy_here);
                supply += &is_sell_fps[i] * &qtys[i] * FpVar::from(sell_here);
            }
            let v_pj = min_var(&demand, &supply)?;
            // achieved volume must be at least the matchable volume at this candidate price
            ge(&vol_v, &v_pj)?.enforce_equal(&Boolean::TRUE)?;
        }

        // binding: the private orders & fills hash to the public commitments
        hash_gadget(&self.cfg, cs.clone(), &order_hash_inputs)?.enforce_equal(&oc_v)?;
        hash_gadget(&self.cfg, cs.clone(), &fill_hash_inputs)?.enforce_equal(&fc_v)?;
        Ok(())
    }
}

// ---- host: sample batch + honest clearing --------------------------------------------------
fn sample_orders() -> (Vec<Order>, u64, u64) {
    // buy 5@105, buy 5@100, sell 8@100, sell 2@110.  p* = 100.
    // marketable at 100: both buys (>=100), the 100-sell (<=100); the 110-sell is NOT.
    // sell supply = 8, buy demand = 10 -> matched = 8. Fills: sell#2=8; buys greedy 5 then 3.
    let s = SCALE;
    let orders = vec![
        Order { is_sell: false, price: 105 * s, qty: 5 * s, fill: 5 * s },
        Order { is_sell: false, price: 100 * s, qty: 5 * s, fill: 3 * s },
        Order { is_sell: true, price: 100 * s, qty: 8 * s, fill: 8 * s },
        Order { is_sell: true, price: 110 * s, qty: 2 * s, fill: 0 },
    ];
    (orders, 100 * s, 8 * s) // (orders, price p*, volume)
}

fn commit_orders(cfg: &PoseidonConfig<Fr>, orders: &[Order]) -> Fr {
    let mut v = Vec::with_capacity(3 * orders.len());
    for o in orders {
        v.push(if o.is_sell { Fr::one() } else { Fr::zero() });
        v.push(Fr::from(o.price));
        v.push(Fr::from(o.qty));
    }
    hash_native(cfg, &v)
}
fn commit_fills(cfg: &PoseidonConfig<Fr>, orders: &[Order]) -> Fr {
    let v: Vec<Fr> = orders.iter().map(|o| Fr::from(o.fill)).collect();
    hash_native(cfg, &v)
}

fn ser(x: &dyn Fn(&mut Vec<u8>)) -> Vec<u8> {
    let mut b = Vec::new();
    x(&mut b);
    b
}

fn main() {
    let cfg = poseidon_config();
    let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(7);
    let (orders, price, volume) = sample_orders();
    let oc = commit_orders(&cfg, &orders);
    let fc = commit_fills(&cfg, &orders);

    let circuit = FbaCircuit {
        cfg: cfg.clone(),
        orders_commitment: oc,
        price: Fr::from(price),
        volume: Fr::from(volume),
        fills_commitment: fc,
        orders: orders.clone(),
    };

    let (pk, vk) = Groth16::<Bn254>::circuit_specific_setup(circuit.clone(), &mut rng).unwrap();
    let proof = Groth16::<Bn254>::prove(&pk, circuit, &mut rng).unwrap();
    let public = vec![oc, Fr::from(price), Fr::from(volume), fc];
    let ok = Groth16::<Bn254>::verify(&vk, &public, &proof).unwrap();
    println!("valid clearing proof verifies: {ok}");
    assert!(ok, "honest clearing must verify");

    // a lie: claim a bigger volume than the fills support -> must fail
    let bad = Groth16::<Bn254>::verify(
        &vk,
        &vec![oc, Fr::from(price), Fr::from(volume + SCALE), fc],
        &proof,
    )
    .unwrap();
    println!("inflated-volume proof verifies: {bad} (must be false)");
    assert!(!bad);

    // OPTIMALITY check (via direct constraint-satisfaction, the ground truth the SNARK enforces):
    // the honest clearing satisfies the circuit; a SUBOPTIMAL clearing does NOT. At p*=105 only
    // the 105-buy (5) crosses the 100-sell, so volume would be 5 — but V(100)=8 is achievable, so
    // the optimality constraint (volume >= V(100)) is violated and the witness is unsatisfiable.
    let satisfied = |c: FbaCircuit| -> bool {
        let cs = ConstraintSystem::<Fr>::new_ref();
        c.generate_constraints(cs.clone()).unwrap();
        cs.is_satisfied().unwrap()
    };
    let honest = FbaCircuit {
        cfg: cfg.clone(), orders_commitment: oc, price: Fr::from(price),
        volume: Fr::from(volume), fills_commitment: fc, orders: orders.clone(),
    };
    assert!(satisfied(honest), "honest optimal clearing must satisfy the circuit");
    let s = SCALE;
    let subopt = vec![
        Order { is_sell: false, price: 105 * s, qty: 5 * s, fill: 5 * s },
        Order { is_sell: false, price: 100 * s, qty: 5 * s, fill: 0 },
        Order { is_sell: true, price: 100 * s, qty: 8 * s, fill: 5 * s },
        Order { is_sell: true, price: 110 * s, qty: 2 * s, fill: 0 },
    ];
    let sub_circuit = FbaCircuit {
        cfg: cfg.clone(),
        orders_commitment: commit_orders(&cfg, &subopt),
        price: Fr::from(105 * s),
        volume: Fr::from(5 * s),
        fills_commitment: commit_fills(&cfg, &subopt),
        orders: subopt,
    };
    assert!(!satisfied(sub_circuit),
        "suboptimal clearing (p*=105, vol=5) must be UNSATISFIABLE — optimality not enforced!");
    println!("optimality enforced: honest clearing satisfies; suboptimal (p*=105,vol=5) is UNSATISFIABLE ✓");

    // artifacts for the no_std service: embed vk; submit proof ++ [oc, price, volume, fc].
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("artifacts");
    std::fs::create_dir_all(&dir).unwrap();
    let vk_b = ser(&|b| vk.serialize_compressed(&mut *b).unwrap());
    std::fs::write(dir.join("vk.bin"), &vk_b).unwrap();
    let mut sub = Vec::new();
    proof.serialize_compressed(&mut sub).unwrap();
    for f in [oc, Fr::from(price), Fr::from(volume), fc] {
        f.serialize_compressed(&mut sub).unwrap();
    }
    std::fs::write(dir.join("submission.bin"), &sub).unwrap();
    // a tampered submission: inflate the public volume (proof unchanged) -> service must reject
    let mut bad_sub = Vec::new();
    proof.serialize_compressed(&mut bad_sub).unwrap();
    for f in [oc, Fr::from(price), Fr::from(volume + SCALE), fc] {
        f.serialize_compressed(&mut bad_sub).unwrap();
    }
    std::fs::write(dir.join("submission_bad.bin"), &bad_sub).unwrap();

    println!(
        "artifacts: vk={}B submission={}B (proof128 + 4×32 publics) -> artifacts/",
        vk_b.len(),
        sub.len()
    );
    println!("OK N={N} price={} volume={} (display {}/{})", price, volume, price / SCALE, volume / SCALE);
}
