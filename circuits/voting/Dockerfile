# voting-prover — the client-side proof generator as an HTTP sidecar.
#
# Wraps `voting serve`: GET /prove?voter=N&vote=B -> {submission_hex} (a real
# Groth16 anonymous-vote proof + nullifier + vote). The web app calls this per
# ballot, then POSTs the submission to the lasair node's /v1/service/<id>/item.
# (Server-side proving for the demo; wasm-in-browser is the true-client-side upgrade.)
#
# Build: docker build -t voting-prover circuits/voting
# Run:   docker run --rm -p 9090:9090 voting-prover

FROM rust:1-bookworm AS builder
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --bin voting

FROM debian:12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /build/target/release/voting /usr/local/bin/voting
EXPOSE 9090
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 \
  CMD curl -fsS http://localhost:9090/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/voting", "serve", "0.0.0.0:9090"]
