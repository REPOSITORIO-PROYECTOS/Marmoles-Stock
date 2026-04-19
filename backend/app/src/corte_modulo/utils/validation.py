from typing import List, Dict, Optional

class Trims:
    left: int
    right: int
    top: int
    bottom: int

def _pos_int(x: int) -> bool:
    try:
        return int(x) >= 0
    except Exception:
        return False

def validate_board(width: int, height: int, kerf: int, trims: Optional[Dict[str, int]] = None) -> None:
    if not (_pos_int(width) and _pos_int(height) and _pos_int(kerf)):
        from .errors import ValidationError
        raise ValidationError("tablero inválido")
    if trims:
        for k in ("left", "right", "top", "bottom"):
            v = trims.get(k, 0)
            if not _pos_int(v):
                from .errors import ValidationError
                raise ValidationError("trims inválidos")

def validate_pieces(pieces: List[Dict[str, int]]) -> None:
    if not pieces:
        from .errors import ValidationError
        raise ValidationError("piezas vacías")
    for p in pieces:
        w = int(p.get("w", 0))
        h = int(p.get("h", 0))
        q = int(p.get("qty", 0))
        if w <= 0 or h <= 0 or q <= 0:
            from .errors import ValidationError
            raise ValidationError("pieza inválida")
