import React from 'react';
import { Input } from '../../../components/ui/input';
import { Search } from 'lucide-react';

interface MaterialFiltersProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
}

export const MaterialFilters: React.FC<MaterialFiltersProps> = ({
    searchTerm,
    onSearchChange,
}) => {
    return (
        <div className="mb-6 bg-muted/20 p-4 rounded-lg border flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar material..."
                    className="h-8 text-sm"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>
        </div>
    );
};
