import FirecrawlApp from '@mendable/firecrawl-js';

const app = new FirecrawlApp({ apiKey: "fc-a319405f58ee41b8a20b7bf0fc3bc66f" });

async function run() {
    try {
        const response = await app.scrapeUrl('https://liveuamap.com/', {
            formats: ['markdown'],
        });
        console.log(response);
    } catch (err) {
        console.error(err);
    }
}

run();
