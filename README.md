# 🌍 Live Geopolitical Risk Dashboard

![Live Geopolitical Risk Dashboard](https://img.shields.io/badge/Status-Active-success)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)
![Data](https://img.shields.io/badge/Data-Firecrawl%20API-orange)

A dynamic, full-stack web application featuring a highly interactive **3D rotating globe** that visualizes global threats and geopolitical risks in real time. Powered by the Firecrawl API, the dashboard continuously tracks and aggregates data across global news, stock fluctuations, and flight radar blogs.

## ✨ Features

- **🌐 3D Threat Map**: Automatically updates risk levels for countries based on real-time data feeds, represented through an intuitive color-coded threat map.
- **🔍 Interactive Drill-Downs**: Click on any country to reveal an detailed sidebar explaining the context behind its risk level—displaying live news headlines, defense stock ticker movements, and flight data anomalies.
- **⏳ Timeline Slider**: A historical playback slider enabling users to view the evolution and escalation of geopolitical events over days, weeks, or months.
- **📊 Custom Data Layers**: Seamlessly toggle between different data streams (e.g., News Sentiment only, Defense Stocks only) or visualize the aggregated combined threat level.
- **🎯 Search & Quick Zoom**: Instantly fly and zoom the 3D globe to any specific country, region, or conflict zone using the integrated search bar.

## 🚀 Tech Stack

### Frontend
- **Framework**: React / Vite
- **Styling**: Tailwind CSS
- **Visualization**: React Globe.gl (or similar 3D globe library)

### Backend
- **Environment**: Node.js & Express
- **Language**: TypeScript
- **Data APIs**: Firecrawl API for intelligent web scraping and live data feeds.

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Firecrawl API Key

### Installation

1. **Clone the project:**
   ```bash
   git clone https://github.com/your-username/live-geopolitical-risk-dashboard.git
   cd live-geopolitical-risk-dashboard
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
