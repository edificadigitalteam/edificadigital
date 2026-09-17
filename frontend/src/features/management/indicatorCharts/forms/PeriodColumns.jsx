import { useState } from 'react'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { curveMonotoneX } from '@visx/curve'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { BarRounded, Line, LinePath } from '@visx/shape'

import { chartCopy } from '../chartCopy.js'
import { chartTheme } from '../chartTheme.js'
import { formatDate, formatNumber, formatShortDate, metricDisplay } from '../indicatorFormat.js'
import { CHART_HEIGHT, CHART_MARGIN, innerSize, spacedTickValues, valueDomain } from './chartFrame.js'

function ColumnsPlot({ width, indicator, series, language, options }) {
  const t = chartCopy[language] || chartCopy.es
  const [active, setActive] = useState(null)
  const { innerWidth, innerHeight } = innerSize(width)
  const points = series.points.filter((point) => point.value != null)
  if (!points.length) return null

  const showCumulative = Boolean(options.cumulativeLine)
  const reference = options.referenceLine === 'target' ? series.target : options.referenceLine === 'average' ? series.average : null
  const referenceLabel = options.referenceLine === 'target' ? t.target : t.average

  const xScale = scaleBand({
    domain: points.map((point) => point.id),
    range: [0, innerWidth],
    padding: points.length > 8 ? 0.2 : 0.35,
  })
  const yScale = scaleLinear({
    domain: valueDomain([
      ...points.map((point) => point.value),
      ...(showCumulative ? points.map((point) => point.cumulative) : []),
      reference,
    ]),
    range: [innerHeight, 0],
    nice: true,
  })

  const activePoint = points.find((point) => point.id === active) || null
  const barWidth = xScale.bandwidth()

  return (
    <div className="indicator-chart-plot">
      <svg width={width} height={CHART_HEIGHT} role="presentation">
        <Group left={CHART_MARGIN.left} top={CHART_MARGIN.top}>
          {yScale.ticks(4).map((tick) => (
            <Line key={tick} from={{ x: 0, y: yScale(tick) }} to={{ x: innerWidth, y: yScale(tick) }} stroke={chartTheme.grid} strokeWidth={1} />
          ))}

          {points.map((point) => {
            const height = Math.max(innerHeight - yScale(point.value), 0)
            return (
              <BarRounded
                key={point.id}
                x={xScale(point.id)}
                y={yScale(point.value)}
                width={barWidth}
                height={height}
                radius={chartTheme.markRadius}
                top
                fill={chartTheme.categorical[0]}
                stroke={chartTheme.surface}
                strokeWidth={chartTheme.spacer}
                tabIndex={0}
                role="button"
                aria-label={`${formatDate(point.date, language)}: ${metricDisplay(point.value, indicator, language)}`}
                onMouseEnter={() => setActive(point.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(point.id)}
                onBlur={() => setActive(null)}
                onKeyDown={(event) => { if (event.key === 'Escape') setActive(null) }}
              />
            )
          })}

          {showCumulative && (
            <LinePath
              data={points}
              x={(point) => xScale(point.id) + barWidth / 2}
              y={(point) => yScale(point.cumulative)}
              stroke={chartTheme.categorical[2]}
              strokeWidth={chartTheme.markWidth}
              curve={curveMonotoneX}
              fill="none"
            />
          )}

          {reference != null && (
            <>
              <Line
                from={{ x: 0, y: yScale(reference) }}
                to={{ x: innerWidth, y: yScale(reference) }}
                stroke={chartTheme.categorical[1]}
                strokeWidth={chartTheme.markWidth}
                strokeDasharray="5 4"
              />
              <text x={0} y={yScale(reference) - 7} textAnchor="start" className="indicator-chart-reference-label">
                {referenceLabel}: {metricDisplay(reference, indicator, language)}
              </text>
            </>
          )}

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            tickFormat={(id) => {
              const point = points.find((item) => item.id === id)
              return point ? formatShortDate(point.date, language) : ''
            }}
            stroke={chartTheme.grid}
            tickStroke={chartTheme.grid}
            tickLabelProps={() => ({ fill: chartTheme.mutedInk, fontSize: 10, textAnchor: 'middle', dy: '0.25em' })}
            tickValues={spacedTickValues(points.map((point) => point.id), innerWidth)}
          />
          <AxisLeft
            scale={yScale}
            numTicks={4}
            tickFormat={(value) => formatNumber(value, language)}
            stroke={chartTheme.grid}
            tickStroke={chartTheme.grid}
            tickLabelProps={() => ({ fill: chartTheme.mutedInk, fontSize: 10, textAnchor: 'end', dx: '-0.3em', dy: '0.3em' })}
          />
        </Group>
      </svg>

      {activePoint && (
        <p className="indicator-chart-tooltip" style={{ left: `${CHART_MARGIN.left + xScale(activePoint.id) + barWidth / 2}px` }}>
          <b>{metricDisplay(activePoint.value, indicator, language)}</b>
          <span>{formatDate(activePoint.date, language)}</span>
        </p>
      )}
    </div>
  )
}

export default function PeriodColumns({ indicator, series, language, options }) {
  const t = chartCopy[language] || chartCopy.es
  return (
    <>
      <ParentSize debounceTime={16} parentSizeStyles={{ width: '100%', height: CHART_HEIGHT }}>
        {({ width }) => (width < 10 ? null : <ColumnsPlot width={width} indicator={indicator} series={series} language={language} options={options} />)}
      </ParentSize>

      {options.cumulativeLine && (
        <p className="indicator-chart-legend">
          <span><i style={{ background: chartTheme.categorical[0] }} aria-hidden="true" />{t.value}</span>
          <span><i style={{ background: chartTheme.categorical[2] }} aria-hidden="true" />{t.cumulative}</span>
        </p>
      )}
    </>
  )
}
