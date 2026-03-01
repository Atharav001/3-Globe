import React, { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { io, Socket } from 'socket.io-client';
import { AlertTriangle, Activity, Map as MapIcon, ShieldAlert, Crosshair, Terminal, Zap, ExternalLink, Radar, Search } from 'lucide-react';

interface ThreatEvent {
  id: string;
  source: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  lat: number;
  lng: number;
  timestamp: string;
}

interface Arc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string[];
  altitude: number;
}

const severityColors = {
  low: '#22c55e',      // Green
  medium: '#f59e0b',   // Orange
  high: '#ef4444',     // Red
  critical: '#ff0000'  // Pure Red
};

const getAngularDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const rLat1 = lat1 * Math.PI / 180;
  const rLat2 = lat2 * Math.PI / 180;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 180 / Math.PI;
};

const App: React.FC = () => {
  const globeRef = useRef<any>();
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ThreatEvent | null>(null);
  const [time, setTime] = useState<string>('');
  const [glitchText, setGlitchText] = useState('SYSTEM ONLINE');
  const [showComments, setShowComments] = useState(true);
  const [pov, setPov] = useState({ lat: 0, lng: 0, altitude: 2 });
  const [leftEvents, setLeftEvents] = useState<ThreatEvent[]>([]);
  const [rightEvents, setRightEvents] = useState<ThreatEvent[]>([]);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showHUD, setShowHUD] = useState(true);
  const [timeRange, setTimeRange] = useState(100);
  const [activeLayer, setActiveLayer] = useState('ALL');
  const [countries, setCountries] = useState<any>({ features: [] });
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = React.useMemo(() => {
    let result = events;
    if (activeLayer !== 'ALL') {
      result = result.filter(e => {
        const src = e.source.toUpperCase();
        if (activeLayer === 'NEWS') return src.includes('LIVEUAMAP') || src.includes('OSINT') || src.includes('REUTERS') || src.includes('NEWS');
        if (activeLayer === 'FINANCE') return src.includes('DEFENSETICKER') || src.includes('MARKET') || src.includes('STOCK');
        if (activeLayer === 'RADAR') return src.includes('FLIGHTRADAR') || src.includes('FLIGHT');
        return true;
      });
    }
    const maxIndex = Math.max(0, Math.floor((result.length * timeRange) / 100));
    return timeRange === 100 ? result : result.slice(0, maxIndex);
  }, [events, activeLayer, timeRange]);

  useEffect(() => {
    if (!showComments) {
      setLeftEvents([]);
      setRightEvents([]);
      return;
    }
    const active = filteredEvents.filter(e => getAngularDistance(e.lat, e.lng, pov.lat, pov.lng) < 60).reverse().slice(0, 8);

    const left: ThreatEvent[] = [];
    const right: ThreatEvent[] = [];

    active.forEach(e => {
      let dx = e.lng - pov.lng;
      if (dx > 180) dx -= 360;
      if (dx < -180) dx += 360;
      if (dx <= 0) left.push(e);
      else right.push(e);
    });

    setLeftEvents(left.slice(0, 4));
    setRightEvents(right.slice(0, 4));
  }, [filteredEvents, pov, showComments]);

  useEffect(() => {
    let reqId: number;
    const loop = () => {
      [...leftEvents, ...rightEvents].forEach(ev => {
        const marker = document.getElementById(`globe-marker-${ev.id}`);
        const box = document.getElementById(`comment-box-${ev.id}`);
        const line = document.getElementById(`svg-line-${ev.id}`);
        if (marker && box && line) {
          const mRect = marker.getBoundingClientRect();
          const bRect = box.getBoundingClientRect();
          line.setAttribute('x1', (mRect.left + mRect.width / 2).toString());
          line.setAttribute('y1', (mRect.top + mRect.height / 2).toString());

          const isLeft = bRect.left < window.innerWidth / 2;
          line.setAttribute('x2', (isLeft ? bRect.right : bRect.left).toString());
          line.setAttribute('y2', (bRect.top + bRect.height / 2).toString());
        }
      });
      reqId = requestAnimationFrame(loop);
    };
    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, [leftEvents, rightEvents]);

  useEffect(() => {
    // Clock timer
    const timer = setInterval(() => {
      setTime(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    }, 1000);

    // POV tracker for tracking center point of screen
    const povTimer = setInterval(() => {
      if (globeRef.current) setPov((globeRef.current as any).pointOfView());
    }, 300);

    return () => {
      clearInterval(timer);
      clearInterval(povTimer);
    };
  }, []);



  useEffect(() => {
    const socket: Socket = io('http://localhost:4000');

    socket.on('initial-events', (initialEvents: ThreatEvent[]) => {
      setEvents(initialEvents);
    });

    socket.on('new-event', (newEvent: ThreatEvent) => {
      setEvents(prev => {
        const updated = [...prev, newEvent];
        return updated.length > 100 ? updated.slice(updated.length - 100) : updated;
      });

      // Generate a dynamic arc showing an "attack vector" / data stream to the event
      const originLat = (Math.random() - 0.5) * 120;
      const originLng = (Math.random() - 0.5) * 360;
      const color = severityColors[newEvent.severity as keyof typeof severityColors];

      const newArc: Arc = {
        startLat: originLat,
        startLng: originLng,
        endLat: newEvent.lat,
        endLng: newEvent.lng,
        color: ['rgba(0, 240, 255, 0.1)', color], // Fades from faint cyan to event color
        altitude: 0.15 + Math.random() * 0.3
      };

      setArcs(prev => [...prev, newArc].slice(-20)); // Keep last 20 arcs ringing the globe

      if (newEvent.severity === 'critical' || newEvent.severity === 'high') {
        const textOptions = ['THREAT DETECTED', 'ANOMALY FOUND', 'DATA INTERCEPTED'];
        setGlitchText(textOptions[Math.floor(Math.random() * textOptions.length)]);
        setTimeout(() => setGlitchText('SYSTEM ONLINE'), 3000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(setCountries);
  }, []);

  useEffect(() => {
    if (globeRef.current && !selectedEvent && autoRotate) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
    } else if (globeRef.current) {
      globeRef.current.controls().autoRotate = false;
    }
  }, [selectedEvent, filteredEvents, autoRotate]);

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] overflow-hidden font-sans text-white touch-none select-none">
      {/* FIXED SPACE BACKGROUND */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-2]" style={{ backgroundImage: 'url(//unpkg.com/three-globe/example/img/night-sky.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minWidth: '100vw', minHeight: '100vh' }}></div>
      <div className="scanlines"></div>
      <div className="vignette"></div>

      {/* 3D GLOBE ENGINE - Centered perfectly to the viewport */}
      <div className="absolute inset-0 cursor-crosshair pointer-events-auto flex items-center justify-center">
        <Globe
          ref={globeRef}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          // Removed backgroundImageUrl so it stays transparent and doesn't shrink on zoom
          atmosphereColor="#2a2a2a"
          atmosphereAltitude={0.15}

          // Arcs Configuration
          arcsData={arcs}
          arcStartLat={(d: any) => d.startLat}
          arcStartLng={(d: any) => d.startLng}
          arcEndLat={(d: any) => d.endLat}
          arcEndLng={(d: any) => d.endLng}
          arcColor={(d: any) => d.color}
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={1200}
          arcAltitude={(d: any) => d.altitude}
          arcStroke={0.6}

          // Threat Points
          pointsData={filteredEvents}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d: any) => severityColors[d.severity as keyof typeof severityColors]}
          pointAltitude={(d: any) => {
            switch (d.severity) {
              case 'critical': return 0.08;
              case 'high': return 0.05;
              case 'medium': return 0.02;
              default: return 0.01;
            }
          }}
          pointRadius={(d: any) => {
            switch (d.severity) {
              case 'critical': return 1.2;
              case 'high': return 0.9;
              case 'medium': return 0.6;
              default: return 0.4;
            }
          }}
          pointsMerge={false}
          pointResolution={24}

          // Expanding Threat Rings
          ringsData={filteredEvents.filter(e => e.severity === 'critical' || e.severity === 'high')}
          ringColor={(d: any) => severityColors[d.severity as keyof typeof severityColors]}
          ringMaxRadius={(d: any) => d.severity === 'critical' ? 5 : 3}
          ringPropagationSpeed={2}
          ringRepeatPeriod={1000}

          // Tracking dots (for SVG lines to connect to)
          htmlElementsData={[...leftEvents, ...rightEvents]}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.06}
          htmlElement={(d: any) => {
            const el = document.createElement('div');
            el.id = `globe-marker-${d.id}`;
            const color = severityColors[d.severity as keyof typeof severityColors];
            el.innerHTML = `<div style="width: 8px; height: 8px; background: ${color}; border-radius: 50%; box-shadow: 0 0 10px ${color}; margin-top: -4px; margin-left: -4px;"></div>`;
            el.style.pointerEvents = 'none';
            return el;
          }}

          // Interactive Country Drill-Downs
          polygonsData={countries.features}
          polygonAltitude={0.005}
          polygonCapColor={(d: any) => {
            // Find matching events inside this country's bounding box roughly (or by name match)
            const countryName = d.properties.ADMIN || '';
            const match = filteredEvents.some(e => e.title.toLowerCase().includes(countryName.toLowerCase()) || e.source.toLowerCase().includes(countryName.toLowerCase()));
            return match ? 'rgba(255, 0, 60, 0.1)' : 'rgba(200, 200, 200, 0.01)';
          }}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => '#00f0ff10'}
          onPolygonClick={({ properties: d }) => {
            const countryName = d.ADMIN;
            setSearchQuery(countryName);
            // Rough match
            const match = filteredEvents.find(e => e.title.toLowerCase().includes(countryName.toLowerCase()) || e.source.toLowerCase().includes(countryName.toLowerCase()));
            if (match) {
              setSelectedEvent(match);
              globeRef.current.pointOfView({ lat: match.lat, lng: match.lng, altitude: 0.8 }, 1500);
            }
          }}

          onPointClick={(point: any) => {
            setSelectedEvent(point);
            globeRef.current.pointOfView({ lat: point.lat, lng: point.lng, altitude: 0.8 }, 1500);
          }}
          onGlobeClick={() => setSelectedEvent(null)}
        />
      </div>

      {/* MASTER CINEMATIC TOGGLE & BOTTOM SCROLLING TICKER */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-[#0a0a0a] border-t border-[#2a2a2a] flex items-center z-[100] overflow-hidden">
        <div className="flex-shrink-0 bg-[#ff0000] text-black px-4 py-3 h-full flex items-center font-bold text-xs tracking-widest z-10">
          <span className="animate-pulse mr-2">●</span> LIVE
        </div>

        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          <div className="whitespace-nowrap flex gap-12 text-xs font-mono text-gray-400 absolute left-full animate-[ticker_30s_linear_infinite]">
            {filteredEvents.slice(0, 10).map((ev, i) => (
              <span key={`ticker-${i}`} className="inline-flex items-center gap-2">
                <span style={{ color: severityColors[ev.severity] }}>[{ev.severity}]</span>
                <span className="text-white">{ev.title.replace(/\[|\]/g, '')}</span>
                <span className="text-gray-600 mx-4">|</span>
              </span>
            ))}
            {filteredEvents.length === 0 && (
              <span className="text-gray-500">AWAITING INTEL... LISTENING ON SECURE CHANNELS...</span>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowHUD(!showHUD)}
          className={`flex-shrink-0 px-6 h-full flex items-center border-l whitespace-nowrap text-xs font-bold font-mono transition-all cursor-pointer ${!showHUD ? 'border-[#0a0a0a] text-black bg-[#22c55e]' : 'border-[#2a2a2a] text-gray-500 hover:text-white hover:bg-[#2a2a2a]'}`}
        >
          {showHUD ? '[ HIDE HUD ]' : '[ SHOW HUD ]'}
        </button>
      </div>

      {/* TIMELINE SLIDER */}
      {showHUD && (
        <div className="fixed bottom-16 left-[280px] w-[calc(100%-800px)] z-[200] flex flex-col gap-2 bg-[#0a0a0a] p-3 rounded-none border border-[#2a2a2a]">
          <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono font-bold tracking-widest">
            <span>T-MINUS 24H</span>
            <span className="text-white">TIME SYNC</span>
            <span className="text-[#22c55e]">LIVE</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="w-full h-1 bg-[#2a2a2a] rounded-none appearance-none cursor-pointer accent-[#22c55e] hover:accent-white transition-all"
          />
        </div>
      )}

      {/* TOP NAVIGATION HUD (WORLD MONITOR STYLE) */}
      {showHUD && (
        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/90 to-transparent z-[150] flex items-start justify-between px-8 pt-4 pointer-events-none">
          {/* Top Left Title */}
          <div className="flex flex-col items-start pointer-events-auto">
            <h1 className="text-2xl font-bold tracking-[0.3em] text-white m-0 p-0 leading-none">THREAT MONITOR</h1>
            <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1 ml-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-risk-low rounded-full animate-pulse"></span>
              GLOBAL SYS ONLINE
            </p>
          </div>

          {/* Centered Navigation Removed */}

          {/* Top Right Clock */}
          <div className="pointer-events-auto flex flex-col items-end">
            <div className="text-[10px] font-mono text-white tracking-widest px-3 py-1.5 border border-[#2a2a2a] bg-[#0a0a0a] flex items-center gap-2">
              <Terminal className="w-3 h-3 text-gray-500" />
              {time}
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR CONTROLS */}
      {showHUD && (
        <div className="absolute top-20 left-4 flex flex-col gap-3 pointer-events-none z-50">
          <div className="bg-[#0a0a0a] p-4 pointer-events-auto flex flex-col w-64 gap-3 font-mono text-xs border border-[#2a2a2a]">
            <div className="text-gray-400 mb-1 border-b border-[#2a2a2a] pb-2 uppercase tracking-widest">SYS_CONTROLS</div>

            <div className="flex justify-between items-center text-[#ff0000] font-bold pt-1 text-[10px] border border-[#ff0000] p-2 bg-[#ff0000]/10">
              <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> STAT</span>
              <span className="pulse-critical">{glitchText}</span>
            </div>

            <button
              onClick={() => setShowComments(!showComments)}
              className={`mt-2 py-2 flex items-center justify-center w-full text-[10px] font-bold transition-all pointer-events-auto cursor-pointer border ${showComments ? 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10' : 'border-[#2a2a2a] text-gray-400 hover:text-white hover:border-gray-500 bg-[#0a0a0a]'}`}
            >
              <div className="flex items-center justify-center gap-2">
                {showComments ? <Activity className="w-3 h-3" /> : <Activity className="w-3 h-3 opacity-50" />}
                {showComments ? '[ HIDE COMMENTS ]' : '[ SHOW COMMENTS ]'}
              </div>
            </button>
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`py-2 flex items-center justify-center w-full text-[10px] font-bold transition-all pointer-events-auto cursor-pointer border ${autoRotate ? 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10' : 'border-[#2a2a2a] text-gray-400 hover:text-white hover:border-gray-500 bg-[#0a0a0a]'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <Radar className={`w-3 h-3 ${autoRotate ? 'animate-spin' : 'opacity-50'}`} />
                {autoRotate ? '[ PAUSE ORBIT ]' : '[ RESUME ORBIT ]'}
              </div>
            </button>
          </div>

          {/* THE WALL ELEMENTS SUGGESTION */}
          <div className="bg-[#0a0a0a] p-4 pointer-events-auto flex flex-col w-64 gap-3 font-mono text-xs border border-[#2a2a2a]">
            <div className="text-gray-400 mb-1 border-b border-[#2a2a2a] pb-2 uppercase tracking-widest flex justify-between">
              <span>THE WALL APP</span>
              <span className="text-[#f59e0b] bg-[#f59e0b]/20 px-1 border border-[#f59e0b] text-[8px]">PROPOSED</span>
            </div>
            <div className="text-[10px] text-gray-500 leading-relaxed mb-2">
              Future integrations for this panel:
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white border-l-2 border-[#22c55e] pl-2">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span> Live Webcams (EarthCams)
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white border-l-2 border-[#00f0ff] pl-2">
              <span className="w-2 h-2 rounded-full bg-[#00f0ff]"></span> Sentinel-2 Sat Imagery
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white border-l-2 border-[#f59e0b] pl-2">
              <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span> Pentagon Press Releases
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white border-l-2 border-[#ff0000] pl-2">
              <span className="w-2 h-2 rounded-full bg-[#ff0000]"></span> OSINT Telegram Scraper
            </div>
          </div>
        </div>
      )}

      {/* INTEL COMMENTS OVERLAY (STATIONARY BOXES + SVG LINES) */}
      {showComments && (
        <div className="absolute inset-0 pointer-events-none z-[60]">
          <svg className="absolute inset-0 w-full h-full">
            {[...leftEvents, ...rightEvents].map(ev => (
              <line
                key={`line-${ev.id}`}
                id={`svg-line-${ev.id}`}
                stroke={severityColors[ev.severity as keyof typeof severityColors]}
                strokeWidth="1.5"
                opacity="0.8"
              />
            ))}
          </svg>

          <div className="absolute left-[19rem] top-1/2 transform -translate-y-1/2 flex flex-col gap-6 pointer-events-none mt-20">
            {leftEvents.map(ev => (
              <div
                key={`box-${ev.id}`}
                id={`comment-box-${ev.id}`}
                className="p-3 w-48 pointer-events-auto"
                style={{
                  border: `1px solid ${severityColors[ev.severity as keyof typeof severityColors]}40`,
                  borderTop: `3px solid ${severityColors[ev.severity as keyof typeof severityColors]}`,
                  background: 'rgba(0,0,0,0.85)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 5px 20px rgba(0,0,0,0.9)',
                }}
              >
                <div style={{ color: severityColors[ev.severity as keyof typeof severityColors], fontSize: '9px', marginBottom: '5px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  ▶ CLASS // {ev.severity}
                </div>
                <div style={{ whiteSpace: 'normal', lineHeight: '1.4', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ev.title.replace(/\[|\]/g, '')}
                </div>
              </div>
            ))}
          </div>

          <div className="absolute right-[26rem] top-1/2 transform -translate-y-1/2 flex flex-col gap-6 pointer-events-none">
            {rightEvents.map(ev => (
              <div
                key={`box-${ev.id}`}
                id={`comment-box-${ev.id}`}
                className="p-3 w-48 pointer-events-auto"
                style={{
                  border: `1px solid ${severityColors[ev.severity as keyof typeof severityColors]}40`,
                  borderTop: `3px solid ${severityColors[ev.severity as keyof typeof severityColors]}`,
                  background: 'rgba(0,0,0,0.85)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 5px 20px rgba(0,0,0,0.9)',
                }}
              >
                <div style={{ color: severityColors[ev.severity as keyof typeof severityColors], fontSize: '9px', marginBottom: '5px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  ▶ CLASS // {ev.severity}
                </div>
                <div style={{ whiteSpace: 'normal', lineHeight: '1.4', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ev.title.replace(/\[|\]/g, '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RIGHT SIDEBAR CONTROLS & INTEL FEED (Now stacked neatly without overlap) */}
      {showHUD && (
        <div className="absolute top-20 right-4 w-96 bottom-16 flex flex-col gap-4 pointer-events-none z-[150]">

          {/* Top Info Box */}
          <div className="bg-[#0a0a0a] p-4 pointer-events-auto flex flex-col gap-4 border border-[#2a2a2a] shrink-0">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-3">
              <div className="text-left">
                <h2 className="text-[10px] text-gray-400 font-mono tracking-widest mb-1">GLOBAL RISK INDEX</h2>
                <p className={`text-2xl font-bold font-mono ${filteredEvents.filter(e => e.severity === 'critical' || e.severity === 'high').length > 5 ? 'text-[#ff0000]' : 'text-[#f59e0b]'} hud-text`}>
                  {filteredEvents.filter(e => e.severity === 'critical' || e.severity === 'high').length > 5 ? 'DEFCON 3' : 'ELEVATED'}
                </p>
              </div>
              <Activity className={`w-8 h-8 ${filteredEvents.filter(e => e.severity === 'critical' || e.severity === 'high').length > 5 ? 'text-[#ff0000]' : 'text-[#f59e0b]'}`} />
            </div>

            <div className="w-full relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="SEARCH LOC / ENTITY"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const match = filteredEvents.find(ev => ev.title.toLowerCase().includes(searchQuery.toLowerCase()) || ev.source.toLowerCase().includes(searchQuery.toLowerCase()));
                    if (match) {
                      setSelectedEvent(match);
                      globeRef.current.pointOfView({ lat: match.lat, lng: match.lng, altitude: 0.8 }, 1500);
                    }
                  }
                }}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] pl-9 pr-3 py-2 text-[10px] uppercase font-mono text-white outline-none focus:border-white transition-all pointer-events-auto"
              />
            </div>

            <div className="flex flex-wrap gap-1 pointer-events-auto relative z-50">
              {['ALL', 'NEWS', 'FINANCE', 'RADAR'].map(layer => (
                <button
                  key={layer}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveLayer(layer);
                  }}
                  className={`flex-1 px-2 py-1.5 text-[9px] min-w-[20%] font-bold font-mono transition-all cursor-pointer border ${activeLayer === layer ? 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10' : 'border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#2a2a2a] bg-[#0a0a0a]'}`}
                >
                  {layer}
                </button>
              ))}
            </div>
          </div>

          {/* Details Overlay (Takes up intel feed space when active) */}
          <div className={`transition-all duration-300 transform w-full h-full absolute inset-0 pt-48 ${selectedEvent ? 'translate-x-0 opacity-100 z-50' : 'translate-x-[120%] opacity-0 z-[-1] pointer-events-none'}`}>
            {selectedEvent && (
              <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-6 h-full pointer-events-auto flex flex-col" style={{ borderTop: `4px solid ${severityColors[selectedEvent.severity]}` }}>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold px-2 py-1 bg-black border" style={{ color: severityColors[selectedEvent.severity], borderColor: severityColors[selectedEvent.severity] }}>
                    CLASS: {selectedEvent.severity}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1"><Terminal className="w-3 h-3" /> {new Date(selectedEvent.timestamp).toLocaleTimeString()}</span>
                </div>

                <h3 className="text-sm font-bold mt-2 text-white leading-tight font-mono break-all">{selectedEvent.title.replace(/\[|\]/g, '')}</h3>
                <p className="text-xs text-gray-400 mt-4 leading-relaxed tracking-wide lowercase overflow-y-auto flex-1">{selectedEvent.description}</p>

                <div className="mt-4 pt-4 border-t border-[#2a2a2a] flex flex-col gap-2 text-[9px] font-mono text-gray-500 shrink-0">
                  <span className="flex items-center gap-2"><MapIcon className="w-3 h-3 text-[#22c55e]" /> LOC_REF: {selectedEvent.lat.toFixed(4)}, {selectedEvent.lng.toFixed(4)}</span>
                  <span className="flex items-center gap-2 uppercase"><Activity className="w-3 h-3" /> STREAM SECURE</span>
                </div>

                <button
                  onClick={() => setSelectedEvent(null)}
                  className="w-full mt-4 py-2 font-mono text-[10px] font-bold border border-[#2a2a2a] hover:border-[#22c55e] hover:text-[#22c55e] bg-transparent transition-all shrink-0"
                >
                  [ CLOSE INTERCEPT ]
                </button>
              </div>
            )}
          </div>

          {/* Live Event Stream */}
          <div className={`bg-[#0a0a0a] border border-[#2a2a2a] flex-1 flex flex-col pointer-events-auto overflow-hidden transition-opacity ${selectedEvent ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="p-3 border-b border-[#2a2a2a] flex justify-between items-center bg-[#111]">
              <h3 className="font-bold flex items-center gap-2 text-xs tracking-widest text-[#22c55e]">
                <Zap className="w-3 h-3" /> INTEL FEED
              </h3>
              <span className="text-[9px] border border-[#22c55e] text-[#22c55e] px-1 py-0.5 font-mono">{filteredEvents.length} PKTS</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {[...filteredEvents].reverse().map(event => (
                <div
                  key={event.id}
                  onClick={() => {
                    setSelectedEvent(event);
                    globeRef.current.pointOfView({ lat: event.lat, lng: event.lng, altitude: 0.8 }, 1500);
                  }}
                  className="p-3 border border-[#2a2a2a] hover:border-gray-500 bg-black cursor-pointer transition-all border-l-2 group relative"
                  style={{ borderLeftColor: severityColors[event.severity] }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] tracking-widest font-bold" style={{ color: severityColors[event.severity] }}>
                      STREAM 0x{event.id.toUpperCase()}
                    </span>
                    <span className="text-[8px] font-mono text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-300 uppercase tracking-widest line-clamp-2 leading-relaxed break-all">{event.title.replace(/\[|\]/g, '')}</p>
                </div>
              ))}
              {filteredEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-[#22c55e] text-opacity-50 text-[10px] gap-2 p-8 text-center border border-dashed border-[#22c55e]/30 m-4">
                  <Radar className="w-6 h-6 animate-spin" />
                  NO DATA RECEIVED YET. WAITING FOR SECURE INTEL STREAM...
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default App;
