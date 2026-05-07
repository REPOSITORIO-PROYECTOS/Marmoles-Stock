def test_validate_board_ok():
    from app.src.corte_modulo.utils.validation import validate_board
    validate_board(10, 10, 0, {"left": 0, "right": 0, "top": 0, "bottom": 0})

def test_validate_board_bad():
    from app.src.corte_modulo.utils.validation import validate_board
    from app.src.corte_modulo.utils.errors import ValidationError
    try:
        validate_board(-1, 10, 0)
        assert False
    except ValidationError:
        assert True

def test_validate_pieces():
    from app.src.corte_modulo.utils.validation import validate_pieces
    validate_pieces([{ "w": 1, "h": 1, "qty": 1 }])
