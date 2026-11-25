/* Serves ai-business-mindset.mp4 by stitching two part files byte-for-byte.
   The original file is 138,345,277 bytes, above GitHub Pages' per-file
   serving limit, so it is stored as two parts and reassembled here. */
const PARTS = ['ai-business-mindset.mp4.part1', 'ai-business-mindset.mp4.part2'];
const SIZES = [69200000, 69145277];
const TOTAL = 138345277;
const TYPE = 'video/mp4';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function partRange(start, end) {
  // returns [partIndex, localStart, localEnd] segments covering [start, end]
  const segs = [];
  let off = 0;
  for (let i = 0; i < PARTS.length; i++) {
    const pStart = off, pEnd = off + SIZES[i] - 1;
    if (end >= pStart && start <= pEnd) {
      segs.push([i, Math.max(start, pStart) - off, Math.min(end, pEnd) - off]);
    }
    off += SIZES[i];
  }
  return segs;
}

async function stitch(start, end) {
  const segs = partRange(start, end);
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const [i, s, e] of segs) {
          const res = await fetch(PARTS[i], { headers: { Range: `bytes=${s}-${e}` } });
          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  return stream;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith('/ai-business-mindset.mp4')) return;
  if (event.request.method === 'HEAD') {
    event.respondWith(new Response(null, {
      headers: { 'Content-Type': TYPE, 'Content-Length': String(TOTAL), 'Accept-Ranges': 'bytes' },
    }));
    return;
  }
  const range = event.request.headers.get('range');
  event.respondWith((async () => {
    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range);
      if (m) {
        const start = Number(m[1]);
        const end = m[2] ? Math.min(Number(m[2]), TOTAL - 1) : TOTAL - 1;
        const body = await stitch(start, end);
        return new Response(body, {
          status: 206,
          headers: {
            'Content-Type': TYPE,
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${TOTAL}`,
            'Accept-Ranges': 'bytes',
          },
        });
      }
    }
    const body = await stitch(0, TOTAL - 1);
    return new Response(body, {
      headers: { 'Content-Type': TYPE, 'Content-Length': String(TOTAL), 'Accept-Ranges': 'bytes' },
    });
  })());
});
