// Admin navigation: one list used by the sidebar and the header title.
import { Palette, Smartphone, Wrench, Zap, Cpu, ClipboardList, BarChart3 } from 'lucide-react';

export const NAV_SECTIONS = [
    {
        title: 'Production',
        items: [
            { id: 'task', label: 'Studio', emoji: '🎨', Icon: Palette },
            { id: 'apps', label: 'Apps & Clients', emoji: '📱', Icon: Smartphone },
            { id: 'builder', label: 'Tool Builder', emoji: '🛠️', Icon: Wrench },
            { id: 'tools', label: 'Tools', emoji: '⚡', Icon: Zap }
        ]
    },
    {
        title: 'Fleet',
        items: [
            { id: 'workers', label: 'Workers', emoji: '⚙️', Icon: Cpu },
            { id: 'features', label: 'Catalog', emoji: '📋', Icon: ClipboardList },
            { id: 'usage', label: 'API Usage', emoji: '📊', Icon: BarChart3 }
        ]
    }
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);
