import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import Firecrawl from '@mendable/firecrawl-js';

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

// Initialize Firecrawl App
const firecrawl = new Firecrawl({ apiKey: "fc-a319405f58ee41b8a20b7bf0fc3bc66f" });

export interface ThreatEvent {
    id: string;
    source: string;
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    lat: number;
    lng: number;
    timestamp: string;
}

const recentEvents: ThreatEvent[] = [];

// Synthetic Event Generator for Live Demo Purposes
function generateRandomEvent(): ThreatEvent {
    const sources = ["FlightRadar", "Reuters", "DefenseTicker", "OSINT"];
    const severities: ("low" | "medium" | "high" | "critical")[] = ["low", "low", "medium", "high", "critical"];

    const regions = [
        { name: "Middle East", lat: 33, lng: 44, spread: 15 },
        { name: "Eastern Europe", lat: 48, lng: 31, spread: 10 },
        { name: "South China Sea", lat: 15, lng: 115, spread: 10 },
        { name: "North America", lat: 40, lng: -100, spread: 20 },
    ];

    const region = regions[Math.floor(Math.random() * regions.length)];
    const lat = region.lat + (Math.random() - 0.5) * region.spread;
    const lng = region.lng + (Math.random() - 0.5) * region.spread;

    const titles = [
        "Unidentified Aircraft Intercepted",
        "Naval Exercise Commenced",
        "Oil Price Spike Detected",
        "Defense Contractor Stock Surges 5%",
        "Cyber Attack on Power Grid Reported",
        "Troop Movements Detected via Commercial Satellite",
        "Diplomatic Talks Stall Unexpectedly"
    ];
    const severity = severities[Math.floor(Math.random() * severities.length)];

    return {
        id: Math.random().toString(36).substring(7),
        source: sources[Math.floor(Math.random() * sources.length)],
        title: titles[Math.floor(Math.random() * titles.length)],
        description: `Automated scanner detected activity matching ${severity} severity parameters.`,
        severity,
        lat,
        lng,
        timestamp: new Date().toISOString()
    };
}

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    // Send recent events to new clients
    socket.emit('initial-events', recentEvents.slice(-20));

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Periodic scraping process
setInterval(async () => {
    let newEvent: ThreatEvent | null = null;

    try {
        // TEMPORARILY DISABLED TO PREVENT CREDIT CONSUMPTION
        /*
        console.log("Scraping liveuamap via Firecrawl...");
        const result = await firecrawl.scrape('https://liveuamap.com/', {
            formats: ['markdown']
        }) as any;

        const markdown = result.markdown || result.data?.markdown || "";

        // Simple regex to extract headers or list items as news titles
        const titles = markdown.match(/^(?:#+|\*|-)\s+(.*)/gm)
            ?.map((t: string) => t.replace(/^(?:#+|\*|-)\s+/, '').trim())
            .filter((t: string) => t.length > 20 && t.length < 150) || [];

        if (titles.length > 0) {
            // Pick a random recent title
            const pickedTitle = titles[Math.floor(Math.random() * Math.min(titles.length, 10))];
            newEvent = generateRandomEvent();
            newEvent.title = pickedTitle; // Inject real title!
            newEvent.description = `Firecrawl scraped this event directly. Live Data.`;
            newEvent.source = "LiveUAMap";
        } else {
            console.log("No valid titles found, falling back to generated.");
            newEvent = generateRandomEvent();
        }
        */
        console.log("Scraping API disabled to save credits. Generating synthetic intel package...");
        newEvent = generateRandomEvent();
    } catch (err) {
        console.error("Scraping error:", err);
        newEvent = generateRandomEvent();
    }

    if (newEvent) {
        recentEvents.push(newEvent);
        if (recentEvents.length > 100) recentEvents.shift();
        io.emit('new-event', newEvent);
        console.log(`[Event Generated] ${newEvent.severity.toUpperCase()} - ${newEvent.title}`);
    }

}, 300000); // Changed to 5 minutes (300,000ms) to drastically save API credits

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Geopolitical Risk Backend running on port ${PORT}`);
});
