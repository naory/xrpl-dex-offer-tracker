import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import * as d3 from 'd3';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

interface Offer {
  id: number;
  offer_id: string;
  account: string;
  taker_gets_currency: string;
  taker_gets_value: string;
  taker_pays_currency: string;
  taker_pays_value: string;
  price: string;
  updated_at: string;
}

interface OfferChartProps {
  selectedPair: string;
}

const OfferChart: React.FC<OfferChartProps> = ({ selectedPair }) => {
  const chartRef = useRef<SVGSVGElement>(null);
  const [chartType, setChartType] = useState<'price' | 'volume'>('price');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');

  // Fetch offers data
  const { data: offers, isLoading, error } = useQuery({
    queryKey: ['offers', selectedPair],
    queryFn: async (): Promise<Offer[]> => {
      const response = await fetch('http://localhost:3001/offers');
      if (!response.ok) {
        throw new Error('Failed to fetch offers');
      }
      return response.json();
    },
  });

  // D3.js Chart Creation
  useEffect(() => {
    if (!offers || !chartRef.current) return;

    const svg = d3.select(chartRef.current);
    svg.selectAll('*').remove(); // Clear previous chart

    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Process data for visualization
    const processedData = offers
      .filter(offer => 
        offer.taker_gets_currency === 'XRP' || offer.taker_pays_currency === 'XRP'
      )
      .slice(0, 50) // Limit for performance
      .map((offer, index) => ({
        x: index,
        y: parseFloat(offer.price),
        price: parseFloat(offer.price),
        volume: parseFloat(offer.taker_gets_value),
        currency: offer.taker_gets_currency,
        account: offer.account,
        offer_id: offer.offer_id,
      }));

    if (processedData.length === 0) return;

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, processedData.length - 1])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(processedData, d => chartType === 'price' ? d.price : d.volume) as [number, number])
      .nice()
      .range([height, 0]);

    // Create gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'areaGradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', height)
      .attr('x2', 0).attr('y2', 0);

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#3b82f6')
      .attr('stop-opacity', 0.1);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#3b82f6')
      .attr('stop-opacity', 0.6);

    // Line generator
    const line = d3.line<any>()
      .x(d => xScale(d.x))
      .y(d => yScale(chartType === 'price' ? d.price : d.volume))
      .curve(d3.curveCardinal);

    // Area generator
    const area = d3.area<any>()
      .x(d => xScale(d.x))
      .y0(height)
      .y1(d => yScale(chartType === 'price' ? d.price : d.volume))
      .curve(d3.curveCardinal);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat(() => ''))
      .selectAll('text')
      .style('fill', '#94a3b8');

    g.append('g')
      .call(d3.axisLeft(yScale).tickFormat(d3.format('.2s')))
      .selectAll('text')
      .style('fill', '#94a3b8');

    // Add area with animation
    const areaPath = g.append('path')
      .datum(processedData)
      .attr('fill', 'url(#areaGradient)')
      .attr('d', area);

    // Animate area
    const totalLength = areaPath.node()?.getTotalLength() || 0;
    areaPath
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);

    // Add line with animation
    const linePath = g.append('path')
      .datum(processedData)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Animate line
    const lineLength = linePath.node()?.getTotalLength() || 0;
    linePath
      .attr('stroke-dasharray', `${lineLength} ${lineLength}`)
      .attr('stroke-dashoffset', lineLength)
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);

    // Add interactive dots
    const tooltip = d3.select('body').append('div')
      .style('position', 'absolute')
      .style('padding', '10px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('border-radius', '5px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .attr('class', 'tooltip');

    g.selectAll('.dot')
      .data(processedData)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(chartType === 'price' ? d.price : d.volume))
      .attr('r', 4)
      .style('fill', '#3b82f6')
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 6)
          .style('fill', '#60a5fa');

        tooltip.transition()
          .duration(200)
          .style('opacity', 1);

        tooltip.html(`
          <strong>Price:</strong> ${d.price.toFixed(6)}<br/>
          <strong>Volume:</strong> ${d.volume.toFixed(2)} ${d.currency}<br/>
          <strong>Account:</strong> ${d.account.slice(0, 10)}...
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 4)
          .style('fill', '#3b82f6');

        d3.selectAll('.tooltip').remove();
      });

  }, [offers, chartType]);

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="component-header">
          <div className="component-title">
            <BarChart3 style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
            <h3>{selectedPair} Chart</h3>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '384px' }}>
          <div className="loading-shimmer" style={{ height: '16px', width: '128px' }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-container">
        <div className="component-header">
          <div className="component-title">
            <BarChart3 style={{ width: '20px', height: '20px', color: '#ef4444' }} />
            <h3>{selectedPair} Chart</h3>
          </div>
        </div>
        <div className="no-data">
          <div className="no-data-icon">📈</div>
          <div className="no-data-title">Failed to load chart data</div>
          <div className="no-data-subtitle">Please try again later</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="chart-container"
    >
      {/* Chart Header */}
      <div className="component-header">
        <div className="component-title">
          <BarChart3 style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
          <h3>{selectedPair} {chartType === 'price' ? 'Price' : 'Volume'} Chart</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Chart Type Toggle */}
          <div className="btn-group">
            <button
              onClick={() => setChartType('price')}
              className={`btn-toggle ${chartType === 'price' ? 'active' : ''}`}
            >
              Price
            </button>
            <button
              onClick={() => setChartType('volume')}
              className={`btn-toggle ${chartType === 'volume' ? 'active' : ''}`}
            >
              Volume
            </button>
          </div>

          {/* Time Range Toggle */}
          <div className="btn-group">
            {['1h', '24h', '7d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={`btn-toggle ${timeRange === range ? 'active purple' : ''}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart SVG */}
      <div style={{ position: 'relative' }}>
        <svg 
          ref={chartRef} 
          style={{ 
            width: '100%', 
            height: '384px',
            borderRadius: '8px',
            background: 'rgba(15, 23, 42, 0.3)'
          }}
        />
        
        {/* Chart Stats */}
        <div className="chart-stats">
          <div className="chart-stat-card">
            <div className="chart-stat-header">
              <TrendingUp className="chart-stat-icon" style={{ color: '#10b981' }} />
              <span className="chart-stat-label">24h High</span>
            </div>
            <div className="chart-stat-value">
              {offers && offers.length > 0 
                ? Math.max(...offers.map(o => parseFloat(o.price))).toFixed(6)
                : '--'
              }
            </div>
          </div>
          
          <div className="chart-stat-card">
            <div className="chart-stat-header">
              <TrendingDown className="chart-stat-icon" style={{ color: '#ef4444' }} />
              <span className="chart-stat-label">24h Low</span>
            </div>
            <div className="chart-stat-value">
              {offers && offers.length > 0 
                ? Math.min(...offers.map(o => parseFloat(o.price))).toFixed(6)
                : '--'
              }
            </div>
          </div>
          
          <div className="chart-stat-card">
            <div className="chart-stat-header">
              <span className="chart-stat-label">Total Offers</span>
            </div>
            <div className="chart-stat-value">
              {offers?.length || 0}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default OfferChart; 