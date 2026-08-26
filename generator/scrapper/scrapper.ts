import * as https from 'https';
import { WikiPage } from '../wiki_types';

// HTTP layer for wiki.facepunch.com, only wiki:sync uses it, the generator reads the local mirror.
// Wait for the response `end` event and NOT the socket `close`, close fires with a truncated body

const agent = new https.Agent({ maxSockets: 8, keepAlive: true });

const HOST = 'wiki.facepunch.com';
const RETRIES = 4;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(options: https.RequestOptions, body?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const req = https.request({ hostname: HOST, agent, ...options }, (res) => {
            let response = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => (response += chunk));
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(
                        new Error(`HTTP ${res.statusCode} for ${options.method} ${options.path}`)
                    );
                    return;
                }
                resolve(response);
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(30_000, () =>
            req.destroy(new Error(`timeout for ${options.method} ${options.path}`))
        );
        if (body !== undefined) req.write(body);
        req.end();
    });
}

async function requestJson<T>(options: https.RequestOptions, body?: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
        try {
            const text = await request(options, body);
            try {
                return JSON.parse(text) as T;
            } catch {
                throw new Error(
                    `invalid JSON (${text.length} bytes) for ${options.method} ${options.path}`
                );
            }
        } catch (err) {
            lastError = err;
            await delay(500 * 2 ** attempt);
        }
    }
    throw lastError;
}

// URL paths as the wiki gives them, still encoded, /gmod/Panel%3ASetContentAlignment
export async function GetPagesInCategory(category: string): Promise<string[]> {
    const bodyStr = JSON.stringify({
        text: `<pagelist category="${category}"></pagelist>`,
        realm: 'gmod',
    });

    const responseObj = await requestJson<{ status: string; html: string; title: string }>(
        {
            path: '/api/page/preview',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
            },
        },
        bodyStr
    );

    if (responseObj.status !== 'ok') {
        throw new Error(
            `pagelist for category "${category}" returned status ${responseObj.status}`
        );
    }

    return [...responseObj.html.matchAll(/href="(.*?)"/g)].map((m) => m[1]);
}

export async function GetPage(urlPath: string): Promise<WikiPage> {
    return requestJson<WikiPage>({ path: `${urlPath}?format=json`, method: 'GET' });
}
