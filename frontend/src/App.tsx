import React, { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { io, Socket } from 'socket.io-client';
import { AlertTriangle, Activity, Map as MapIcon, ShieldAlert, Crosshair, Terminal, Zap, ExternalLink, Radar } from 'lucide-react';

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
  low: '#00f0ff',      // Neon Cyan
  medium: '#facc15',   // Neon Yellow
  high: '#ff003c',     // Neon Pink
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
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white touch-none select-none">
      <div className="scanlines"></div>
      <div className="vignette"></div>

      {/* 3D GLOBE ENGINE */}
      <div className="absolute inset-0 cursor-crosshair" style={{ transform: 'translateX(-8%)' }}>
        <Globe
          ref={globeRef}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          atmosphereColor="#00f0ff"
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

      {/* MASTER CINEMATIC TOGGLE */}
      <div className="absolute bottom-6 left-6 z-[100]">
        <button
          onClick={() => setShowHUD(!showHUD)}
          className={`px-4 py-2 text-xs font-bold font-mono border transition-all cursor-pointer backdrop-blur-sm ${!showHUD ? 'border-[#00f0ff] text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20' : 'border-white/20 text-gray-500 hover:text-white hover:border-white/50 bg-black/50'}`}
        >
          {showHUD ? '[ HIDE OVERLAYS ]' : '[ SHOW OVERLAYS ]'}
        </button>
      </div>

      {/* TIMELINE SLIDER */}
      {showHUD && (
        <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 w-[400px] z-[200] shadow-2xl glass-panel p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] text-[#00f0ff] font-mono font-bold tracking-widest">
            <span>T-MINUS 24H</span>
            <span>LIVE</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
          />
        </div>
      )}

      {/* TOP LEFT COMMAND CENTER STATS */}
      {showHUD && (
        <div className="absolute top-6 left-6 flex flex-col gap-4 pointer-events-none z-50">
          <div className="glass-panel p-5 pointer-events-auto flex items-center gap-5 w-80">
            <div className="relative">
              <ShieldAlert className="w-10 h-10 text-risk-critical pulse-critical relative z-10" />
              <Crosshair className="w-16 h-16 text-risk-critical/30 absolute -top-3 -left-3 spin-slow" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-[0.2em] text-[#00f0ff] hud-text m-0 p-0 leading-tight">AEGIS COMMAND</h1>
              <p className="text-xs text-gray-400 font-mono tracking-widest mt-1">GLOBAL THREAT DB</p>
            </div>
          </div>

          <div className="glass-panel p-4 pointer-events-auto flex flex-col w-80 gap-2 font-mono text-sm">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="text-gray-500">SYS_TIME</span>
              <span className="text-[#00f0ff]">{time}</span>
            </div>
            <div className="flex justify-between items-center text-risk-critical font-bold pt-1">
              <span>STATUS</span>
              <span className="pulse-critical">{glitchText}</span>
            </div>
            <button
              onClick={() => setShowComments(!showComments)}
              className={`mt-4 py-2 w-full text-xs font-bold border transition-all pointer-events-auto cursor-pointer ${showComments ? 'border-[#00f0ff] text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20' : 'border-white/20 text-gray-500 hover:text-white hover:border-white/50'}`}
            >
              {showComments ? '[ HIDE INTEL COMMENTS ]' : '[ SHOW INTEL COMMENTS ]'}
            </button>
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`mt-2 py-2 w-full text-xs font-bold border transition-all pointer-events-auto cursor-pointer ${autoRotate ? 'border-[#00f0ff] text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20' : 'border-white/20 text-gray-500 hover:text-white hover:border-white/50'}`}
            >
              {autoRotate ? '[ PAUSE ORBIT ]' : '[ RESUME ORBIT ]'}
            </button>
          </div>
        </div>
      )}

      {/* TOP RIGHT GLOBAL THREAT INDEX & SEARCH */}
      {showHUD && (
        <div className="absolute top-6 right-6 pointer-events-none z-[150] flex flex-col gap-4 items-end w-80">
          <div className="glass-panel p-5 pointer-events-auto flex items-center gap-5 w-fit">
            <div className="text-right">
              <h2 className="text-[10px] text-gray-500 tracking-[0.3em] mb-1">GLOBAL RISK INDEX</h2>
              <p className={`text-3xl font-bold font-mono ${filteredEvents.filter(e => e.severity === 'critical' || e.severity === 'high').length > 5 ? 'text-risk-critical' : 'text-risk-medium'} hud-text`}>
                {filteredEvents.filter(e => e.severity === 'critical' || e.severity === 'high').length > 5 ? 'DEFCON 3' : 'ELEVATED'}
              </p>
            </div>
            <div className="h-12 w-[1px] bg-white/10 mx-2"></div>
            <Activity className={`w-10 h-10 ${filteredEvents.filter(e => e.severity === 'critical' || e.severity === 'high').length > 5 ? 'text-risk-critical' : 'text-risk-medium'}`} />
          </div>

          <div className="w-full flex">
            <input
              type="text"
              placeholder="SEARCH LOCATION / ENTITY..."
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
              className="w-full bg-black/50 border border-white/20 px-3 py-2 text-[10px] uppercase font-mono text-[#00f0ff] outline-none focus:border-[#00f0ff] backdrop-blur-sm placeholder-gray-600 transition-all pointer-events-auto"
            />
          </div>

          <div className="flex gap-2 pointer-events-auto">
            {['ALL', 'NEWS', 'FINANCE', 'RADAR'].map(layer => (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                className={`px-3 py-1 text-[10px] font-bold font-mono border transition-all cursor-pointer backdrop-blur-sm ${activeLayer === layer ? 'border-[#00f0ff] text-[#00f0ff] bg-[#00f0ff]/20 shadow-[0_0_10px_#00f0ff50]' : 'border-white/20 text-gray-500 hover:text-white hover:border-white/50 bg-black/50'}`}
              >
                {layer}
              </button>
            ))}
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

          <div className="absolute left-[3%] top-1/2 transform -translate-y-1/2 flex flex-col gap-6 pointer-events-none mt-20">
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
                  ▶ SRC // {ev.severity}
                </div>
                <div style={{ whiteSpace: 'normal', lineHeight: '1.4', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ev.title.replace(/\[|\]/g, '')}
                </div>
              </div>
            ))}
          </div>

          <div className="absolute right-[22rem] top-1/2 transform -translate-y-1/2 flex flex-col gap-6 pointer-events-none">
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
                  ▶ SRC // {ev.severity}
                </div>
                <div style={{ whiteSpace: 'normal', lineHeight: '1.4', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ev.title.replace(/\[|\]/g, '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RIGHT SIDEBAR: INTELLIGENCE FEED */}
      {showHUD && (
        <div className="absolute top-48 right-6 w-80 bottom-6 flex flex-col gap-4 pointer-events-auto z-40">

          {/* Detail Panel overlay */}
          <div className={`transition-all duration-300 transform ${selectedEvent ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 hidden'}`}>
            {selectedEvent && (
              <div className="glass-panel p-6" style={{ borderColor: severityColors[selectedEvent.severity] }}>
                <div className="flex justify-between items-start mb-4">
                  <span className={`text-xs font-bold px-3 py-1 rounded bg-black/50 border`} style={{ color: severityColors[selectedEvent.severity], borderColor: severityColors[selectedEvent.severity] }}>
                    CLASS: {selectedEvent.severity}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1"><Terminal className="w-3 h-3" /> {new Date(selectedEvent.timestamp).toLocaleTimeString()}</span>
                </div>

                <h3 className="text-lg font-bold mt-2 text-white leading-tight font-mono break-all line-clamp-4">{selectedEvent.title.replace(/\[|\]/g, '')}</h3>
                <p className="text-sm text-gray-400 mt-4 leading-relaxed tracking-wide lowercase line-clamp-6">{selectedEvent.description}</p>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-gray-500">
                  <span className="flex items-center gap-2"><MapIcon className="w-4 h-4 text-[#00f0ff]" /> LOC_REF: {selectedEvent.lat.toFixed(4)}, {selectedEvent.lng.toFixed(4)}</span>
                  <span className="flex items-center gap-2 uppercase"><ExternalLink className="w-4 h-4" /> SRC: {selectedEvent.source}</span>
                </div>

                <button
                  onClick={() => setSelectedEvent(null)}
                  className="w-full mt-6 py-3 font-mono text-xs border border-white/20 hover:border-[#00f0ff] hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 rounded bg-transparent transition-all"
                >
                  CLOSE INTERCEPT
                </button>
              </div>
            )}
          </div>

          {/* Live Event Stream */}
          <div className="glass-panel flex-1 flex flex-col h-full !bg-black/80">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-bold flex items-center gap-3 text-sm tracking-widest text-[#00f0ff] hud-text">
                <Zap className="w-4 h-4" /> LIVE INTEL FEED
              </h3>
              <span className="text-[10px] bg-[#00f0ff]/20 text-[#00f0ff] px-2 py-0.5 rounded-full font-mono">{filteredEvents.length} DATA PKTS</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {[...filteredEvents].reverse().map(event => (
                <div
                  key={event.id}
                  onClick={() => {
                    setSelectedEvent(event);
                    globeRef.current.pointOfView({ lat: event.lat, lng: event.lng, altitude: 0.8 }, 1500);
                  }}
                  className={`p-4 border border-white/5 hover:border-white/30 bg-white/5 hover:bg-white/10 rounded cursor-pointer transition-all border-l-4 group relative overflow-hidden`}
                  style={{ borderLeftColor: severityColors[event.severity] }}
                >
                  <div className="absolute top-0 right-0 w-8 h-8 opacity-10 group-hover:opacity-30 transition-opacity" style={{ backgroundColor: severityColors[event.severity] }}></div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] tracking-widest font-bold" style={{ color: severityColors[event.severity] }}>
                      {event.source} // {event.severity}
                    </span>
                    <span className="text-[9px] font-mono text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-gray-100 uppercase tracking-widest line-clamp-2 leading-relaxed break-all">{event.title.replace(/\[|\]/g, '')}</p>
                </div>
              ))}
              {filteredEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-[#00f0ff] text-opacity-50 text-xs gap-3">
                  <Radar className="w-8 h-8 animate-spin" />
                  LISTENING FOR SIGNALS...
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
