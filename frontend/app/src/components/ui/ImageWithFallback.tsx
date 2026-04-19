import { useState } from 'react';

interface ImageWithFallbackProps {
    src: string;
    alt: string;
    className?: string;
    fallback?: React.ReactNode;
}

export function ImageWithFallback({ src, alt, className, fallback }: ImageWithFallbackProps) {
    const [error, setError] = useState(false);

    if (error) {
        return fallback || (
            <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
                <span className="text-sm">Error al cargar imagen</span>
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            onError={() => setError(true)}
        />
    );
}
