
export type PromiseWrapped<T> = T extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T;

export type PromiseWrappedClass<T> = {
    [K in keyof T]: T[K] extends Function ? PromiseWrapped<T[K]> : never;
};

type MessageData = {
    id:string,
    method: string,
    args: any[]
}

type MessageReturnData = {
    id: string,
    result: any
}

function withResolver<T>() {
    let resolve:any
    let reject:any
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

type Resolver<T> = {
    promise: Promise<T>,
    resolve: Function,
    reject: Function
}

// TODO 超时设置?
export function createWorkerClient<T>(worker: Worker): PromiseWrappedClass<T> {
    const resolvers =  new Map<string, Resolver<MessageReturnData>>

    worker.onmessage = function(event) {
        if (typeof event.data !== 'object') return

        const data = event.data as MessageReturnData;
        const {id, result} = data;
        if (!id) return

        const resolver = resolvers.get(id);
        if (resolver) {
            resolver.resolve(result);
            resolvers.delete(id);
        } else {
            console.warn(`${id} resolver not found`)
        }
    }


    return new Proxy({}, {
        get(target, prop) {
            return async (...args: any[]) => {
                const id = Math.random().toString(36).slice(2);
                worker.postMessage({ id, method: prop, args } as MessageData);
                const resolver = withResolver<MessageReturnData>()
                resolvers.set(id, resolver);
                return resolver.promise
            }
        }
    }) as PromiseWrappedClass<T>
}

export function createWorkerHost(delegator:any) {
    self.onmessage = async (event: MessageEvent) => {
        if (typeof event.data !== 'object') return

        const { data } = event;
        const { id, method, args} = data as MessageData
        if (!id || !method) {
            console.warn('invalid message', data)
            return
        } else {
            console.log(`calling ${method} with`, args)
        }

        const result = await delegator[method](...args);
        self.postMessage({ id, result});

    };
}
