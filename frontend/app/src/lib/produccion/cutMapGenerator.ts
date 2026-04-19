import JsPDF from 'jspdf';
import type { Pieza, TrabajoPendiente } from './plan';
import { toast } from 'sonner';

interface PiezaConTrabajo extends Pieza {
    trabajoId: string;
    cliente: string;
    trabajoCompleto: TrabajoPendiente;
}

interface RectanguloCortado {
    x: number;
    y: number;
    w: number;
    h: number;
    pieza: PiezaConTrabajo;
    rotada: boolean;
}

interface HojaCorte {
    numero: number;
    area_usada: number;
    rectangulos: RectanguloCortado[];
}

interface BasePlateConfig {
    widthMm: number;
    heightMm: number;
    label?: string;
}

const A4_WIDTH = 210;  // mm
const A4_HEIGHT = 297; // mm
const MARGIN = 3;      // mm (reducido de 5)
const USABLE_WIDTH = A4_WIDTH - (2 * MARGIN);
const USABLE_HEIGHT = A4_HEIGHT - (2 * MARGIN);
const MIN_PIECE_SIZE = 20; // mm mínimo
const PACK_STEP = 10; // mm

const DEFAULT_BASE_PLATE: BasePlateConfig = {
    widthMm: 3000,
    heightMm: 2000,
    label: "300 x 200 cm"
};

function setLineDashSafe(doc: JsPDF, pattern: number[]): void {
    const anyDoc = doc as unknown as { setLineDash?: (p: number[]) => void; setLineDashPattern?: (p: number[], phase?: number) => void };
    if (typeof anyDoc.setLineDash === 'function') {
        anyDoc.setLineDash(pattern);
        return;
    }
    if (typeof anyDoc.setLineDashPattern === 'function') {
        anyDoc.setLineDashPattern(pattern, 0);
    }
}

/**
 * Algoritmo de bin packing (First Fit Decreasing)
 * Empaqueta piezas en hojas A4 de forma optimizada
 */
function empaquetar(piezas: PiezaConTrabajo[], basePlate: BasePlateConfig): HojaCorte[] {
    // Ordenar por área descendente (First Fit Decreasing)
    const piezasOrdenadas = [...piezas].sort((a, b) => {
        const areaA = (a.w || 10) * (a.h || 10);
        const areaB = (b.w || 10) * (b.h || 10);
        return areaB - areaA;
    });

    const hojas: HojaCorte[] = [];

    for (const pieza of piezasOrdenadas) {
        const rawW = pieza.w ?? pieza.ancho ?? 10;
        const rawH = pieza.h ?? pieza.largo ?? 10;
        // Las piezas vienen en milímetros del servidor, usarlas directamente
        const w = Math.min(Math.max(MIN_PIECE_SIZE, rawW), basePlate.widthMm);
        const h = Math.min(Math.max(MIN_PIECE_SIZE, rawH), basePlate.heightMm);

        // Intentar colocar en hojas existentes
        let colocada = false;
        for (const hoja of hojas) {
            if (intentarColocarEnHoja(hoja, pieza, w, h, basePlate)) {
                colocada = true;
                break;
            }
        }

        // Si no encaja, crear nueva hoja
        if (!colocada) {
            const nuevaHoja: HojaCorte = {
                numero: hojas.length + 1,
                area_usada: 0,
                rectangulos: []
            };
            intentarColocarEnHoja(nuevaHoja, pieza, w, h, basePlate);
            hojas.push(nuevaHoja);
        }
    }

    return hojas;
}

/**
 * Intenta colocar una pieza en una hoja
 */
function intentarColocarEnHoja(
    hoja: HojaCorte,
    pieza: PiezaConTrabajo,
    w: number,
    h: number,
    basePlate: BasePlateConfig
): boolean {
    const limitW = basePlate.widthMm;
    const limitH = basePlate.heightMm;
    // Intentar orientación normal
    for (let y = 0; y + h <= limitH; y += PACK_STEP) {
        for (let x = 0; x + w <= limitW; x += PACK_STEP) {
            if (puedeColocarse(hoja, x, y, w, h)) {
                hoja.rectangulos.push({
                    x, y, w, h,
                    pieza,
                    rotada: false
                });
                hoja.area_usada += (w * h) / 10000; // en dm²
                return true;
            }
        }
    }

    // Intentar orientación rotada (si es diferente)
    if (w !== h) {
        const wRot = h;
        const hRot = w;
        if (wRot <= limitW && hRot <= limitH) {
            for (let y = 0; y + hRot <= limitH; y += PACK_STEP) {
                for (let x = 0; x + wRot <= limitW; x += PACK_STEP) {
                    if (puedeColocarse(hoja, x, y, wRot, hRot)) {
                        hoja.rectangulos.push({
                            x, y: y, w: wRot, h: hRot,
                            pieza,
                            rotada: true
                        });
                        hoja.area_usada += (wRot * hRot) / 10000;
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

/**
 * Verifica si se puede colocar un rectángulo en una posición
 */
function puedeColocarse(
    hoja: HojaCorte,
    x: number,
    y: number,
    w: number,
    h: number
): boolean {
    const PADDING = 0.5; // mm entre piezas (reducido de 1)

    for (const rect of hoja.rectangulos) {
        // Verificar colisión con padding
        if (!(x + w + PADDING <= rect.x ||
            rect.x + rect.w + PADDING <= x ||
            y + h + PADDING <= rect.y ||
            rect.y + rect.h + PADDING <= y)) {
            return false;
        }
    }

    return true;
}

/**
 * Genera un PDF con el mapa visual de corte
 */
export function generarMapaCorte(
    trabajos: TrabajoPendiente[],
    materialNombre: string,
    grupoKey: string,
    basePlate?: BasePlateConfig
): Promise<void> {
    return new Promise((resolve) => {
        try {
            const plate = basePlate || DEFAULT_BASE_PLATE;
            // Recolectar todas las piezas con referencia a sus trabajos
            const piezasConTrabajo: PiezaConTrabajo[] = [];
            for (const trabajo of trabajos) {
                if (trabajo.piezas && Array.isArray(trabajo.piezas)) {
                    for (const pieza of trabajo.piezas) {
                        // Expandir cantidad en piezas individuales
                        const qty = pieza.qty || 1;
                        for (let i = 0; i < qty; i++) {
                            piezasConTrabajo.push({
                                ...pieza,
                                trabajoId: trabajo.id,
                                cliente: trabajo.cliente,
                                trabajoCompleto: trabajo
                            });
                        }
                    }
                }
            }

            if (piezasConTrabajo.length === 0) {
                toast.error('No hay piezas para cortar');
                resolve();
                return;
            }

            // Empaquetar piezas en hojas
            const hojas = empaquetar(piezasConTrabajo, plate);

            // Crear PDF
            const doc = new JsPDF('portrait', 'mm', 'A4');
            const totalPiezas = piezasConTrabajo.length;
            const escala = 0.8; // escala para visualización

            // Primera página: portada con información
            dibujarPortada(doc, grupoKey, materialNombre, totalPiezas, hojas.length, plate);
            doc.addPage();

            // Dibujar cada hoja de corte
            for (const hoja of hojas) {
                dibujarHojaCorte(doc, hoja, escala, grupoKey, hojas.length, plate);
                if (hoja !== hojas[hojas.length - 1]) {
                    doc.addPage();
                }
            }

            // Generar resumen final
            doc.addPage();
            dibujarResumen(doc, hojas, totalPiezas, materialNombre, plate);

            toast.success(`Mapa de corte generado: ${hojas.length} hojas`);

            // Descargar PDF
            doc.save(`Mapa_Corte_${grupoKey}_${materialNombre}.pdf`);
            resolve();
        } catch (error) {
            console.error('Error generando mapa de corte:', error);
            toast.error('Error al generar mapa de corte');
            resolve();
        }
    });
}

/**
 * Dibuja la portada del documento
 */
function dibujarPortada(
    doc: JsPDF,
    grupoKey: string,
    materialNombre: string,
    totalPiezas: number,
    totalHojas: number,
    basePlate: BasePlateConfig
): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Título
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('MAPA VISUAL DE CORTE', pageWidth / 2, 25, { align: 'center' });

    // Línea decorativa
    doc.setDrawColor(0, 100, 200);
    doc.setLineWidth(0.5);
    doc.line(20, 30, pageWidth - 20, 30);

    // Información - más compacta
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const infoY = 45;
    const lineHeight = 7;

    doc.text(`📋 Grupo: ${grupoKey}`, 20, infoY);
    doc.text(`🪨 Material: ${materialNombre}`, 20, infoY + lineHeight);
    doc.text(`📦 Piezas: ${totalPiezas}`, 20, infoY + lineHeight * 2);
    doc.text(`📄 Hojas: ${totalHojas}`, 20, infoY + lineHeight * 3);
    doc.text(`📐 Placa base: ${Math.round(basePlate.widthMm / 10)} × ${Math.round(basePlate.heightMm / 10)} cm`, 20, infoY + lineHeight * 4);
    doc.text(`📅 ${new Date().toLocaleDateString('es-ES')}`, 20, infoY + lineHeight * 5);

    // Instrucciones - más compactas
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('INSTRUCCIONES:', 20, infoY + lineHeight * 8);

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    const instrucciones = [
        '✓ Respetar medidas en cada rectángulo',
        '✓ Líneas sólidas = corte final',
        '✓ Líneas punteadas = márgenes de seguridad',
        '✓ Verificar códigos antes de cortar'
    ];

    let instrY = infoY + lineHeight * 9.5;
    for (const instr of instrucciones) {
        doc.text(instr, 25, instrY);
        instrY += 5.5;
    }
}

/**
 * Dibuja una hoja de corte
 */
function dibujarHojaCorte(
    doc: JsPDF,
    hoja: HojaCorte,
    escala: number,
    grupoKey: string,
    totalHojas: number,
    basePlate: BasePlateConfig
): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Encabezado compacto
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 100, 200);
    doc.text(`HOJA ${hoja.numero}/${totalHojas}`, pageWidth / 2, 5, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Margen de página
    doc.setDrawColor(150, 150, 150);
    setLineDashSafe(doc, [2, 2]); // línea punteada
    doc.rect(MARGIN, MARGIN, USABLE_WIDTH, USABLE_HEIGHT);
    setLineDashSafe(doc, []); // línea sólida

    // Placa base escalada a A4
    const scale = Math.min(USABLE_WIDTH / basePlate.widthMm, USABLE_HEIGHT / basePlate.heightMm);
    const plateWidth = basePlate.widthMm * scale;
    const plateHeight = basePlate.heightMm * scale;
    const offsetX = MARGIN + (USABLE_WIDTH - plateWidth) / 2;
    const offsetY = MARGIN + (USABLE_HEIGHT - plateHeight) / 2;

    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.4);
    doc.rect(offsetX, offsetY, plateWidth, plateHeight);

    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(`Placa base: ${Math.round(basePlate.widthMm / 10)} x ${Math.round(basePlate.heightMm / 10)} cm`, offsetX, Math.max(6, offsetY - 2));

    // Dibujar cada pieza
    for (const rect of hoja.rectangulos) {
        // Rectángulo de corte con borde más visible
        doc.setDrawColor(0, 80, 180);
        doc.setLineWidth(0.4);
        const drawX = offsetX + rect.x * scale;
        const drawY = offsetY + rect.y * scale;
        const drawW = rect.w * scale;
        const drawH = rect.h * scale;
        doc.rect(drawX, drawY, drawW, drawH);

        // Relleno muy ligero
        doc.setFillColor(220, 235, 255);
        doc.rect(drawX + 0.3, drawY + 0.3, Math.max(0, drawW - 0.6), Math.max(0, drawH - 0.6), 'F');

        // Información de la pieza
        const padding = 0.8;

        // Cliente (más pequeño)
        doc.setFont(undefined, 'bold');
        doc.setFontSize(6);
        doc.setTextColor(20, 20, 20);
        const textoCliente = rect.pieza.cliente.substring(0, 13);
        doc.text(textoCliente, drawX + padding, drawY + padding + 2, { maxWidth: Math.max(1, drawW - padding * 2) });

        // Medidas (grande y visible)
        doc.setFont(undefined, 'bold');
        doc.setFontSize(6);
        doc.setTextColor(0, 100, 200);
        const medidas = `${Math.round(rect.w / 10)}×${Math.round(rect.h / 10)}cm`;
        const medidaWidth = doc.getTextWidth(medidas);
        doc.text(medidas, drawX + (drawW - medidaWidth) / 2, drawY + drawH / 2, { align: 'center' });

        // Código de pieza en esquina inferior izquierda
        const codigoCorto = rect.pieza.trabajoId.substring(0, 6).toUpperCase();
        doc.setFont(undefined, 'bold');
        doc.setFontSize(5);
        doc.setTextColor(180, 0, 0);
        doc.text(codigoCorto, drawX + padding, drawY + drawH - padding);

        // Nombre de pieza en esquina inferior derecha
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(5);
        doc.setFont(undefined, 'normal');
        const nombrePieza = rect.pieza.nombre?.substring(0, 8) || 'P';
        doc.text(nombrePieza, drawX + drawW - padding, drawY + drawH - padding, { align: 'right' });

        // Ícono de rotación si aplica
        if (rect.rotada) {
            doc.setTextColor(255, 100, 0);
            doc.setFontSize(4);
            doc.text('⟲', drawX + drawW - 1.5, drawY + 1.5);
        }
    }

    // Información de la hoja en el pie
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont(undefined, 'normal');
    const baseAreaDm2 = (basePlate.widthMm * basePlate.heightMm) / 10000;
    const usagePercent = ((hoja.area_usada / baseAreaDm2) * 100).toFixed(1);
    doc.text(`${hoja.rectangulos.length} piezas | ${hoja.area_usada.toFixed(1)} dm² (${usagePercent}%)`, MARGIN, pageHeight - 2.5);
}

/**
 * Dibuja la página de resumen
 */
function dibujarResumen(
    doc: JsPDF,
    hojas: HojaCorte[],
    totalPiezas: number,
    materialNombre: string,
    basePlate: BasePlateConfig
): void {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 100, 200);
    doc.text('RESUMEN DE CORTE', pageWidth / 2, 12, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Línea decorativa
    doc.setDrawColor(0, 100, 200);
    doc.setLineWidth(0.4);
    doc.line(20, 15, pageWidth - 20, 15);

    let y = 25;
    const lineHeight = 6;

    // Estadísticas principales - más compacto
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text('ESTADÍSTICAS:', 20, y);

    y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    const totalArea = hojas.reduce((sum, h) => sum + h.area_usada, 0);
    const avgArea = totalArea / hojas.length;
    const baseAreaDm2 = (basePlate.widthMm * basePlate.heightMm) / 10000;
    const efficiency = ((totalArea / (hojas.length * baseAreaDm2)) * 100).toFixed(1);

    const stats = [
        `• Hojas generadas: ${hojas.length}`,
        `• Piezas totales: ${totalPiezas}`,
        `• Material: ${materialNombre}`,
        `• Área total: ${totalArea.toFixed(2)} dm² (${efficiency}% eficiencia)`,
        `• Promedio por hoja: ${avgArea.toFixed(2)} dm²`
    ];

    for (const stat of stats) {
        doc.text(stat, 25, y);
        y += lineHeight;
    }

    // Distribución por hoja - tabla compacta
    y += 6;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.text('DETALLES POR HOJA:', 20, y);

    y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);

    for (const hoja of hojas) {
        const usagePercent = ((hoja.area_usada / baseAreaDm2) * 100).toFixed(0);
        const clientes = [...new Set(hoja.rectangulos.map(r => r.pieza.cliente))].slice(0, 2).join(', ');

        doc.text(
            `Hoja ${hoja.numero}: ${hoja.rectangulos.length} piezas • ${hoja.area_usada.toFixed(1)} dm² • ${usagePercent}% • ${clientes}`,
            25,
            y
        );
        y += lineHeight - 1;
    }
}
