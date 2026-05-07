from typing import List, Tuple

class View2D:
    def __init__(self):
        self.scale = 1.0
        self.offset = (0.0, 0.0)

    def zoom(self, factor: float) -> None:
        self.scale *= float(factor)

    def pan(self, dx: float, dy: float) -> None:
        ox, oy = self.offset
        self.offset = (ox + dx, oy + dy)

    def apply(self, pts: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        out = []
        for x, y in pts:
            out.append((x * self.scale + self.offset[0], y * self.scale + self.offset[1]))
        return out

class View3D:
    def __init__(self):
        self.zoom_factor = 1.0
        self.pan_offset = (0.0, 0.0, 0.0)

    def zoom(self, factor: float) -> None:
        self.zoom_factor *= float(factor)

    def pan(self, dx: float, dy: float, dz: float) -> None:
        ox, oy, oz = self.pan_offset
        self.pan_offset = (ox + dx, oy + dy, oz + dz)

class ViewToggle:
    def __init__(self):
        self.mode = "3D"

    def toggle(self) -> str:
        self.mode = "2D" if self.mode == "3D" else "3D"
        return self.mode
