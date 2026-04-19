"""
Motor de geometría de corte para cálculo automático de remanentes.

Usa Shapely para operaciones geométricas precisas en ortogonal (sin diagonales v1.0).

Invariante crítica:
  Área plancha original = Área pieza principal + Σ(Área remanentes) + Desperdicio disco corte
"""

from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class TipoCorte(Enum):
    """Tipos de corte soportados en v1.0 (solo ortogonales)"""
    ORTOGONAL_HORIZONTAL = "horizontal"  # Línea paralela a eje Y
    ORTOGONAL_VERTICAL = "vertical"      # Línea paralela a eje X


@dataclass
class Punto:
    """Punto en milímetros (mm)"""
    x: float  # mm
    y: float  # mm


@dataclass
class Rectangulo:
    """Rectángulo con coordenadas en mm (origin en esquina inferior izquierda)"""
    ancho: float    # mm
    alto: float     # mm
    origen_x: float = 0.0  # mm
    origen_y: float = 0.0  # mm

    def to_shapely(self) -> Polygon:
        """Convierte a polígono Shapely para cálculos geométricos"""
        return box(
            self.origen_x, self.origen_y,
            self.origen_x + self.ancho, self.origen_y + self.alto,
            ccw=True
        )

    def area_mm2(self) -> float:
        """Retorna área en mm²"""
        return self.ancho * self.alto


@dataclass
class LineaDeCorte:
    """Línea de corte ortogonal (recta, sin diagonales)"""
    tipo: TipoCorte
    posicion: float     # mm (coordenada X si vertical, Y si horizontal)
    espesor_disco: float = 3.2  # mm (espesor típico disco diamante)

    def validar(self, plancha: Rectangulo) -> bool:
        """Verifica que la línea esté dentro de los límites de la plancha"""
        if self.tipo == TipoCorte.ORTOGONAL_VERTICAL:
            return plancha.origen_x < self.posicion < (plancha.origen_x + plancha.ancho)
        else:  # HORIZONTAL
            return plancha.origen_y < self.posicion < (plancha.origen_y + plancha.alto)


@dataclass
class ResultadoCorte:
    """Resultado de un proceso de corte"""
    pieza_principal: Rectangulo  # Pieza que el operario quería
    remanentes: List[Rectangulo]  # Sobrantes
    area_principal_mm2: float
    area_remanentes_mm2: float
    area_desperdicio_mm2: float  # Por espesor disco
    area_original_mm2: float
    invariante_valida: bool  # True si suma cuadra
    error_invariante_mm2: float  # Diferencia, debe ser ~0
    lineas_aplicadas: List[LineaDeCorte]


class MotorGeometriaCorte:
    """Motor de cálculos geométricos para cortes de planchas"""

    # Tolerancia de error por redondeo y pérdida de precisión (mm²)
    TOLERANCIA_INVARIANTE_MM2 = 1.0

    @staticmethod
    def procesar_corte_acumulado(
        ancho_mm: float,
        alto_mm: float,
        lineas: List[LineaDeCorte],
        pieza_principal_bounds: Tuple[float, float, float, float]
    ) -> ResultadoCorte:
        """
        Calcula el resultado de aplicar líneas de corte ortogonales a un acumulado.

        Args:
            ancho_mm: Ancho de la plancha en mm
            alto_mm: Alto de la plancha en mm
            lineas: Lista de líneas de corte (ortogonales, sin diagonales)
            pieza_principal_bounds: (min_x, min_y, max_x, max_y) en mm de la pieza deseada

        Returns:
            ResultadoCorte con piezas, remanentes, áreas, e invariante validada

        Lógica:
            1. Convierte plancha a polígono Shapely
            2. Aplica cada línea de corte (resta de áreas)
            3. Intersecta resultado con bounding box de pieza principal
            4. Calcula remanentes (área no usada)
            5. Valida invariante de masa
        """

        # Crear rectángulo de plancha
        plancha = Rectangulo(ancho=ancho_mm, alto=alto_mm)

        # Validar líneas dentro de límites
        for linea in lineas:
            if not linea.validar(plancha):
                raise ValueError(f"Línea de corte fuera de límites: {linea}")

        # Geometría Shapely
        plancha_poly = plancha.to_shapely()
        pieza_principal_poly = box(*pieza_principal_bounds)

        # Cálculo de desperdicio por espesor disco
        espesor_total = sum(l.espesor_disco for l in lineas)
        area_desperdicio = espesor_total * (ancho_mm + alto_mm)  # Aproximación

        # Resta las líneas de corte (cada línea consume área por su espesor)
        area_reservada = plancha_poly
        for linea in lineas:
            if linea.tipo == TipoCorte.ORTOGONAL_VERTICAL:
                buffer_rect = box(
                    linea.posicion - linea.espesor_disco / 2, 0,
                    linea.posicion + linea.espesor_disco / 2, alto_mm
                )
            else:  # HORIZONTAL
                buffer_rect = box(
                    0, linea.posicion - linea.espesor_disco / 2,
                    ancho_mm, linea.posicion + linea.espesor_disco / 2
                )
            area_reservada = area_reservada.difference(buffer_rect)

        # Interseca con la pieza principal deseada
        pieza_principal_final = area_reservada.intersection(pieza_principal_poly)

        # Remanentes = área reservada - pieza principal
        remanentes_geom = area_reservada.difference(pieza_principal_final)

        # Extrae geometrías de remanentes (pueden ser múltiples polígonos)
        remanentes_rects = MotorGeometriaCorte._extraer_rectangulos(remanentes_geom)

        # Conversión de pieza principal a Rectangulo
        bounds = pieza_principal_final.bounds
        pieza_principal = Rectangulo(
            ancho=bounds[2] - bounds[0],
            alto=bounds[3] - bounds[1],
            origen_x=bounds[0],
            origen_y=bounds[1]
        )

        # Cálculo de áreas
        area_principal = pieza_principal_final.area
        area_remanentes = remanentes_geom.area

        # Validar invariante: suma debe igualar original
        suma_areas = area_principal + area_remanentes + area_desperdicio
        error = abs(suma_areas - plancha_poly.area)
        invariante_valida = error <= MotorGeometriaCorte.TOLERANCIA_INVARIANTE_MM2

        return ResultadoCorte(
            pieza_principal=pieza_principal,
            remanentes=remanentes_rects,
            area_principal_mm2=area_principal,
            area_remanentes_mm2=area_remanentes,
            area_desperdicio_mm2=area_desperdicio,
            area_original_mm2=plancha_poly.area,
            invariante_valida=invariante_valida,
            error_invariante_mm2=error,
            lineas_aplicadas=lineas
        )

    @staticmethod
    def _extraer_rectangulos(geom) -> List[Rectangulo]:
        """
        Extrae rectángulos aproximados de una geometría Shapely.
        Para v1.0, asumimos remanentes rectangulares.
        """
        rects = []

        if geom.is_empty:
            return rects

        # Si es una colección de polígonos
        if hasattr(geom, 'geoms'):
            geoms = geom.geoms
        else:
            geoms = [geom]

        for poly in geoms:
            if poly.is_empty:
                continue
            bounds = poly.bounds
            rect = Rectangulo(
                ancho=bounds[2] - bounds[0],
                alto=bounds[3] - bounds[1],
                origen_x=bounds[0],
                origen_y=bounds[1]
            )
            rects.append(rect)

        return rects

    @staticmethod
    def validar_invariante(resultado: ResultadoCorte) -> Dict[str, any]:
        """
        Valida la invariante de masa y retorna detalles.

        Retorna:
            {
                'valida': bool,
                'suma_areas_mm2': float,
                'area_original_mm2': float,
                'error_mm2': float,
                'detalle': str
            }
        """
        suma = resultado.area_principal_mm2 + resultado.area_remanentes_mm2 + resultado.area_desperdicio_mm2

        return {
            'valida': resultado.invariante_valida,
            'suma_areas_mm2': suma,
            'area_original_mm2': resultado.area_original_mm2,
            'error_mm2': resultado.error_invariante_mm2,
            'detalle': (
                f"Pieza principal: {resultado.area_principal_mm2:.1f} mm² | "
                f"Remanentes: {resultado.area_remanentes_mm2:.1f} mm² | "
                f"Desperdicio: {resultado.area_desperdicio_mm2:.1f} mm² | "
                f"Total: {suma:.1f} mm² (original: {resultado.area_original_mm2:.1f} mm²) | "
                f"Error: {resultado.error_invariante_mm2:.2f} mm²"
            )
        }

    @staticmethod
    def dimensiones_pieza(resultado: ResultadoCorte) -> Dict[str, float]:
        """Retorna dimensiones de la pieza principal en mm"""
        return {
            'ancho_mm': resultado.pieza_principal.ancho,
            'alto_mm': resultado.pieza_principal.alto,
            'area_mm2': resultado.area_principal_mm2
        }

    @staticmethod
    def dimensiones_remanentes(resultado: ResultadoCorte) -> List[Dict[str, float]]:
        """Retorna lista de dimensiones de cada remanente en mm"""
        return [
            {
                'ancho_mm': r.ancho,
                'alto_mm': r.alto,
                'area_mm2': r.area_mm2(),
                'origen_x_mm': r.origen_x,
                'origen_y_mm': r.origen_y
            }
            for r in resultado.remanentes
        ]
