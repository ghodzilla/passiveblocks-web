"""Shadow-only baselines. They are never a taken trade."""

from __future__ import annotations

import random

from pb_engine.strategies.types import Candidate

PARAMS: dict[str, dict[str, float | int | str]] = {
    "random_entry": {"stop_pct": 0.01, "hold_hours": 1, "rng": "stdlib-mt"},
    "btc_hold_1x": {"market": "BTC", "stop_pct": 0.10, "hold_hours": 24},
}


def random_entry(price: float, *, market: str = "BTC", seed: int = 1) -> Candidate | None:
    if price <= 0:
        return None
    rng = random.Random(seed)
    side = "long" if rng.random() < 0.5 else "short"
    distance = float(PARAMS["random_entry"]["stop_pct"])
    if side == "long":
        stop = price * (1 - distance)
        target = price * (1 + distance)
    else:
        stop = price * (1 + distance)
        target = price * (1 - distance)
    return Candidate(
        strategy="random_entry",
        market=market,
        side=side,
        entry=price,
        stop=stop,
        target=target,
        pred_edge_r=0.0,
        hold_hours=float(PARAMS["random_entry"]["hold_hours"]),
        features={"seed": seed},
        baseline=True,
    )


def btc_hold_1x(price: float) -> Candidate | None:
    if price <= 0:
        return None
    distance = float(PARAMS["btc_hold_1x"]["stop_pct"])
    return Candidate(
        strategy="btc_hold_1x",
        market="BTC",
        side="long",
        entry=price,
        stop=price * (1 - distance),
        target=price * (1 + distance),
        pred_edge_r=0.0,
        hold_hours=float(PARAMS["btc_hold_1x"]["hold_hours"]),
        features={"baseline": "btc_hold_1x"},
        baseline=True,
    )
