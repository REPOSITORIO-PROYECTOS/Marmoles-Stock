import { useState, useEffect, useCallback, useRef } from 'react';
import { get } from '../../../api';
import { Lote, Material } from '../types';
import { normalizarNombre } from '../utils/materialUtils';

export const useLotes = (allMateriales: Material[]) => {
    const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());
    const [lotesPorMaterial, setLotesPorMaterial] = useState<Record<string, Lote[]>>({});
    const [loadingLotes, setLoadingLotes] = useState<Record<string, boolean>>({});

    const expandedMaterialsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        expandedMaterialsRef.current = expandedMaterials;
    }, [expandedMaterials]);

    const fetchLotesForMaterial = useCallback(async (material: Material) => {
        const materialKey = normalizarNombre(material.nombre);
        setLoadingLotes(prev => ({ ...prev, [materialKey]: true }));
        try {
            const idsToFetch = material.ids || [material.id];
            const allLotes: Lote[] = [];

            for (const id of idsToFetch) {
                const data = await get<Lote[]>(`/api/lotes?material_id=${encodeURIComponent(id)}`);
                if (Array.isArray(data)) {
                    allLotes.push(...data);
                }
            }

            if (allLotes.length === 0) {
                const dataByName = await get<Lote[]>(`/api/lotes?material_nombre=${encodeURIComponent(material.nombre)}`);
                if (Array.isArray(dataByName)) {
                    allLotes.push(...dataByName);
                }
            }

            setLotesPorMaterial(prev => ({ ...prev, [materialKey]: allLotes }));
        } catch (e) {
            console.error("Error loading lotes:", e);
        } finally {
            setLoadingLotes(prev => ({ ...prev, [materialKey]: false }));
        }
    }, []);

    const toggleExpand = useCallback(async (material: Material) => {
        const newExpanded = new Set(expandedMaterials);
        const materialKey = normalizarNombre(material.nombre);

        if (newExpanded.has(materialKey)) {
            newExpanded.delete(materialKey);
        } else {
            newExpanded.add(materialKey);
            if (!lotesPorMaterial[materialKey]) {
                await fetchLotesForMaterial(material);
            }
        }
        setExpandedMaterials(newExpanded);
    }, [expandedMaterials, lotesPorMaterial, fetchLotesForMaterial]);

    // Cargar todos los lotes al inicio
    useEffect(() => {
        (async () => {
            try {
                const allLotes = await get<Lote[]>('/api/lotes');
                if (Array.isArray(allLotes)) {
                    const map: Record<string, Lote[]> = {};

                    for (const lote of allLotes) {
                        const mat = allMateriales.find(m => m.id === lote.material_id);
                        if (mat) {
                            const key = normalizarNombre(mat.nombre);
                            if (!map[key]) map[key] = [];
                            map[key].push(lote);
                        }
                    }
                    setLotesPorMaterial(map);
                }
            } catch (err) {
                console.error("Error al cargar todos los lotes:", err);
            }
        })();
    }, [allMateriales]);

    return {
        expandedMaterials,
        lotesPorMaterial,
        loadingLotes,
        toggleExpand,
        fetchLotesForMaterial,
        setLotesPorMaterial,
    };
};
