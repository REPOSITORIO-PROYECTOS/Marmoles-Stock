from typing import Dict, List

def format_plan(material: Dict[str, object], res: Dict[str, object], piezas_origen: List[Dict[str, str]]) -> Dict[str, object]:
    return {
        "material": material,
        "used_area": res.get("used_area", 0),
        "utilization": res.get("utilization", 0),
        "placements": res.get("placements", []),
        "cuts": res.get("cuts", []),
        "effective_board": res.get("effective_board", {}),
        "piezas_origen": piezas_origen,
    }
