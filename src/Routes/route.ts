import type { RequestHandlerParams, RouteParameters } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import e, {
    type Handler,
    type NextFunction,
    type Request,
    type RequestHandler,
    type Response,
    type Router
} from "express";

type RouteMethod = "get" | "post" | "put" | "patch" | "delete";

type HandlerMap<T extends RouteMethod> = `handle_${T}`;

export abstract class PathRoute<T extends RouteMethod> {

    public method: RouteMethod;
    public path: string;
    public handlers: Array<RequestHandler>;


    constructor(method: T, path: string, handlers: Array<RequestHandler>) {
        this.method = method;
        this.path = path;
        this.handlers = handlers;
    }

    abstract handle(req: Request, res: Response, next: NextFunction): Promise<void>;

    register(router: Router) {
        const routeHandler: RequestHandler[] = [...this.handlers, this.handle];
        (router as any)[this.method](this.path, routeHandler);
    }

}
