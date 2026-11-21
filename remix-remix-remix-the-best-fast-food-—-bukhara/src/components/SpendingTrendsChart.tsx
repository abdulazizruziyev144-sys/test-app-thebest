import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { TrendingUp } from 'lucide-react';
import { translate } from '../data/i18n';
import { formatMoney, normalizeLiveStatus } from '../lib/calculations';
import { Lang, Order } from '../types';

interface SpendingTrendsChartProps {
  lang: Lang;
  orders: Order[];
}

interface ChartPoint {
  index: number;
  orderId: string;
  label: string;
  fullDate: string;
  amount: number;
}

export const SpendingTrendsChart: React.FC<SpendingTrendsChartProps> = ({ lang, orders }) => {
  const t = (k: string) => translate(lang, k);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points: ChartPoint[] = useMemo(() => {
    const nonDeclined = orders.filter((o) => normalizeLiveStatus(o.status) !== 'declined');
    const source = (nonDeclined.length > 0 ? nonDeclined : orders).slice(-5);
    return source.map((o, idx) => {
      const parsed = Date.parse(o.createdAt);
      const dt = Number.isFinite(parsed) ? new Date(parsed) : new Date();
      const shortDate = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return {
        index: idx,
        orderId: o.id,
        label: `#${idx + 1} · ${shortDate}`,
        fullDate: dt.toLocaleString(),
        amount: Math.max(0, Math.round(o.totals?.total || 0)),
      };
    });
  }, [orders]);

  const width = 540;
  const height = 180;
  const margin = { top: 18, right: 20, bottom: 30, left: 48 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const { xScale, yScale, linePath, areaPath, yTicks } = useMemo(() => {
    const maxVal = d3.max(points, (d) => d.amount) ?? 0;
    const yMax = maxVal > 0 ? Math.ceil(maxVal * 1.15) : 100000;

    const x = d3
      .scalePoint<number>()
      .domain(points.map((p) => p.index))
      .range([0, innerW])
      .padding(points.length === 1 ? 0.5 : 0.15);

    const y = d3.scaleLinear().domain([0, yMax]).nice(4).range([innerH, 0]);

    const lineGen = d3
      .line<ChartPoint>()
      .x((d) => x(d.index) ?? 0)
      .y((d) => y(d.amount))
      .curve(d3.curveMonotoneX);

    const areaGen = d3
      .area<ChartPoint>()
      .x((d) => x(d.index) ?? 0)
      .y0(innerH)
      .y1((d) => y(d.amount))
      .curve(d3.curveMonotoneX);

    return {
      xScale: x,
      yScale: y,
      linePath: points.length >= 2 ? lineGen(points) || '' : '',
      areaPath: points.length >= 2 ? areaGen(points) || '' : '',
      yTicks: y.ticks(4),
    };
  }, [points, innerW, innerH]);

  if (points.length === 0) return null;

  const totalSpent = points.reduce((sum, p) => sum + p.amount, 0);
  const avgSpent = Math.round(totalSpent / points.length);
  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="border border-[#191919]/10 rounded-xl p-4 sm:p-5 bg-white shadow-xs space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#5C5346] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#D8961D]" />
            <span>
              {t('Spending trends')} · {t('Last 5 orders')}
            </span>
          </div>
          {activePoint && (
            <div className="mt-1 text-xs text-[#5C5346] tabular-nums">
              <span className="font-mono font-bold text-[#B67A0E]">
                {formatMoney(activePoint.amount)}
              </span>{' '}
              · {activePoint.orderId.slice(0, 12)}… ({activePoint.fullDate})
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-[11px] text-[#5C5346]">{t('Total spent')}</div>
            <div className="font-mono text-xs font-bold text-[#191919] tabular-nums">
              {formatMoney(totalSpent)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#5C5346]">{t('Average')}</div>
            <div className="font-mono text-xs font-bold text-[#B67A0E] tabular-nums">
              {formatMoney(avgSpent)}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#FAF8F3] border border-[#191919]/10 rounded-lg p-2 sm:p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label="Spending trends over the last 5 orders"
        >
          <defs>
            <linearGradient id="spendingAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E9A92F" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#E9A92F" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Horizontal grid lines & Y axis labels */}
            {yTicks.map((tick) => {
              const yPos = yScale(tick);
              const label = tick === 0 ? '0' : `${Math.round(tick / 1000)}K`;
              return (
                <g key={tick} transform={`translate(0, ${yPos})`}>
                  <line x1={0} x2={innerW} stroke="rgba(25,25,25,0.08)" strokeDasharray="3 3" />
                  <text
                    x={-8}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-[#5C5346] text-[10px] font-mono"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Area fill & Line path */}
            {areaPath && <path d={areaPath} fill="url(#spendingAreaGrad)" />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#D8961D"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points & X axis labels */}
            {points.map((pt) => {
              const cx = xScale(pt.index) ?? 0;
              const cy = yScale(pt.amount);
              const isSelected = activePoint?.index === pt.index;
              return (
                <g key={pt.orderId}>
                  <text
                    x={cx}
                    y={innerH + 18}
                    textAnchor="middle"
                    className="fill-[#5C5346] text-[10px] font-mono"
                  >
                    {pt.label}
                  </text>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 6 : 4.5}
                    fill={isSelected ? '#191919' : '#E9A92F'}
                    stroke="#FAF8F3"
                    strokeWidth={2}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredIdx(pt.index)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => setHoveredIdx(pt.index)}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};
