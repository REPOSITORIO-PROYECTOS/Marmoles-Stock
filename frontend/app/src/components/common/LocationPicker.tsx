import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';

// Fix icon issue with Leaflet + React
// We need to delete the default icon config and re-assign it because webpack/vite can mess up the paths
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationPickerProps {
    onConfirm: (address: string, comuna?: string) => void;
    onCancel: () => void;
    initialCoordinates?: string; // Format: "lat, lng"
}

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (p: L.LatLng) => void }) {
    useMapEvents({
        click(e) {
            setPosition(e.latlng);
        },
    });

    return position === null ? null : (
        <Marker position={position}></Marker>
    )
}

function MapUpdater({ center }: { center: L.LatLng | null }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 16, { animate: true, duration: 0.8 });
        }
    }, [center, map]);
    return null;
}

function MapSizeInvalidator({ trigger }: { trigger: any }) {
    const map = useMap();
    useEffect(() => {
        const t = setTimeout(() => {
            try { map.invalidateSize(); } catch { }
        }, 200);
        return () => clearTimeout(t);
    }, [map, trigger]);
    return null;
}

export function LocationPicker({ onConfirm, onCancel, initialCoordinates }: LocationPickerProps) {
    const defaultCenter = new L.LatLng(-31.5373, -68.5252);
    const [position, setPosition] = useState<L.LatLng | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [googleReady, setGoogleReady] = useState(false);
    const placesKey = import.meta.env.VITE_GOOGLE_PLACES_KEY;
    const [mapReady, setMapReady] = useState(false);
    const mapDivRef = useRef<HTMLDivElement | null>(null);
    const gMapRef = useRef<any>(null);
    const gMarkerRef = useRef<any>(null);

    useEffect(() => {
        if (initialCoordinates) {
            const [lat, lng] = initialCoordinates.split(',').map(c => parseFloat(c.trim()));
            if (!isNaN(lat) && !isNaN(lng)) {
                setPosition(new L.LatLng(lat, lng));
            }
        }
    }, [initialCoordinates]);

    useEffect(() => {
        if (placesKey && !googleReady) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${placesKey}&libraries=places&language=es`;
            script.async = true;
            script.onload = () => {
                if ((window as any).google?.maps) {
                    setGoogleReady(true);
                } else {
                    setGoogleReady(false);
                }
            };
            script.onerror = () => setGoogleReady(false);
            document.head.appendChild(script);
        }
    }, [placesKey, googleReady]);

    useEffect(() => {
        if (googleReady && inputRef.current && (window as any).google?.maps?.places) {
            const autocomplete = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
                fields: ['formatted_address', 'geometry'],
                componentRestrictions: { country: ['ar'] }
            });
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                const geometry = place?.geometry?.location;
                if (geometry) {
                    const lat = geometry.lat();
                    const lng = geometry.lng();
                    setPosition(new L.LatLng(lat, lng));
                    setSearchQuery(place.formatted_address || '');
                    if (gMapRef.current) {
                        gMapRef.current.setCenter({ lat, lng });
                        if (!gMarkerRef.current) gMarkerRef.current = new (window as any).google.maps.Marker({ map: gMapRef.current });
                        gMarkerRef.current.setPosition({ lat, lng });
                    }
                }
            });
        }
    }, [googleReady]);

    useEffect(() => {
        if (googleReady && mapDivRef.current && !(gMapRef.current) && (window as any).google?.maps) {
            const lat = position?.lat || defaultCenter.lat;
            const lng = position?.lng || defaultCenter.lng;
            try {
                gMapRef.current = new (window as any).google.maps.Map(mapDivRef.current, {
                    center: { lat, lng },
                    zoom: 13,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                });
                gMarkerRef.current = new (window as any).google.maps.Marker({ position: { lat, lng }, map: gMapRef.current });
                gMapRef.current.addListener('click', (e: any) => {
                    const ll = new L.LatLng(e.latLng.lat(), e.latLng.lng());
                    setPosition(ll);
                    if (gMarkerRef.current) gMarkerRef.current.setPosition(e.latLng);
                });
                setMapReady(true);
            } catch {
                setGoogleReady(false);
            }
        }
    }, [googleReady, mapDivRef.current]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            // Append San Juan context to search
            const queryWithContext = `${searchQuery}, San Juan, Argentina`;

            // Expanded viewbox for better coverage of San Juan province
            const viewbox = "-69.5,-30.5,-67.5,-32.5";

            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryWithContext)}&viewbox=${viewbox}&bounded=1&addressdetails=1&limit=5&countrycodes=ar`, {
                headers: {
                    'Accept-Language': 'es',
                    'User-Agent': 'MarmolesApp/1.0'
                }
            });
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                setPosition(new L.LatLng(lat, lon));
                if (gMapRef.current) {
                    gMapRef.current.setCenter({ lat, lng: lon });
                    if (!gMarkerRef.current) gMarkerRef.current = new (window as any).google.maps.Marker({ map: gMapRef.current });
                    gMarkerRef.current.setPosition({ lat, lng: lon });
                }
            } else {
                // Fallback: search without extra context but with expanded bounds
                const resBackup = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=5&countrycodes=ar`, {
                    headers: { 'Accept-Language': 'es', 'User-Agent': 'MarmolesApp/1.0' }
                });
                const dataBackup = await resBackup.json();
                if (dataBackup && dataBackup.length > 0) {
                    const lat = parseFloat(dataBackup[0].lat);
                    const lon = parseFloat(dataBackup[0].lon);
                    setPosition(new L.LatLng(lat, lon));
                    if (gMapRef.current) {
                        gMapRef.current.setCenter({ lat, lng: lon });
                        if (!gMarkerRef.current) gMarkerRef.current = new (window as any).google.maps.Marker({ map: gMapRef.current });
                        gMarkerRef.current.setPosition({ lat, lng: lon });
                    }
                }
            }
        } catch (error) {
            console.error("Search error:", error);
            toast.error("No se pudo completar la búsqueda. Intenta de nuevo.");
        } finally {
            setIsSearching(false);
        }
    };

    const centerOnSanJuan = () => {
        setPosition(defaultCenter);
        if (gMapRef.current) {
            gMapRef.current.setCenter({ lat: defaultCenter.lat, lng: defaultCenter.lng });
            if (!gMarkerRef.current) gMarkerRef.current = new (window as any).google.maps.Marker({ map: gMapRef.current });
            gMarkerRef.current.setPosition({ lat: defaultCenter.lat, lng: defaultCenter.lng });
        }
    };

    const handleConfirm = async () => {
        if (!position) return;
        setLoading(true);
        try {
            // Reverse Geocoding using Nominatim (OSM)
            // Note: Nominatim requires a User-Agent header
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.lat}&lon=${position.lng}`, {
                headers: {
                    'Accept-Language': 'es',
                    'User-Agent': 'MarmolesApp/1.0'
                }
            });
            const data = await res.json();

            let address = data.display_name;
            let comuna = '';

            // Try to construct a cleaner address if possible
            if (data.address) {
                const parts = [];
                if (data.address.road) parts.push(data.address.road);
                if (data.address.house_number) parts.push(data.address.house_number);

                if (parts.length > 0) address = parts.join(', ');

                // Extract Comuna (city/town/village/suburb)
                comuna = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
            }

            // Append coordinates to address to ensure exact location is preserved
            const exactAddress = `${address} [${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}]`;
            onConfirm(exactAddress, comuna);
        } catch (e) {
            console.error("Geocoding error", e);
            toast.error("No se pudo obtener la dirección. Usando coordenadas.");
            // Fallback to coordinates
            onConfirm(`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col gap-4 ${isExpanded ? 'fixed inset-0 z-[9999] bg-white p-4' : 'h-[70vh] w-full'}`}>
            <div className="relative flex-1 rounded-md overflow-hidden border h-full">
                {/* Search Bar Overlay */}
                <div className="absolute top-2 left-2 right-2 z-[1000] flex gap-2">
                    <form onSubmit={handleSearch} className="flex-1 flex gap-2 bg-white/90 p-2 rounded-lg shadow-md backdrop-blur-sm">
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 h-9 bg-white"
                            autoFocus
                            ref={inputRef}
                        />
                        <Button type="submit" size="sm" variant="default" disabled={isSearching} className="h-9 w-9 p-0">
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </form>
                </div>

                {/* San Juan Reset Button */}
                <div className="absolute top-16 left-2 z-[1000]">
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="bg-white/90 shadow-md backdrop-blur-sm text-xs h-8"
                        onClick={centerOnSanJuan}
                    >
                        Centrar en San Juan
                    </Button>
                </div>

                {/* Expand/Collapse Button */}
                <div className="absolute top-16 right-2 z-[1000]">
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="bg-white/90 shadow-md backdrop-blur-sm h-8 w-8 p-0"
                        onClick={() => setIsExpanded(!isExpanded)}
                        title={isExpanded ? "Minimizar mapa" : "Expandir mapa"}
                    >
                        {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </div>

                {googleReady && (window as any).google?.maps ? (
                    <div ref={mapDivRef} className={`${isExpanded ? 'h-[80vh]' : 'h-[60vh]'} w-full`} />
                ) : (
                    <MapContainer
                        center={position || defaultCenter}
                        zoom={13}
                        scrollWheelZoom={true}
                        className={`${isExpanded ? 'h-[80vh]' : 'h-[60vh]'} w-full`}
                        whenReady={() => setMapReady(true)}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />
                        <LocationMarker position={position} setPosition={setPosition} />
                        <MapUpdater center={position} />
                        <MapSizeInvalidator trigger={`${mapReady}-${isExpanded}-${position?.lat}-${position?.lng}`} />
                    </MapContainer>
                )}

                {!mapReady && (
                    <div className="absolute inset-0 z-[500] bg-white/60 backdrop-blur-sm flex items-center justify-center">
                        <div className="w-2/3 h-2/3 bg-gray-200 rounded-lg animate-pulse" />
                    </div>
                )}

                {!position && (
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-white/90 px-3 py-1 rounded-full text-xs shadow-md z-[1000] pointer-events-none">
                        Haz clic en el mapa para seleccionar una ubicación
                    </div>
                )}
            </div>
            <div className="flex justify-between items-center bg-white p-2 rounded-md sticky bottom-0 border-t">
                <div className="text-xs text-muted-foreground">
                    {position ? `Lat: ${position.lat.toFixed(4)}, Lng: ${position.lng.toFixed(4)}` : 'Ninguna ubicación seleccionada'}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
                    <Button size="sm" onClick={handleConfirm} disabled={!position || loading}>
                        {loading ? 'Obteniendo dirección...' : 'Usar esta ubicación'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
