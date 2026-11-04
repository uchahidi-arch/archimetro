import type { SymbolShape } from '@/data/qualifiers';

interface Props {
  shape: SymbolShape;
  r?: number;
  color: string;
  fill?: string;
  strokeWidth?: number;
}

/** Symbole d'une station, centré sur (0,0). À placer dans un <svg>. */
export default function Symbol({ shape, r = 12, color, fill = 'var(--bg)', strokeWidth = 4 }: Props) {
  const common = { fill, stroke: color, strokeWidth } as const;

  switch (shape) {
    case 'ring':
      return (
        <>
          <circle r={r} {...common} />
          <circle r={r * 0.42} fill={color} />
        </>
      );
    case 'dot':
      return <circle r={r} {...common} />;
    case 'square':
      return <rect x={-r * 0.9} y={-r * 0.9} width={r * 1.8} height={r * 1.8} rx={2} {...common} />;
    case 'diamond':
      return <rect x={-r * 0.8} y={-r * 0.8} width={r * 1.6} height={r * 1.6} transform="rotate(45)" {...common} />;
    case 'triangle': {
      const h = r * 1.15;
      return <polygon points={`0,${-h} ${h},${h * 0.8} ${-h},${h * 0.8}`} strokeLinejoin="round" {...common} />;
    }
    case 'hex': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        return `${(Math.cos(a) * r * 1.1).toFixed(2)},${(Math.sin(a) * r * 1.1).toFixed(2)}`;
      }).join(' ');
      return <polygon points={pts} strokeLinejoin="round" {...common} />;
    }
    case 'half': {
      const ri = Math.max(r - strokeWidth, 2);
      return (
        <>
          <circle r={r} {...common} />
          <path d={`M 0 ${-ri} A ${ri} ${ri} 0 0 0 0 ${ri} Z`} fill={color} />
        </>
      );
    }
    case 'bar':
      return <rect x={-r * 1.3} y={-r * 0.7} width={r * 2.6} height={r * 1.4} rx={r * 0.7} {...common} />;
  }
}
