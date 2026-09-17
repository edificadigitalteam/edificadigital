import { useState } from 'react'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { curveMonotoneX } from '@visx/curve'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleLinear, scaleTime } from '@visx/scale'
import { Line, LinePath } from '@visx/shape'

import { chartCopy } from '../chartCopy.js'
import { chartTheme } from '../chartTheme.js'
import { formatDate, formatNumber, formatShortDate, metricDisplay } from '../indicatorFormat.js'
import { CHART_HEIGHT, CHART_MARGIN, axisTickCount, innerSize, valueDomain } from './chartFrame.js'

function pointDate(value) {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value)
}

function TrendPlot({ width, indicator, series, language, options }) {
  const t = chartCopy[language] || chartCopy.es
  const [active, setActive] = useState(null)
  const { innerWidth, innerHeight } = innerSize(width)
  const points = series.points.filter((point) => point.value != null && point.date)
  if (points.length < 2) return null

  const reference = options.referenceLine === 'target' ? series.target : options.referenceLine === 'average' ? series.average : null
  const referenceLabel = options.referenceLine === 'target' ? t.target : t.average

  const xScale = scaleTime({
    domain: [pointDate(points[0].date), pointDate(points[points.length - 1].date)],
    range: [0, innerWidth],
  })
  const yScale = scaleLinear({
    domain: valueDomain([...points.map((point) => point.value), reference]),
    range: [innerHeight, 0],
    nice: true,
  })

  const lastPoint = points[points.length - 1]
  const activePoint = points.find((point) => point.id === active) || null

  return (
    <div className="indicator-chart-plot">
      <svg width={width} height={CHART_HEIGHT} role="presentation">
        <Group left={CHART_MARGIN.left} top={CHART_MARGIN.top}>
          {yScale.ticks(4).map((tick) => (
            <Line key={tick} from={{ x: 0, y: yScale(tick) }} to={{ x: innerWidth, y: yScale(tick) }} stroke={chartTheme.grid} strokeWidth={1} />
          ))}

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

          <LinePath
            data={points}
            x={(point) => xScale(pointDate(point.date))}
            y={(point) => yScale(point.value)}
            stroke={chartTheme.categorical[0]}
            strokeWidth={chartTheme.markWidth}
            curve={curveMonotoneX}
            fill="none"
          />

          {points.map((point) => {
            const isLast = point.id === lastPoint.id
            return (
              <circle
                key={point.id}
                cx={xScale(pointDate(point.date))}
                cy={yScale(point.value)}
                r={isLast ? chartTheme.pointRadius + 1.5 : chartTheme.pointRadius}
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

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={axisTickCount(innerWidth)}
            tickFormat={(value) => formatShortDate(new Date(value).toISOString(), language)}
            stroke={chartTheme.grid}
            tickStroke={chartTheme.grid}
            tickLabelProps={() => ({ fill: chartTheme.mutedInk, fontSize: 10, textAnchor: 'middle', dy: '0.25em' })}
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
        <p className="indicator-chart-tooltip" style={{ left: `${CHART_MARGIN.left + xScale(pointDate(activePoint.date))}px` }}>
          <b>{metricDisplay(activePoint.value, indicator, language)}</b>
          <span>{formatDate(activePoint.date, language)}</span>
        </p>
      )}
    </div>
  )
}

export default function TrendLine({ indicator, series, language, options }) {
  return (
    <ParentSize debounceTime={16} parentSizeStyles={{ width: '100%', height: CHART_HEIGHT }}>
      {({ width }) => (width < 10 ? null : <TrendPlot width={width} indicator={indicator} series={series} language={language} options={options} />)}
    </ParentSize>
  )
}
