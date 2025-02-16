import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import settings from "../settings.json" with { type: "json" };

if (!settings.website.dev) {
    Sentry.init({
        dsn: settings.secrets.sentry,
        integrations: [
          nodeProfilingIntegration(),
        ],
        release: "website@" + process.env.npm_package_version,
        environment: "production",
        // Tracing
        tracesSampleRate: 0.1, //  Capture 10% of the transactions
        profilesSampleRate: 0.1 // Set sampling rate for profiling - this is relative to tracesSampleRate
    });
}