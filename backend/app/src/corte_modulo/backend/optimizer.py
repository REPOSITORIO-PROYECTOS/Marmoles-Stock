from dataclasses import dataclass
from typing import Dict, List, Tuple
try:
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
except ImportError:
    Polygon = None
    unary_union = None

@dataclass
class Placement:
    x: int
    y: int
    w: int
    h: int

@dataclass
class Cut:
    orientation: str
    x0: int
    y0: int
    x1: int
    y1: int
    bevel: float = 0.0

def _counts_key(counts: Dict[Tuple[int, int], int]) -> Tuple[Tuple[Tuple[int, int], int], ...]:
    return tuple(sorted(((k, v) for k, v in counts.items() if v > 0)))

def _dec_counts(counts: Dict[Tuple[int, int], int], placements: List[Placement]) -> Dict[Tuple[int, int], int]:
    new_counts = dict(counts)
    for p in placements:
        a, b = (p.w, p.h) if p.w <= p.h else (p.h, p.w)
        if new_counts.get((a, b), 0) > 0:
            new_counts[(a, b)] -= 1
    return new_counts

def _pack(W: int, H: int, counts: Dict[Tuple[int, int], int], memo: Dict[Tuple[int, int, Tuple[Tuple[Tuple[int, int], int], ...]], Tuple[int, List[Placement], List[Cut]]], kerf: int = 0) -> Tuple[int, List[Placement], List[Cut]]:
    if W <= 0 or H <= 0:
        return 0, [], []
    key = (W, H, _counts_key(counts))
    if key in memo:
        return memo[key]
    best_area = 0
    best_places: List[Placement] = []
    best_cuts: List[Cut] = []
    items = sorted(list(counts.items()), key=lambda kv: (kv[0][0] * kv[0][1]), reverse=True)
    for (a, b), qty in items:
        if qty <= 0:
            continue
        for w, h in ((a, b), (b, a)):
            if w == h and (w, h) != (a, b):
                continue
            if w > W or h > H:
                continue
            counts[(a, b)] -= 1
            area_piece = w * h
            right1_W, right1_H = max(0, W - w - kerf), H
            bottom1_W, bottom1_H = w, max(0, H - h - kerf)
            area_right1, places_right1, cuts_right1 = _pack(right1_W, right1_H, counts, memo, kerf)
            post_right_counts = _dec_counts(counts, places_right1)
            area_bottom1, places_bottom1, cuts_bottom1 = _pack(bottom1_W, bottom1_H, post_right_counts, memo, kerf)
            total1_order1 = area_piece + area_right1 + area_bottom1
            area_bottom1a, places_bottom1a, cuts_bottom1a = _pack(bottom1_W, bottom1_H, counts, memo, kerf)
            post_bottom_counts = _dec_counts(counts, places_bottom1a)
            area_right1a, places_right1a, cuts_right1a = _pack(right1_W, right1_H, post_bottom_counts, memo, kerf)
            total1_order2 = area_piece + area_bottom1a + area_right1a
            if total1_order1 >= total1_order2:
                total1 = total1_order1
                placed = [Placement(0, 0, w, h)]
                adj_right1 = [Placement(p.x + w, p.y + 0, p.w, p.h) for p in places_right1]
                adj_bottom1 = [Placement(p.x + 0, p.y + h, p.w, p.h) for p in places_bottom1]
                cand_places1 = placed + adj_right1 + adj_bottom1
                cuts1 = [Cut('V', w, 0, w, H), Cut('H', 0, h, w, h)]
                cuts1 += [Cut(c.orientation, c.x0 + w, c.y0 + 0, c.x1 + w, c.y1 + 0) for c in cuts_right1]
                cuts1 += [Cut(c.orientation, c.x0 + 0, c.y0 + h, c.x1 + 0, c.y1 + h) for c in cuts_bottom1]
            else:
                total1 = total1_order2
                placed = [Placement(0, 0, w, h)]
                adj_bottom1a = [Placement(p.x + 0, p.y + h, p.w, p.h) for p in places_bottom1a]
                adj_right1a = [Placement(p.x + w, p.y + 0, p.w, p.h) for p in places_right1a]
                cand_places1 = placed + adj_bottom1a + adj_right1a
                cuts1 = [Cut('V', w, 0, w, H), Cut('H', 0, h, w, h)]
                cuts1 += [Cut(c.orientation, c.x0 + 0, c.y0 + h, c.x1 + 0, c.y1 + h) for c in cuts_bottom1a]
                cuts1 += [Cut(c.orientation, c.x0 + w, c.y0 + 0, c.x1 + w, c.y1 + 0) for c in cuts_right1a]
            if total1 > best_area:
                best_area = total1
                best_places = cand_places1
                best_cuts = cuts1
            right2_W, right2_H = max(0, W - w - kerf), h
            bottom2_W, bottom2_H = W, max(0, H - h - kerf)
            area_right2, places_right2, cuts_right2 = _pack(right2_W, right2_H, counts, memo, kerf)
            post_right_counts2 = _dec_counts(counts, places_right2)
            area_bottom2, places_bottom2, cuts_bottom2 = _pack(bottom2_W, bottom2_H, post_right_counts2, memo, kerf)
            total2_order1 = area_piece + area_right2 + area_bottom2
            area_bottom2a, places_bottom2a, cuts_bottom2a = _pack(bottom2_W, bottom2_H, counts, memo, kerf)
            post_bottom_counts2 = _dec_counts(counts, places_bottom2a)
            area_right2a, places_right2a, cuts_right2a = _pack(right2_W, right2_H, post_bottom_counts2, memo, kerf)
            total2_order2 = area_piece + area_bottom2a + area_right2a
            if total2_order1 >= total2_order2:
                total2 = total2_order1
                placed = [Placement(0, 0, w, h)]
                adj_right2 = [Placement(p.x + w, p.y + 0, p.w, p.h) for p in places_right2]
                adj_bottom2 = [Placement(p.x + 0, p.y + h, p.w, p.h) for p in places_bottom2]
                cand_places2 = placed + adj_right2 + adj_bottom2
                cuts2 = [Cut('H', 0, h, W, h), Cut('V', w, 0, w, h)]
                cuts2 += [Cut(c.orientation, c.x0 + w, c.y0 + 0, c.x1 + w, c.y1 + 0) for c in cuts_right2]
                cuts2 += [Cut(c.orientation, c.x0 + 0, c.y0 + h, c.x1 + 0, c.y1 + h) for c in cuts_bottom2]
            else:
                total2 = total2_order2
                placed = [Placement(0, 0, w, h)]
                adj_bottom2a = [Placement(p.x + 0, p.y + h, p.w, p.h) for p in places_bottom2a]
                adj_right2a = [Placement(p.x + w, p.y + 0, p.w, p.h) for p in places_right2a]
                cand_places2 = placed + adj_bottom2a + adj_right2a
                cuts2 = [Cut('H', 0, h, W, h), Cut('V', w, 0, w, h)]
                cuts2 += [Cut(c.orientation, c.x0 + 0, c.y0 + h, c.x1 + 0, c.y1 + h) for c in cuts_bottom2a]
                cuts2 += [Cut(c.orientation, c.x0 + w, c.y0 + 0, c.x1 + w, c.y1 + 0) for c in cuts_right2a]
            if total2 > best_area:
                best_area = total2
                best_places = cand_places2
                best_cuts = cuts2
            counts[(a, b)] += 1
    memo[key] = (best_area, best_places, best_cuts)
    return memo[key]

def _normalize_pieces(pieces: List[Dict[str, int]]) -> Dict[Tuple[int, int], int]:
    counts: Dict[Tuple[int, int], int] = {}
    for item in pieces:
        w = int(item["w"]) if "w" in item else int(item["width"]) if "width" in item else 0
        h = int(item["h"]) if "h" in item else int(item["height"]) if "height" in item else 0
        q = int(item["qty"]) if "qty" in item else int(item["quantity"]) if "quantity" in item else 1
        a, b = (w, h) if w <= h else (h, w)
        counts[(a, b)] = counts.get((a, b), 0) + q
    return counts

def optimize_square(side: int, pieces: List[Dict[str, int]], kerf: int = 0) -> Dict[str, object]:
    counts = _normalize_pieces(pieces)
    memo: Dict[Tuple[int, int, Tuple[Tuple[Tuple[int, int], int], ...]], Tuple[int, List[Placement], List[Cut]]] = {}
    used_area, placements, cuts = _pack(side, side, counts, memo, kerf)
    utilization = used_area / float(side * side) if side > 0 else 0.0
    return {
        "used_area": used_area,
        "utilization": utilization,
        "placements": [{"x": p.x, "y": p.y, "w": p.w, "h": p.h} for p in placements],
        "cuts": [{"orientation": c.orientation, "x0": c.x0, "y0": c.y0, "x1": c.x1, "y1": c.y1} for c in cuts],
    }

def optimize_rect(width: int, height: int, pieces: List[Dict[str, int]], kerf: int = 0, trims: Dict[str, int] | None = None, bevels: Dict[str, float] | None = None) -> Dict[str, object]:
    trims = trims or {"left": 0, "right": 0, "top": 0, "bottom": 0}
    bevels = bevels or {"left": 0.0, "right": 0.0, "top": 0.0, "bottom": 0.0}
    eff_w = max(0, int(width) - int(trims["left"]) - int(trims["right"]))
    eff_h = max(0, int(height) - int(trims["top"]) - int(trims["bottom"]))
    counts = _normalize_pieces(pieces)
    memo: Dict[Tuple[int, int, Tuple[Tuple[Tuple[int, int], int], ...]], Tuple[int, List[Placement], List[Cut]]] = {}
    used_area, placements, inner_cuts = _pack(eff_w, eff_h, counts, memo, kerf)
    utilization = used_area / float(max(1, eff_w * eff_h)) if eff_w > 0 and eff_h > 0 else 0.0
    cuts: List[Cut] = []
    if trims["left"] > 0:
        cuts.append(Cut('V', trims["left"], 0, trims["left"], eff_h, bevel=bevels.get("left", 0.0)))
    if trims["right"] > 0:
        x = trims["left"] + eff_w
        cuts.append(Cut('V', x, 0, x, eff_h, bevel=bevels.get("right", 0.0)))
    if trims["top"] > 0:
        cuts.append(Cut('H', 0, trims["top"], eff_w, trims["top"], bevel=bevels.get("top", 0.0)))
    if trims["bottom"] > 0:
        y = trims["top"] + eff_h
        cuts.append(Cut('H', 0, y, eff_w, y, bevel=bevels.get("bottom", 0.0)))
    cuts += [Cut(c.orientation, c.x0 + trims["left"], c.y0 + trims["top"], c.x1 + trims["left"], c.y1 + trims["top"]) for c in inner_cuts]
    return {
        "used_area": used_area,
        "utilization": utilization,
        "placements": [{"x": p.x + trims["left"], "y": p.y + trims["top"], "w": p.w, "h": p.h} for p in placements],
        "cuts": [{"orientation": c.orientation, "x0": c.x0, "y0": c.y0, "x1": c.x1, "y1": c.y1, "bevel": c.bevel} for c in cuts],
        "effective_board": {"width": eff_w, "height": eff_h},
    }

class CuttingPlanner:
    def __init__(self, width: int, height: int, kerf: int = 0, trims: Dict[str, int] | None = None, bevels: Dict[str, float] | None = None):
        self.width = int(width)
        self.height = int(height)
        self.kerf = int(kerf)
        self.trims = trims or {"left": 0, "right": 0, "top": 0, "bottom": 0}
        self.bevels = bevels or {"left": 0.0, "right": 0.0, "top": 0.0, "bottom": 0.0}
        self.counts: Dict[Tuple[int, int], int] = {}

    def add_piece(self, w: int, h: int, qty: int = 1) -> None:
        a, b = (int(w), int(h))
        a, b = (a, b) if a <= b else (b, a)
        self.counts[(a, b)] = self.counts.get((a, b), 0) + int(qty)

    def plan(self) -> Dict[str, object]:
        memo: Dict[Tuple[int, int, Tuple[Tuple[Tuple[int, int], int], ...]], Tuple[int, List[Placement], List[Cut]]] = {}
        res = optimize_rect(self.width, self.height, [{"w": k[0], "h": k[1], "qty": v} for k, v in self.counts.items()], kerf=self.kerf, trims=self.trims, bevels=self.bevels)
        return res

def compute_retazos(eff_w: int, eff_h: int, placements: List[Dict[str, int]]) -> List[Dict[str, int]]:
    xs = {0, eff_w}
    ys = {0, eff_h}
    for p in placements:
        xs.add(int(p["x"]))
        xs.add(int(p["x"]) + int(p["w"]))
        ys.add(int(p["y"]))
        ys.add(int(p["y"]) + int(p["h"]))
    xlist = sorted(xs)
    ylist = sorted(ys)
    retazos: List[Dict[str, int]] = []
    covered = {(int(p["x"]), int(p["y"]), int(p["w"]), int(p["h"])) for p in placements}
    for i in range(len(xlist) - 1):
        for j in range(len(ylist) - 1):
            rx = xlist[i]
            ry = ylist[j]
            rw = xlist[i + 1] - xlist[i]
            rh = ylist[j + 1] - ylist[j]
            if rw <= 0 or rh <= 0:
                continue
            if (rx, ry, rw, rh) in covered:
                continue
            retazos.append({"x": rx, "y": ry, "w": rw, "h": rh})
    return retazos

def calcular_union_y_bbox(primitives: List[Dict]) -> Tuple[Dict, Tuple[float, float, float, float], float]:
    """
    Calcula la unión de varias primitivas (rectángulos y triángulos) y devuelve:
    1. El polígono unión como una lista de puntos (geojson-like).
    2. El bounding box (minx, miny, maxx, maxy).
    3. El área total de la unión.
    """
    if Polygon is None or unary_union is None:
        # Fallback simple si no hay Shapely
        total_area = 0
        min_x = min_y = float('inf')
        max_x = max_y = float('-inf')
        for p in primitives:
            x, y, w, h = p["x"], p["y"], p["w"], p["h"]
            total_area += (w * h) if p.get("tipo") != "tri" else (w * h / 2)
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x + w)
            max_y = max(max_y, y + h)
        if total_area == 0: return {}, (0, 0, 0, 0), 0.0
        return {"tipo": "Rect", "coords": [[min_x, min_y], [max_x, min_y], [max_x, max_y], [min_x, max_y]]}, (min_x, min_y, max_x, max_y), total_area

    poligonos = []
    for p in primitives:
        if p.get("tipo") == "cut": continue # Ignorar huecos para la union de la pieza
        if "puntos" in p and p["puntos"]:
            poligonos.append(Polygon(p["puntos"]))
        else:
            x, y, w, h = p["x"], p["y"], p["w"], p["h"]
            poligonos.append(Polygon([(x, y), (x + w, y), (x + w, y + h), (x, y + h)]))
    
    if not poligonos:
        return {}, (0, 0, 0, 0), 0.0
        
    union = unary_union(poligonos)
    bbox = union.bounds # (minx, miny, maxx, maxy)
    area = union.area
    
    if union.geom_type == 'Polygon':
        coords = list(union.exterior.coords)
    elif union.geom_type == 'MultiPolygon':
        coords = [list(poly.exterior.coords) for poly in union.geoms]
    else:
        coords = []
        
    return {"tipo": union.geom_type, "coords": coords}, bbox, area
