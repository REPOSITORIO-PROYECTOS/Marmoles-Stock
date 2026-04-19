from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
from typing import List, Dict, Any

def calcular_union_y_bbox(lista_primitivas: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calcula la unión de varias primitivas (rectángulos, triángulos) y devuelve 
    el contorno final y el bounding box mínimo que lo contiene.
    """
    polygons = []
    for prim in lista_primitivas:
        # Ignorar avisos o notas para el cálculo de geometría de corte
        if prim.get("tipo") == "notice":
            continue
            
        if "puntos" in prim and prim["puntos"]:
            # prim["puntos"] es una lista de [x, y]
            try:
                poly = Polygon(prim["puntos"])
                if poly.is_valid:
                    polygons.append(poly)
                else:
                    # Intentar reparar si es inválido (ej. puntos duplicados)
                    poly = poly.buffer(0)
                    if not poly.is_empty:
                        polygons.append(poly)
            except Exception as e:
                print(f"Error creando polígono para primitiva: {e}")
        elif "x" in prim and "y" in prim and "w" in prim and "h" in prim:
            # Fallback para rectángulos simples
            x, y, w, h = prim["x"], prim["y"], prim["w"], prim["h"]
            poly = Polygon([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])
            polygons.append(poly)
    
    if not polygons:
        return {
            "union_calculada": [],
            "bbox": {"x": 0, "y": 0, "w": 0, "h": 0},
            "area_m2": 0
        }
    
    union = unary_union(polygons)
    
    # Extraer puntos del contorno
    union_puntos = []
    if isinstance(union, Polygon):
        union_puntos = [list(p) for p in union.exterior.coords]
    elif isinstance(union, MultiPolygon):
        # Si hay varias islas, devolvemos una lista de listas de puntos
        for poly in union.geoms:
            union_puntos.append([list(p) for p in poly.exterior.coords])
            
    bbox = union.bounds # (minx, miny, maxx, maxy)
    
    return {
        "union_calculada": union_puntos,
        "bbox": {
            "x": bbox[0],
            "y": bbox[1],
            "w": bbox[2] - bbox[0],
            "h": bbox[3] - bbox[1]
        },
        "area_m2": union.area / 10000 # cm2 a m2
    }
