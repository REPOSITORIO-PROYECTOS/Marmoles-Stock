import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Star, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface EncuestaData {
    ya_completada: boolean;
    fecha_completada?: string;
    mensaje?: string;
    cliente?: string;
    trabajo_id?: string;
}

export function EncuestaPublica() {
    const { token } = useParams<{ token: string }>();
    const [encuesta, setEncuesta] = useState<EncuestaData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form state
    const [conformidad, setConformidad] = useState<boolean | null>(null);
    const [calificacion, setCalificacion] = useState(0);
    const [comentarios, setComentarios] = useState('');
    const [nombreReceptor, setNombreReceptor] = useState('');

    useEffect(() => {
        fetchEncuesta();
    }, [token]);

    const fetchEncuesta = async () => {
        try {
            const res = await fetch(`/api/logistica/encuesta/${token}`);
            if (!res.ok) throw new Error('Encuesta no encontrada');
            const data = await res.json();
            setEncuesta(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (conformidad === null || calificacion === 0 || !nombreReceptor.trim()) {
            alert('Por favor completa todos los campos obligatorios');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/logistica/encuesta/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    conformidad,
                    calificacion,
                    comentarios: comentarios.trim() || '',
                    nombre_quien_recibe: nombreReceptor.trim()
                })
            });

            if (!res.ok) throw new Error('Error al enviar encuesta');

            setSubmitted(true);
        } catch (err) {
            console.error(err);
            alert('Error al enviar la encuesta. Por favor intenta nuevamente.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-gray-600">Cargando encuesta...</p>
                </div>
            </div>
        );
    }

    if (!encuesta) {
        return (
            <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                <Card className="w-full max-w-sm border-red-200 bg-white shadow-lg">
                    <CardContent className="p-6 md:p-8 text-center">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold mb-2 text-gray-900">Encuesta no encontrada</h2>
                        <p className="text-gray-600">El enlace podría estar vencido o ser inválido</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (encuesta.ya_completada || submitted) {
        return (
            <div className="flex h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
                <Card className="w-full max-w-sm border-green-200 bg-white shadow-lg">
                    <CardContent className="p-6 md:p-8 text-center">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold mb-2 text-gray-900">¡Encuesta completada!</h2>
                        <p className="text-gray-600 mb-2">Gracias por tu tiempo</p>
                        {encuesta.fecha_completada && (
                            <p className="text-sm text-gray-500">
                                Completada el {new Date(encuesta.fecha_completada).toLocaleDateString('es-ES')}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-6 md:py-12 px-4">
            <Card className="w-full max-w-2xl mx-auto shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 md:p-8 rounded-t-lg">
                    <CardTitle className="text-2xl md:text-3xl font-bold">Encuesta de Satisfacción</CardTitle>
                    <p className="text-sm md:text-base opacity-90 mt-2">
                        Cliente: <span className="font-semibold">{encuesta.cliente}</span>
                    </p>
                </CardHeader>

                <CardContent className="p-6 md:p-8 space-y-8">
                    {/* Pregunta 1: Conformidad */}
                    <div className="space-y-4">
                        <div>
                            <Label className="text-base md:text-lg font-bold text-gray-900 block mb-3">
                                1. ¿Recibiste conforme el trabajo? <span className="text-red-500">*</span>
                            </Label>
                            <div className="flex gap-3">
                                <Button
                                    variant={conformidad === true ? 'default' : 'outline'}
                                    className="flex-1 h-auto py-3 md:py-4 text-base md:text-lg font-semibold transition-all"
                                    onClick={() => setConformidad(true)}
                                >
                                    <span className="text-xl mr-2">✓</span> Sí, conforme
                                </Button>
                                <Button
                                    variant={conformidad === false ? 'destructive' : 'outline'}
                                    className="flex-1 h-auto py-3 md:py-4 text-base md:text-lg font-semibold transition-all"
                                    onClick={() => setConformidad(false)}
                                >
                                    <span className="text-xl mr-2">✗</span> No conforme
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Pregunta 2: Calificación */}
                    <div className="space-y-4">
                        <div>
                            <Label className="text-base md:text-lg font-bold text-gray-900 block mb-4">
                                2. Calidad del trabajo <span className="text-red-500">*</span>
                            </Label>
                            <div className="flex gap-3 justify-center">
                                {[1, 2, 3, 4, 5].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => setCalificacion(num)}
                                        className="transition-all active:scale-90 hover:scale-110"
                                        title={`Calificación: ${num} estrella${num !== 1 ? 's' : ''}`}
                                    >
                                        <Star
                                            className={`h-10 w-10 md:h-12 md:w-12 transition-all ${num <= calificacion
                                                    ? 'fill-yellow-400 text-yellow-400'
                                                    : 'text-gray-300 hover:text-gray-400'
                                                }`}
                                        />
                                    </button>
                                ))}
                            </div>
                            {calificacion > 0 && (
                                <p className="text-center text-sm md:text-base text-gray-600 mt-3 font-medium">
                                    Puntuación: {calificacion}/{5} estrella{calificacion !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Pregunta 3: Nombre */}
                    <div className="space-y-3">
                        <Label htmlFor="nombre" className="text-base md:text-lg font-bold text-gray-900 block">
                            3. Tu nombre <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="nombre"
                            value={nombreReceptor}
                            onChange={(e) => setNombreReceptor(e.target.value)}
                            placeholder="Nombre completo"
                            className="h-12 md:h-14 text-base md:text-lg"
                        />
                    </div>

                    {/* Pregunta 4: Comentarios */}
                    <div className="space-y-3">
                        <Label htmlFor="comentarios" className="text-base md:text-lg font-bold text-gray-900 block">
                            4. Comentarios adicionales (opcional)
                        </Label>
                        <Textarea
                            id="comentarios"
                            value={comentarios}
                            onChange={(e) => setComentarios(e.target.value)}
                            placeholder="¿Algo que quieras comentar? Sugerencias, problemas, etc."
                            rows={3}
                            className="text-base md:text-lg resize-none"
                        />
                    </div>

                    {/* Botón Submit */}
                    <div className="pt-6 border-t border-gray-200">
                        <Button
                            className="w-full h-12 md:h-14 text-base md:text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                            onClick={handleSubmit}
                            disabled={submitting || conformidad === null || calificacion === 0 || !nombreReceptor.trim()}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                '✓ Enviar Encuesta'
                            )}
                        </Button>
                        <p className="text-xs md:text-sm text-gray-500 text-center mt-3">
                            Los campos marcados con <span className="text-red-500">*</span> son obligatorios
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
