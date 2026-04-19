import math


def test_optimize_rect_kerf_trims_bevels():
    from app.src.corte_modulo.backend.optimizer import optimize_rect
    res = optimize_rect(
        10,
        10,
        [{"w": 5, "h": 5, "qty": 1}],
        kerf=1,
        trims={"left": 1, "right": 1, "top": 2, "bottom": 0},
        bevels={"left": 0.2, "right": 0.3, "top": 0.4, "bottom": 0.0},
    )
    assert res["effective_board"]["width"] == 8
    assert res["effective_board"]["height"] == 8
    assert len(res["placements"]) == 1
    p = res["placements"][0]
    assert p["x"] == 1 and p["y"] == 2
    assert p["w"] == 5 and p["h"] == 5
    # bevel info should be present on cuts where trims are applied
    bevels = [c.get("bevel", 0.0) for c in res["cuts"]]
    assert any(b > 0 for b in bevels)


def test_optimize_rect_utilization_bounds():
    from app.src.corte_modulo.backend.optimizer import optimize_rect
    res = optimize_rect(20, 10, [{"w": 5, "h": 5, "qty": 2}], kerf=0)
    util = float(res["utilization"])
    assert util >= 0.0 and util <= 1.0


def test_optimize_rect_multiple_pieces_qty():
    from app.src.corte_modulo.backend.optimizer import optimize_rect
    res = optimize_rect(20, 20, [{"w": 3, "h": 4, "qty": 3}], kerf=0)
    assert len(res["placements"]) == 3
    used = int(res["used_area"])
    assert used == 3 * 3 * 4


def test_cutting_planner_basic():
    from app.src.corte_modulo.backend.optimizer import CuttingPlanner
    planner = CuttingPlanner(30, 20, kerf=1)
    planner.add_piece(10, 5, qty=2)
    planner.add_piece(3, 3, qty=1)
    plan = planner.plan()
    assert "placements" in plan and "cuts" in plan and "effective_board" in plan
    assert isinstance(plan["placements"], list)
    assert isinstance(plan["cuts"], list)


def test_compute_retazos_conservation():
    from app.src.corte_modulo.backend.optimizer import compute_retazos
    eff_w, eff_h = 4, 3
    placements = [{"x": 0, "y": 0, "w": 2, "h": 2}]
    retazos = compute_retazos(eff_w, eff_h, placements)
    # Total area equals board area, partitioned into placements + retazos without overlaps
    area_placements = sum(p["w"] * p["h"] for p in placements)
    area_retazos = sum(r["w"] * r["h"] for r in retazos)
    assert area_placements + area_retazos == eff_w * eff_h
    # none of the retazos equals the placed rectangle
    assert all(
        (r["x"], r["y"], r["w"], r["h"]) != (placements[0]["x"], placements[0]["y"], placements[0]["w"], placements[0]["h"]) for r in retazos
    )

