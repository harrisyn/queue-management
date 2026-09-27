import type { NextApiRequest, NextApiResponse } from 'next';
import app from '@/server/app';

// The whole REST API (/api/v1/*) is the Express app in src/server, mounted
// here so it deploys with the web app. A Pages Router API route (rather than
// an App Router route handler) is used because it receives Node's native
// req/res, which Express, multer and raw-body webhook verification need.
export const config = {
  api: {
    bodyParser: false, // Express parses (and webhooks need the raw body)
    externalResolver: true, // Express ends the response, not Next
    responseLimit: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return new Promise<void>((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    app(req as any, res as any);
  });
}
