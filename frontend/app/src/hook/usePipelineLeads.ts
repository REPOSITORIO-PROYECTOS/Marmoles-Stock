import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { get, patch, post } from '../api';
import { toast } from 'sonner';
import { imprimirPresupuestoArgentino } from '../utils/presupuestoExporter';
import { generatePlanImage } from '../utils/planImage';

export interface Lead {
    id: string;
    nombre: string;
    telefono: string;
    email: string;
    dni?: string;
    direccion: string;
    comuna?: string;
    coordenadas?: string;
    estado: 'recibir_posible' | 'contactado' | 'seguimiento' | 'convertido' | 'perdido' | 'archivado';
    canales: string[];
    prioridad: 'urgente' | 'alto' | 'medio' | 'bajo';
    comentario: string;
    archivos: string[];
    createdAt: number;
    cliente_id?: string;  // Vinculación directa al cliente
    presupuesto_relacionado_id?: string;
    presupuesto_info?: {
        material?: string;
        metros?: number;
        total?: number;
    };
}

const initialLeadState = {
    nombre: '',
    telefono: '',
    email: '',
    dni: '',
    direccion: '',
    comuna: '',
    canales: [] as string[],
    prioridad: 'medio' as const,
    comentario: '',
    archivos: [] as string[],
    estado: 'recibir_posible' as const,
};

export function usePipelineLeads() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterChannel, setFilterChannel] = useState<string>('all');
    const [filterDate, setFilterDate] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

    const [newLead, setNewLead] = useState(initialLeadState);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchLeads();
        checkUserRole();
    }, []);

    useEffect(() => {
        const urgentLeads = leads.filter(l => l.prioridad === 'urgente' && l.estado === 'recibir_posible');
        if (urgentLeads.length > 0) {
            toast.warning(`Tienes ${urgentLeads.length} leads URGENTES sin atender!`, {
                duration: 5000,
            });
        }
    }, [leads]);

    const getPresupuestoEstado = (presupuesto: any): Lead['estado'] => {
        const pipelineEstado = presupuesto?.pipeline_estado;
        if (['recibir_posible', 'contactado', 'seguimiento', 'convertido', 'perdido'].includes(pipelineEstado)) {
            return pipelineEstado as Lead['estado'];
        }
        if (presupuesto.aceptado_venta && presupuesto.estado_pago && presupuesto.estado_pago !== 'pendiente') {
            return 'convertido';
        }
        if (presupuesto.aceptado_venta) {
            return 'contactado';
        }
        return 'recibir_posible';
    };

    const mapPresupuestoInfo = (presupuesto: any) => ({
        material: presupuesto.lineas?.[0]?.material,
        metros: presupuesto.lineas?.[0]?.metros_cuadrados,
        total: presupuesto.total
    });

    const parseCreatedAt = (value: any): number => {
        if (typeof value === 'number' && !isNaN(value) && value > 0) return value;
        if (typeof value === 'string') {
            const parsed = Date.parse(value);
            if (!isNaN(parsed)) return parsed;
            const numeric = Number(value);
            if (!isNaN(numeric) && numeric > 0) return numeric;
        }
        return Date.now();
    };

    const fetchLeads = async () => {
        try {
            setLoading(true);

            // Cargar leads reales desde la API
            let leadsReales: any[] = [];
            try {
                leadsReales = await get<any[]>('/api/leads');
                if (!Array.isArray(leadsReales)) {
                    leadsReales = [];
                }
            } catch (err) {
                console.warn('No se pudo cargar leads reales', err);
                leadsReales = [];
            }

            // Cargar presupuestos para enriquecer los leads
            let presupuestos: any[] = [];
            try {
                presupuestos = await get<any[]>('/api/presupuestos');
                if (!Array.isArray(presupuestos)) {
                    presupuestos = [];
                }
            } catch (err) {
                console.warn('No se pudo cargar presupuestos', err);
                presupuestos = [];
            }

            // Crear un mapa de presupuestos por lead_id para referencia rápida
            const presupuestosMap = new Map<string, any>();
            for (const p of presupuestos) {
                if (p.id) {
                    presupuestosMap.set(p.id, p);
                }
            }

            // Convertir leads reales al formato interno, enriqueciendo con información de presupuesto
            const leadsProcessados: Lead[] = leadsReales
                .map((l: any) => {
                    const lead: Lead = {
                        id: l.id,
                        nombre: l.nombre || '',
                        telefono: l.telefono || '',
                        email: l.email || '',
                        dni: l.dni || '',
                        direccion: l.direccion || '',
                        comuna: l.comuna || '',
                        coordenadas: l.coordenadas || '',
                        estado: (['recibir_posible', 'contactado', 'seguimiento', 'convertido', 'perdido'].includes(l.estado)
                            ? l.estado
                            : 'recibir_posible') as Lead['estado'],
                        canales: l.canales || [],
                        prioridad: l.prioridad || 'medio',
                        comentario: l.comentario || '',
                        archivos: l.archivos || [],
                        createdAt: parseCreatedAt(l.createdAt || l.fecha_creacion)
                    };

                    // Si el lead tiene un presupuesto relacionado, enriquecer la información
                    if (l.presupuesto_relacionado_id) {
                        lead.presupuesto_relacionado_id = l.presupuesto_relacionado_id;
                        const presupuesto = presupuestosMap.get(l.presupuesto_relacionado_id);
                        if (presupuesto) {
                            lead.presupuesto_info = mapPresupuestoInfo(presupuesto);
                        }
                    }

                    return lead;
                })
                .filter(l => l.estado !== 'archivado');

            setLeads(leadsProcessados);
            setSelectedLeadIds(prev => prev.filter(id => leadsProcessados.some(l => l.id === id)));
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar leads');
        } finally {
            setLoading(false);
        }
    };

    const checkUserRole = async () => {
        try {
            const user = await get<{ role: string }>('/api/usuarios/me');
            setIsAdmin(user.role === 'admin');
        } catch (error) {
            console.error('Error checking role', error);
            setIsAdmin(false);
        }
    };

    const validateField = (name: string, value: any) => {
        let error = '';
        switch (name) {
            case 'nombre':
                if (!value) error = 'El nombre es obligatorio';
                break;
            case 'telefono':
                if (!value) error = 'El teléfono es obligatorio';
                else if (!/^\+?[\d\s-]{8,}$/.test(value)) error = 'Formato de teléfono inválido';
                break;
            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Email inválido';
                break;
            case 'comentario':
                if (value && value.length < 20) error = 'El comentario debe tener al menos 20 caracteres';
                break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
        return error;
    };

    const handleInputChange = (field: string, value: any, isEdit: boolean = false) => {
        validateField(field, value);
        if (isEdit && editingLead) {
            setEditingLead({ ...editingLead, [field]: value });
        } else {
            setNewLead(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleChannelToggle = (channel: string, isEdit: boolean = false) => {
        if (isEdit && editingLead) {
            const current = editingLead.canales || [];
            const updated = current.includes(channel)
                ? current.filter(c => c !== channel)
                : [...current, channel];
            setEditingLead({ ...editingLead, canales: updated });
        } else {
            const current = newLead.canales;
            const updated = current.includes(channel)
                ? current.filter(c => c !== channel)
                : [...current, channel];
            setNewLead(prev => ({ ...prev, canales: updated }));
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
        if (e.target.files && e.target.files.length > 0) {
            const fileNames = Array.from(e.target.files).map((f: File) => f.name);
            if (isEdit && editingLead) {
                setEditingLead({ ...editingLead, archivos: [...(editingLead.archivos || []), ...fileNames] });
            } else {
                setNewLead(prev => ({ ...prev, archivos: [...prev.archivos, ...fileNames] }));
            }
            toast.success(`${fileNames.length} archivos adjuntados`);
        }
    };

    const openWhatsApp = (lead: Lead) => {
        if (!lead.telefono) return;
        const cleanNumber = lead.telefono.replace(/[^0-9]/g, '');
        if (!cleanNumber) return;
        const url = `https://wa.me/${cleanNumber}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleCreateLead = async () => {
        const nameErr = validateField('nombre', newLead.nombre);
        const telErr = validateField('telefono', newLead.telefono);
        const emailErr = validateField('email', newLead.email);
        const commentErr = validateField('comentario', newLead.comentario);

        if (nameErr || telErr || emailErr || commentErr) {
            toast.error('Por favor corrija los errores en el formulario');
            return;
        }

        try {
            const leadToCreate = {
                ...newLead,
                createdAt: Date.now()
            };
            const created = await post<Lead>('/api/leads', leadToCreate);
            setLeads([...leads, { ...created, estado: 'recibir_posible' } as Lead]);
            setNewLead(initialLeadState);
            setIsDialogOpen(false);
            setErrors({});
            toast.success('Lead creado correctamente');
        } catch (error) {
            toast.error('Error al crear lead');
        }
    };

    const handleUpdateLead = async () => {
        if (!editingLead) return;

        if (!editingLead.nombre) return toast.error('Nombre requerido');
        if (!editingLead.telefono) return toast.error('Teléfono requerido');

        try {
            // Los leads reales tienen ID sin prefijo
            const payload: any = {
                nombre: editingLead.nombre,
                telefono: editingLead.telefono,
                email: editingLead.email,
                direccion: editingLead.direccion,
                dni: editingLead.dni,
                comuna: editingLead.comuna,
                coordenadas: editingLead.coordenadas,
                estado: editingLead.estado,
                canales: editingLead.canales,
                prioridad: editingLead.prioridad,
                comentario: editingLead.comentario
            };

            await patch(`/api/leads/${editingLead.id}`, payload);
            setLeads(leads.map(l => l.id === editingLead.id ? { ...l, ...payload } : l));
            setIsEditDialogOpen(false);
            setEditingLead(null);
            toast.success('Lead actualizado correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar lead');
        }
    };

    const handleEstadoChange = async (leadOrId: Lead | string, nuevoEstado: Lead['estado']) => {
        if (!isAdmin) {
            toast.error('Solo administradores pueden editar leads');
            return;
        }
        const lead = typeof leadOrId === 'string' ? leads.find(l => l.id === leadOrId)! : leadOrId;
        const leadId = lead.id;

        try {
            // Actualizar el lead real con el nuevo estado
            await patch(`/api/leads/${leadId}`, { estado: nuevoEstado });
            setLeads(leads.map(l => l.id === leadId ? { ...l, estado: nuevoEstado } : l));
            toast.success('Estado actualizado correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar estado del lead');
        }
    };

    const openEditDialog = (lead: Lead) => {
        if (!isAdmin) {
            toast.error('Solo administradores pueden editar leads');
            return;
        }
        setEditingLead(lead);
        setIsEditDialogOpen(true);
    };

    const openGoogleMaps = (lead: Lead) => {
        if (lead.coordenadas && lead.coordenadas.trim() !== '') {
            const coords = lead.coordenadas.replace(/\s/g, '');
            const url = `https://www.google.com/maps/search/?api=1&query=${coords}`;
            window.open(url, '_blank', 'noopener');
            return;
        }

        const coordsMatch = lead.direccion && (
            lead.direccion.match(/\[(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)\]/) ||
            lead.direccion.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/)
        );

        if (coordsMatch) {
            const numbers = coordsMatch[0].match(/-?\d+(\.\d+)?/g);
            if (numbers && numbers.length >= 2) {
                const lat = numbers[0];
                const lng = numbers[1];
                const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                window.open(url, '_blank', 'noopener');
                return;
            }
        }

        const query = lead.direccion || lead.comuna;
        if (!query) return;
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        window.open(url, '_blank', 'noopener');
    };

    const toggleLeadSelected = (leadId: string) => {
        setSelectedLeadIds(prev => (prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]));
    };

    const handleDownloadPresupuesto = async (presupuestoId: string, lead: Lead) => {
        try {
            toast.info('Cargando presupuesto...');
            const data = await get<any>(`/api/presupuestos/${presupuestoId}`);

            const anexosImagenes: string[] = [];
            let allPiezas: Array<{ w: number; h: number; agujeros: number; label: string }> = [];

            if (Array.isArray(data.lineas)) {
                for (const l of data.lineas) {
                    if (l.geometria_json) {
                        try {
                            const geo = JSON.parse(l.geometria_json);
                            const board = geo.boardConfig || geo.effective_board || { ancho: 300, largo: 180 };

                            // Extraer piezas de este plano
                            if (geo.placements && Array.isArray(geo.placements)) {
                                for (let i = 0; i < geo.placements.length; i++) {
                                    const p = geo.placements[i];
                                    const w = p.w || p.ancho || 0;
                                    const h = p.h || p.largo || 0;
                                    allPiezas.push({
                                        w,
                                        h,
                                        agujeros: p.agujeros?.length || 0,
                                        label: `Pieza ${allPiezas.length + 1}: ${w} × ${h} cm ${p.agujeros?.length ? `(${p.agujeros.length} aguj.)` : ''}`
                                    });
                                }
                            }

                            // Crear plan para generar imagen
                            const plan = {
                                effective_board: { width: board.ancho || board.width || 300, height: board.largo || board.height || 180 },
                                placements: geo.placements && Array.isArray(geo.placements) ? geo.placements : [],
                                cuts: geo.cuts && Array.isArray(geo.cuts) ? geo.cuts : [],
                                features: geo.features && Array.isArray(geo.features) ? geo.features : []
                            };

                            // Generar imagen del plano
                            const img = generatePlanImage(plan);
                            if (img && img.length > 100) {
                                anexosImagenes.push(img);
                                console.log(`✓ Plan generado para línea: ${l.material}`);
                            } else {
                                console.warn(`⚠ Plan vacío para línea: ${l.material}`);
                                // Aun así agregar una imagen aunque sea vacía, para mantener consistencia
                                if (img) anexosImagenes.push(img);
                            }
                        } catch (e) {
                            console.error('Error parsing linea geometria:', e);
                        }
                    } else {
                        console.warn(`⚠ Línea sin geometria_json: ${l.material}`);
                    }
                }
                console.log(`Total planes generados: ${anexosImagenes.length} de ${data.lineas.length} líneas`);
            }

            let linkUbicacion = undefined;
            if (lead.coordenadas) {
                const coords = lead.coordenadas.replace(/\s/g, '');
                linkUbicacion = `https://www.google.com/maps?q=${coords}`;
            }

            // Obtener items_adicionales (extras) del meta
            const itemsAdicionales = data.meta?.items_adicionales || [];
            const totalExtras = itemsAdicionales.reduce((sum: number, item: any) => sum + ((item.precio || 0) * (item.cantidad || 1)), 0);
            const correlativo = Number(data.correlativo_global || data.meta?.correlativo_global || 0);
            const correlativoText = correlativo > 0 ? String(correlativo).padStart(6, '0') : '000000';
            const clienteFile = (lead.nombre || 'Cliente').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
            const nombreArchivo = `${clienteFile} - ${correlativoText}.pdf`;

            imprimirPresupuestoArgentino({
                id: `P-${data.id.toString().slice(-6)}`,
                nombreArchivo,
                correlativoGlobal: correlativo || undefined,
                fecha: new Date(data.createdAt || Date.now()).toLocaleDateString(),
                cliente: {
                    nombre: lead.nombre,
                    dni_cuit: lead.dni || '',
                    direccion: lead.direccion || '',
                    telefono: lead.telefono || '',
                    condicionIva: 'Consumidor Final'
                },
                linkUbicacion,
                empresa: {
                    nombre: 'Mundo di Marmi',
                    cuit: '20-XXXXXXXX-X',
                    direccion: 'San Juan, Argentina'
                },
                items: [
                    ...(data.lineas || []).map((l: any) => ({
                        detalle: l.material + (l.lote_id ? ` (Lote: ${l.lote_id})` : ''),
                        medidas: 'Según Plano Adjunto',
                        cantidad: Number(l.metros_cuadrados),
                        precioUnitario: Number(l.precio_unitario),
                        total: Number(l.metros_cuadrados) * Number(l.precio_unitario),
                        cortes: l.cortes_especiales ? `${l.agujeros || 0} agujeros` : undefined,
                        extras: undefined
                    })),
                    ...itemsAdicionales.map((item: any) => ({
                        detalle: item.nombre,
                        medidas: `${item.cantidad} ${item.categoria || 'unidades'}`,
                        cantidad: item.cantidad || 1,
                        precioUnitario: item.precio || 0,
                        total: (item.precio || 0) * (item.cantidad || 1),
                        cortes: undefined,
                        extras: undefined
                    }))
                ],
                total: Number(data.total),
                subtotalMateriales: (data.lineas || []).reduce((sum: number, l: any) => sum + (Number(l.metros_cuadrados) * Number(l.precio_unitario)), 0),
                subtotalExtras: totalExtras,
                subtotalNeto: Number(data.subtotal_neto ?? data.meta?.subtotal_neto ?? data.total),
                ivaMonto: Number(data.iva_monto ?? data.meta?.iva_monto ?? 0),
                totalFinal: Number(data.total_final ?? data.meta?.total_final ?? data.total),
                observaciones: data.observaciones || data.comentario || 'Cortes a medida. Precios sujetos a variación del dólar.',
                piezasDetalle: allPiezas.length > 0 ? allPiezas : undefined,
                anexosImagenes
            });

        } catch (error) {
            console.error(error);
            toast.error('Error al descargar presupuesto');
        }
    };

    const handleBulkDeleteLeads = async () => {
        if (!isAdmin) {
            toast.error('Solo administradores pueden eliminar leads');
            return;
        }
        if (selectedLeadIds.length === 0) return;
        const ok = window.confirm(`¿Eliminar ${selectedLeadIds.length} lead(s)? Esta acción no se puede deshacer.`);
        if (!ok) return;

        try {
            setLoading(true);
            await post('/api/leads/bulk-delete', { ids: selectedLeadIds });

            const localLeadsRaw = localStorage.getItem('leads_local');
            const localLeads: Lead[] = localLeadsRaw ? JSON.parse(localLeadsRaw) : [];
            const filteredLocal = localLeads.filter(l => !selectedLeadIds.includes(l.id));
            localStorage.setItem('leads_local', JSON.stringify(filteredLocal));

            setLeads(prev => prev.filter(l => !selectedLeadIds.includes(l.id)));
            setSelectedLeadIds([]);
            toast.success('Leads eliminados');
        } catch (e) {
            console.error(e);
            toast.error('Error al eliminar leads');
        } finally {
            setLoading(false);
        }
    };

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            const q = searchTerm.toLowerCase();
            const matchesSearch =
                lead.nombre.toLowerCase().includes(q) ||
                lead.email.toLowerCase().includes(q) ||
                lead.telefono.includes(q) ||
                (lead.dni && lead.dni.includes(q)) ||
                lead.comuna?.toLowerCase().includes(q) ||
                lead.id.toLowerCase().includes(q);

            const matchesPriority = filterPriority === 'all' || lead.prioridad === filterPriority;
            const matchesChannel = filterChannel === 'all' || (lead.canales && lead.canales.includes(filterChannel));

            let matchesDate = !filterDate;
            if (filterDate && lead.createdAt) {
                try {
                    const ts = Number(lead.createdAt);
                    if (!isNaN(ts) && ts > 0) {
                        const leadDate = new Date(ts).toISOString().split('T')[0];
                        matchesDate = leadDate === filterDate;
                    }
                } catch (e) {
                    matchesDate = false;
                }
            }

            const matchesStatus = filterStatus === 'all' || lead.estado === filterStatus;

            return matchesSearch && matchesPriority && matchesChannel && matchesDate && matchesStatus;
        });
    }, [leads, searchTerm, filterPriority, filterChannel, filterDate, filterStatus]);

    const sortByDateDesc = (arr: Lead[]) => [...arr].sort((a, b) => {
        const aTs = Number(a.createdAt) || 0;
        const bTs = Number(b.createdAt) || 0;
        return bTs - aTs;
    });

    const leadsByEstado = {
        recibir_posible: sortByDateDesc(filteredLeads.filter(l => l.estado === 'recibir_posible')),
        contactado: sortByDateDesc(filteredLeads.filter(l => l.estado === 'contactado')),
        seguimiento: sortByDateDesc(filteredLeads.filter(l => l.estado === 'seguimiento')),
        convertido: sortByDateDesc(filteredLeads.filter(l => l.estado === 'convertido')),
        perdido: sortByDateDesc(filteredLeads.filter(l => l.estado === 'perdido')),
    };

    return {
        leads,
        setLeads,
        isDialogOpen,
        setIsDialogOpen,
        isEditDialogOpen,
        setIsEditDialogOpen,
        isAdmin,
        loading,
        selectedLeadIds,
        setSelectedLeadIds,
        searchTerm,
        setSearchTerm,
        filterPriority,
        setFilterPriority,
        filterChannel,
        setFilterChannel,
        filterDate,
        setFilterDate,
        filterStatus,
        setFilterStatus,
        showMapPicker,
        setShowMapPicker,
        isFilterDialogOpen,
        setIsFilterDialogOpen,
        isHistoryDialogOpen,
        setIsHistoryDialogOpen,
        newLead,
        setNewLead,
        editingLead,
        setEditingLead,
        errors,
        validateField,
        handleInputChange,
        handleChannelToggle,
        handleFileChange,
        openWhatsApp,
        handleCreateLead,
        handleUpdateLead,
        handleEstadoChange,
        openEditDialog,
        openGoogleMaps,
        toggleLeadSelected,
        handleDownloadPresupuesto,
        handleBulkDeleteLeads,
        filteredLeads,
        leadsByEstado,
        fetchLeads
    };
}
