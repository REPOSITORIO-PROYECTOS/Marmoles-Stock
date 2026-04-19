def test_optimize_rect_basic():
    from app.src.corte_modulo.backend.optimizer import optimize_rect
    res = optimize_rect(10, 10, [{"w": 3, "h": 3, "qty": 1}], kerf=0)
    assert res["used_area"] == 9
    assert len(res["placements"]) == 1

def test_optimize_rect_with_trims():
    from app.src.corte_modulo.backend.optimizer import optimize_rect
    res = optimize_rect(10, 10, [{"w": 3, "h": 3, "qty": 1}], kerf=0, trims={"left": 1, "right": 1, "top": 0, "bottom": 0})
    assert res["effective_board"]["width"] == 8
