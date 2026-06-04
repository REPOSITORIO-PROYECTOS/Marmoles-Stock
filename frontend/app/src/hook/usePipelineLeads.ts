import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { get, patch, post } from '../api';
import { toast } from 'sonner';
import { downloadPresupuestoPdf } from '../utils/presupuestoPdfFromApi';
import { BRAND_LEGAL_NAME } from '../brand';
import { parseMsFromBackendFecha } from '../utils/fechaArgentina';
import {
  normalizeWhatsAppNumberAr,
  buildPresupuestoWhatsAppMessage,
  openWhatsAppChat,
  copyTextToClipboard,
} from '../utils/whatsappPresupuesto';

export interface Lead {
    id: string;
    nombre: string;
    telefono: string;
    email: string;
    dni?: string;
    direccion: string;
    departamento?: string;
    coordenadas?: string;
    estado: 'recibir_posible' | 'contactado' | 'seguimiento' | 'convertido' | 'perdido' | 'archivado';
    canales: string[];
    prioridad: 'urgente' | 'alto' | 'medio' | 'bajo';
    comentario: string;
    createdAt: number;
    cliente_id?: string | null;
    presupuesto_relacionado_id: string | null;
    presupuesto_info?: {
        material?: string;
        metros?: number;
        total?: number;
        codigo?: string;
        direccion?: string;
        forma_pago?: string;
    };
}

const persistPresupuestoPipelineEstado = async (presupuestoId: string, estado: string) => {
    const currentMeta = await get<any>(`/api/presupuestos/${presupuestoId}/meta`).catch(() => null);
    const mergedMeta = {
        ...(currentMeta && typeof currentMeta === 'object' ? currentMeta : {}),
        pipeline_estado: estado,
    };
    await post(`/api/presupuestos/${presupuestoId}/meta`, { data: mergedMeta });
};

const initialLeadState = {
    nombre: '',
    telefono: '',
    email: '',
    dni: '',
    direccion: '',
    departamento: '',
    canales: [] as string[],
    prioridad: 'medio' as const,
    comentario: '',
    estado: 'recibir_posible' as const,
};

export function usePipelineLeads() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [roleReady, setRoleReady] = useState(false);
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
        total: presupuesto.total,
        codigo: presupuesto.codigo ?? null,
        direccion: presupuesto.direccion_obra_texto || presupuesto.direccion || null,
        forma_pago:
            (presupuesto.condiciones_comerciales &&
                typeof presupuesto.condiciones_comerciales === 'object' &&
                String(presupuesto.condiciones_comerciales.plazo_pago || '').trim()) ||
            String(presupuesto.plazo_pago_nombre || presupuesto.tipo_cobro || '').trim() ||
            null,
    });

    const parseCreatedAt = (value: unknown): number => parseMsFromBackendFecha(value);

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

            const leadsActivos = leadsReales.filter((l: any) => l.estado !== 'archivado');

            // Convertir leads reales al formato interno, enriqueciendo con información de presupuesto
            const leadsProcessados: Lead[] = leadsActivos.map((l: any) => {
                const pid =
                    l.presupuesto_relacionado_id != null && l.presupuesto_relacionado_id !== ''
                        ? String(l.presupuesto_relacionado_id)
                        : null;

                const lead: Lead = {
                    id: l.id,
                    nombre: l.nombre || '',
                    telefono: l.telefono || '',
                    email: l.email || '',
                    dni: l.dni || '',
                    direccion: l.direccion || '',
                    departamento: l.departamento || '',
                    coordenadas: l.coordenadas || '',
                    estado: l.estado as Lead['estado'],
                    canales: l.canales || [],
                    prioridad: l.prioridad || 'medio',
                    comentario: l.comentario || '',
                    createdAt: parseCreatedAt(l.createdAt || l.fecha_creacion),
                    cliente_id: l.cliente_id ?? null,
                    presupuesto_relacionado_id: pid,
                };

                if (pid && presupuestosMap.has(pid)) {
                    const presupuesto = presupuestosMap.get(pid);
                    if (presupuesto) {
                        lead.presupuesto_info = mapPresupuestoInfo(presupuesto);
                    }
                }

                return lead;
            });

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
            const role = user.role ?? null;
            setUserRole(role);
            setIsAdmin(role === 'admin');
        } catch (error) {
            console.error('Error checking role', error);
            setUserRole(null);
            setIsAdmin(false);
        } finally {
            setRoleReady(true);
        }
    };

    const canOpenLeadDetail = userRole === 'admin' || userRole === 'ventas';

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

    const handleFileChange = (_e: ChangeEvent<HTMLInputElement>, _isEdit: boolean = false) => {
        toast.info('La carga de archivos para leads está deshabilitada por ahora');
    };

    const openWhatsApp = async (lead: Lead) => {
        if (!lead.telefono) {
            toast.error('El lead no tiene teléfono');
            return;
        }
        const e164 = normalizeWhatsAppNumberAr(lead.telefono);
        if (!e164) {
            toast.error('Teléfono inválido para WhatsApp');
            return;
        }
        const mensaje = buildPresupuestoWhatsAppMessage({
            nombreCliente: lead.nombre,
            empresaNombre: BRAND_LEGAL_NAME,
        });
        const opened = openWhatsAppChat(e164, mensaje);
        if (!opened) {
            const copied = await copyTextToClipboard(mensaje);
            toast[copied ? 'warning' : 'error'](
                copied ? 'Pop-up bloqueado. Mensaje copiado al portapapeles.' : 'No se pudo abrir WhatsApp.'
            );
        }
        const pid = lead.presupuesto_relacionado_id;
        if (pid) {
            try {
                const current = await get<Record<string, unknown>>(`/api/presupuestos/${pid}/meta`).catch(() => null);
                const base = current && typeof current === 'object' ? { ...current } : {};
                await post(`/api/presupuestos/${pid}/meta`, {
                    data: {
                        ...base,
                        enviado_whatsapp_at: new Date().toISOString(),
                        ultima_interaccion_canal: 'whatsapp',
                    },
                });
            } catch {
                /* ignore */
            }
        }
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
            const created = await post<any>('/api/leads', leadToCreate);
            const nuevo: Lead = {
                id: created.id,
                nombre: created.nombre || '',
                telefono: created.telefono || '',
                email: created.email || '',
                dni: created.dni || '',
                direccion: created.direccion || '',
                departamento: created.departamento || '',
                coordenadas: created.coordenadas || '',
                estado: created.estado as Lead['estado'],
                canales: created.canales || [],
                prioridad: created.prioridad || 'medio',
                comentario: created.comentario || '',
                createdAt: parseCreatedAt(created.createdAt || created.fecha_creacion),
                cliente_id: created.cliente_id ?? null,
                presupuesto_relacionado_id:
                    created.presupuesto_relacionado_id != null && created.presupuesto_relacionado_id !== ''
                        ? String(created.presupuesto_relacionado_id)
                        : null,
            };
            setLeads([...leads, nuevo]);
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

        if (!isAdmin) {
            toast.error('Solo administradores pueden guardar cambios en el lead.');
            return;
        }

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
                departamento: editingLead.departamento,
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
            // Rechazado: enviar presupuesto a historial y ocultar card del pipeline activo
            if (nuevoEstado === 'perdido') {
                if (lead.presupuesto_relacionado_id) {
                    await persistPresupuestoPipelineEstado(lead.presupuesto_relacionado_id, 'rechazado');
                }
                await patch(`/api/leads/${leadId}`, { estado: 'archivado' });
                await fetchLeads();
                toast.success('Presupuesto rechazado y enviado a historial');
                return;
            }

            // Actualizar el lead real con el nuevo estado
            await patch(`/api/leads/${leadId}`, { estado: nuevoEstado });
            if (lead.presupuesto_relacionado_id) {
                await persistPresupuestoPipelineEstado(lead.presupuesto_relacionado_id, nuevoEstado);
            }
            await fetchLeads();
            toast.success('Estado actualizado correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar estado del lead');
        }
    };

    const openEditDialog = useCallback((lead: Lead) => {
        if (!canOpenLeadDetail) {
            toast.error('No tiene permiso para abrir el detalle del lead.');
            return;
        }
        setEditingLead(lead);
        setIsEditDialogOpen(true);
    }, [canOpenLeadDetail]);

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

        const query = lead.direccion || lead.departamento;
        if (!query) return;
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        window.open(url, '_blank', 'noopener');
    };

    const toggleLeadSelected = (leadId: string) => {
        setSelectedLeadIds(prev => (prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]));
    };

    const handleDownloadPresupuesto = async (presupuestoId: string, lead: Lead) => {
        try {
            await downloadPresupuestoPdf(presupuestoId, {
                nombre: lead.nombre,
                dni: lead.dni,
                direccion: lead.direccion || '',
                telefono: lead.telefono || '',
                coordenadas: lead.coordenadas,
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

            setSelectedLeadIds([]);
            await fetchLeads();
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
                lead.departamento?.toLowerCase().includes(q) ||
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
        canOpenLeadDetail,
        roleReady,
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
