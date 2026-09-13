import type {
    NextFunction,
    Request,
    RequestHandler,
    Response,
    Router
} from "express";
import { admin, assistant, auth, mod } from "../Util/Middleware/permissions.ts";

type RouteMethod = "get" | "post" | "put" | "patch" | "delete";

/** Middleware that sends logged-out users to login, so req.user is set after it */
const LOGIN_MIDDLEWARE = new Set<RequestHandler>([auth, mod, assistant, admin]);

export abstract class PathRoute<T extends RouteMethod> {
    public method: T;
    public path: string;
    public handlers: Array<RequestHandler>;

    constructor(method: T, path: string, handlers: Array<RequestHandler>) {
        this.method = method;
        this.path = path;
        this.handlers = handlers;
    }

    // Handlers may be sync or async. Sync ones must stay sync: Express 4
    // forwards a thrown error to the error handler, but not a rejected promise.
    abstract handle(
        req: Request,
        res: Response,
        next: NextFunction
    ): unknown | Promise<unknown>;

    register(router: Router) {
        const routeHandler: RequestHandler[] = [
            ...this.handlers,
            this.handle.bind(this)
        ];
        router[this.method](this.path, routeHandler);
        console.log(
            `${this.method.toUpperCase()} ${this.path} registered with ${routeHandler.length} handlers!`
        );
    }
}

/**
 * A route whose middleware chain logs the user in first (`auth`, or a rank
 * check like `mod`), so `req.user` is always set by the time handle() runs.
 */
export abstract class AuthedPathRoute<
    T extends RouteMethod
> extends PathRoute<T> {
    constructor(method: T, path: string, handlers: Array<RequestHandler>) {
        super(method, path, handlers);
        // Fail at startup, not on a logged-out request, if the chain can't
        // guarantee req.user.
        if (!handlers.some((handler) => LOGIN_MIDDLEWARE.has(handler)))
            throw new Error(
                `${method.toUpperCase()} ${path}: an AuthedPathRoute needs auth, mod, assistant or admin in its middleware`
            );
    }

    abstract override handle(
        req: AuthedRequest,
        res: Response,
        next: NextFunction
    ): unknown | Promise<unknown>;
}
