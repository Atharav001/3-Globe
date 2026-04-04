import FirecrawlApp from '@mendable/firecrawl-js';

const app = new FirecrawlApp({ apiKey: "--Inavtive--" });

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
