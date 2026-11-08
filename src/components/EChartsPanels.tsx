import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { ProjectSummaryMetrics } from '../domain/contracts';
import { Table, BarChart3 } from 'lucide-react';

export const DeliveryActivityChart: React.FC<{
  metrics: ProjectSummaryMetrics;
  darkMode: boolean;
}> = ({ metrics, darkMode }) => {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (showTable || !chartRef.current) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }
    const chart = instanceRef.current;

    const textColor = darkMode ? '#d4e4fa' : '#202938';
    const gridBorderColor = darkMode ? '#3a4c68' : '#b2bccb';
    const labels = metrics.dailyActivity30d.map((d) => d.label);
    const createdData = metrics.dailyActivity30d.map((d) => d.created);
    const completedData = metrics.dailyActivity30d.map((d) => d.completed);

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: darkMode ? '#142644' : '#1b3661',
        borderColor: '#7ea2d4',
        textStyle: { color: '#eef6ff', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' },
      },
      legend: {
        data: ['Tickets Created', 'Tickets Completed'],
        top: 4,
        right: 10,
        textStyle: { color: textColor, fontSize: 11, fontWeight: 600 },
      },
      grid: {
        left: 38,
        right: 16,
        top: 36,
        bottom: 28,
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: gridBorderColor } },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          fontFamily: 'IBM Plex Mono, monospace',
          interval: 3,
        },
      },
      yAxis: {
        type: 'value',
        name: 'Tickets',
        minInterval: 1,
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLine: { show: true, lineStyle: { color: gridBorderColor } },
        splitLine: { lineStyle: { color: gridBorderColor, type: 'dashed', opacity: 0.45 } },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          fontFamily: 'IBM Plex Mono, monospace',
        },
      },
      series: [
        {
          name: 'Tickets Created',
          type: 'bar',
          data: createdData,
          barMaxWidth: 10,
          itemStyle: {
            color: darkMode ? '#6096dc' : '#2f5a99',
            borderRadius: [2, 2, 0, 0],
          },
        },
        {
          name: 'Tickets Completed',
          type: 'bar',
          data: completedData,
          barMaxWidth: 10,
          itemStyle: {
            color: darkMode ? '#3cd093' : '#178556',
            borderRadius: [2, 2, 0, 0],
          },
        },
      ],
    });

    const ro = new ResizeObserver(() => {
      chart.resize();
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
    };
  }, [metrics, darkMode, showTable]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return (
    <div className="sg-section-panel flex flex-col overflow-hidden">
      <div className="sg-metal-bar px-3.5 py-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold tracking-tight m-0">
            30-Day Delivery Activity (UTC Daily Intervals)
          </h3>
          <p className="text-[11px] opacity-75 m-0">
            Comparing daily tickets created vs. completed across authoritative UTC server timestamps
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="sg-btn text-[11px] py-1 px-2.5"
          aria-pressed={showTable}
        >
          {showTable ? (
            <>
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Show Chart View</span>
            </>
          ) : (
            <>
              <Table className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Accessible Table View</span>
            </>
          )}
        </button>
      </div>

      <div className="p-3 flex-1">
        {showTable ? (
          <div className="max-h-[230px] overflow-y-auto border border-[var(--sg-edge)] rounded">
            <table className="sg-table" aria-label="30-Day Delivery Activity Tabular Equivalent">
              <thead>
                <tr>
                  <th>UTC Date</th>
                  <th className="text-right">Tickets Created</th>
                  <th className="text-right">Tickets Completed</th>
                </tr>
              </thead>
              <tbody>
                {metrics.dailyActivity30d
                  .slice()
                  .reverse()
                  .map((row) => (
                    <tr key={row.dateUtc}>
                      <td className="font-mono">{row.dateUtc}</td>
                      <td className="font-mono text-right tabular-nums">{row.created}</td>
                      <td className="font-mono text-right tabular-nums">{row.completed}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            ref={chartRef}
            className="w-full h-[230px]"
            role="img"
            aria-label="30-day grouped bar chart of tickets created and completed"
          />
        )}
      </div>
    </div>
  );
};

export const TicketDistributionChart: React.FC<{
  metrics: ProjectSummaryMetrics;
  intakeEnabled: boolean;
  darkMode: boolean;
}> = ({ metrics, intakeEnabled, darkMode }) => {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }
    const chart = instanceRef.current;
    const textColor = darkMode ? '#d4e4fa' : '#202938';

    const dist = metrics.statusDistribution;
    const data = [
      { value: dist.Created, name: 'Created (Intake)', itemStyle: { color: '#7a8ba3' } },
      { value: dist.Backlog, name: 'Backlog', itemStyle: { color: '#3b68a8' } },
      { value: dist['In Progress'], name: 'In Progress', itemStyle: { color: '#2490d1' } },
      { value: dist['In Review'], name: 'In Review', itemStyle: { color: '#d9822b' } },
      { value: dist.Done, name: 'Done', itemStyle: { color: '#1b9e68' } },
    ];

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
        backgroundColor: darkMode ? '#142644' : '#1b3661',
        borderColor: '#7ea2d4',
        textStyle: { color: '#eef6ff', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' },
      },
      legend: {
        orient: 'vertical',
        right: 6,
        top: 'middle',
        textStyle: { color: textColor, fontSize: 11, fontFamily: 'Plus Jakarta Sans, sans-serif' },
      },
      series: [
        {
          name: 'Ticket Lifecycle State',
          type: 'pie',
          radius: ['46%', '74%'],
          center: ['34%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: darkMode ? '#1a2742' : '#eef1f6',
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'inside',
            formatter: (params: { value: number }) => (params.value > 0 ? String(params.value) : ''),
            color: '#ffffff',
            fontWeight: 'bold',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
          },
          data,
        },
      ],
    });

    const ro = new ResizeObserver(() => {
      chart.resize();
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
    };
  }, [metrics, darkMode]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return (
    <div className="sg-section-panel flex flex-col overflow-hidden">
      <div className="sg-metal-bar px-3.5 py-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold tracking-tight m-0">
            Ticket Lifecycle Distribution
          </h3>
          <p className="text-[11px] opacity-75 m-0">
            {intakeEnabled
              ? 'Pre-backlog Created intake state is active for this project'
              : 'Intake state disabled: new tickets enter Backlog directly (Created = 0, no double-counting)'}
          </p>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between">
        <div
          ref={chartRef}
          className="w-full h-[195px]"
          role="img"
          aria-label="Donut chart of ticket status distribution across Created, Backlog, In Progress, In Review, and Done"
        />
        <div className="grid grid-cols-5 gap-1 pt-2 border-t border-[var(--background-modifier-border)] text-center font-mono text-[11px]">
          <div>
            <div className="opacity-70">Created</div>
            <div className="font-bold tabular-nums">{metrics.statusDistribution.Created}</div>
          </div>
          <div>
            <div className="opacity-70">Backlog</div>
            <div className="font-bold tabular-nums">{metrics.statusDistribution.Backlog}</div>
          </div>
          <div>
            <div className="opacity-70">In Prog</div>
            <div className="font-bold tabular-nums">{metrics.statusDistribution['In Progress']}</div>
          </div>
          <div>
            <div className="opacity-70">Review</div>
            <div className="font-bold tabular-nums">{metrics.statusDistribution['In Review']}</div>
          </div>
          <div>
            <div className="opacity-70">Done</div>
            <div className="font-bold tabular-nums">{metrics.statusDistribution.Done}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
