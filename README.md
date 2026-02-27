# Learning NestedMuSig2

Interactive educational website for the NestedMuSig2 protocol ([eprint 2026/223](https://eprint.iacr.org/2026/223) by Nadav Kohen, Chaincode Labs).

**[Live site](https://jesseposner.github.io/learning-nested-musig2/)**

## What this is

A step-by-step guide to nested multi-signatures on secp256k1, with an interactive playground for building cosigner trees and running the protocol.

The site assumes familiarity with Schnorr signatures, elliptic curve cryptography, and MuSig2.

## Features

- **7 narrative pages** walking through the protocol: cosigner tree structure, key aggregation, Round 1 nonce flow, Round 2 cascading coefficients, and verification
- **3 interactive demos** embedded in the narrative (key aggregation, Round 1, verification)
- **Interactive playground** for building custom cosigner trees, running each protocol phase step by step, and inspecting every intermediate value
- **Real cryptography** using `@noble/curves` on secp256k1, not toy numbers

## Running locally

```sh
npm install
npm run dev
```

## Tests

```sh
npm test
```

17 tests covering crypto primitives and tree operations.

## Stack

SvelteKit, Svelte Flow, GSAP, KaTeX, @noble/curves, Tailwind CSS v4, mdsvex.

## License

MIT
