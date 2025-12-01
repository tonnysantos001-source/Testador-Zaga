import { motion } from 'framer-motion';
import './StatsDisplay.css';

interface StatsDisplayProps {
    live: number;
    die: number;
    unknown: number;
    activeFilter: 'all' | 'live' | 'die' | 'unknown';
    onFilterChange: (filter: 'all' | 'live' | 'die' | 'unknown') => void;
}

export default function StatsDisplay({ live, die, unknown, activeFilter, onFilterChange }: StatsDisplayProps) {
    const stats = [
        {
            label: 'All',
            value: live + die + unknown,
            color: '#6b7280',
            filter: 'all' as const
        },
        {
            label: 'Live',
            value: live,
            color: '#10b981',
            filter: 'live' as const
        },
        {
            label: 'Die',
            value: die,
            color: '#ef4444',
            filter: 'die' as const
        },
        {
            label: 'Unknown',
            value: unknown,
            color: '#6b7280',
            filter: 'unknown' as const
        }
    ];

    return (
        <div className="stats-display">
            {stats.map((stat, index) => (
                <motion.button
                    key={stat.label}
                    className={`stat-card glass ${activeFilter === stat.filter ? 'active' : ''}`}
                    onClick={() => onFilterChange(stat.filter)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <div className="stat-label" style={{ color: stat.color }}>
                        {stat.label}
                    </div>
                    <motion.div
                        className="stat-value"
                        key={stat.value}
                        initial={{ scale: 1 }}
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.3 }}
                    >
                        {stat.value}
                    </motion.div>
                </motion.button>
            ))}
        </div>
    );
}
