import type {
    NextFunction,
    Request,
    RequestHandler,
    Response,
    Router
} from "express";

type RouteMethod = "get" | "post" | "put" | "patch" | "delete";

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
