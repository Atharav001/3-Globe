# 🌍 THREAT MONITOR: Live Geopolitical Risk Dashboard

![Live Geopolitical Risk Dashboard](https://img.shields.io/badge/Status-Active-success)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)
![Data](https://img.shields.io/badge/Data-Secure%20Intel%20Streams-orange)

A dynamic, full-stack web application featuring an immersive, highly interactive **3D rotating globe** that visualizes global threats and geopolitical risks in real time. Built with a sleek, high-density "Hacker" aesthetic—including continuous space backgrounds, dynamic centering, and anonymous encrypted data streams—the dashboard tracks and aggregates data across global events, stock fluctuations, and geographical anomalies.

## ✨ Features

- **🌐 3D Threat Map Engine**: Automatically updates risk levels for countries based on real-time data feeds, represented through an intuitive color-coded threat map with a dynamically generated infinite starfield background.
- **🔍 Stream Intercepts**: Watch real-time "Intel Stream" packets flow in through the right-side feed, maintaining an anonymous, secure-channel aesthetic.
- **⏳ Timeline Slider**: A historical playback slider enabling users to view the evolution and escalation of geopolitical events over hours, days, or weeks.
- **📊 Global Risk Index**: An aggregated DEFCON/Elevated warning system that adapts based on the critical and high-severity data points flowing into the system.
- **🎯 Intelligent Camera Tracking**: Instantly fly and zoom the 3D globe to any specific country, region, or conflict zone using the integrated search bar, with the globe perfectly centered mathematically in the viewport.
- **🛡️ "THE WALL" Integrations**: Placeholder architecture for mounting live webcams, Sentinel-2 imagery, and OSINT scrapers directly to the side panel ecosystem.

## 🚀 Tech Stack

### Frontend
- **Framework**: React / Vite
- **Styling**: Tailwind CSS & Vanilla CSS (for cinematic scanlines and vignettes)
- **Visualization**: React Globe.gl (3D engine)

### Backend
- **Environment**: Node.js & Express
- **Language**: TypeScript
- **Data APIs**: Firecrawl API for intelligent web scraping and live data feeds.

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation

1. **Clone the project:**
   ```bash
   git clone https://github.com/Atharav001/3-Globe.git
   cd 3-Globe
   ```

2. **Setup the Backend:**
   ```bash
   cd backend
   npm install
   # Add your environment variables (e.g. FIRECRAWL_API_KEY) to a .env file
   npm start
   ```

3. **Setup the Frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

4. **Explore the Dashboard:**
   Open `http://localhost:5173` to interact with the globe.

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
