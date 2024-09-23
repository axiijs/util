
// 控制能力
//  1. 同时能有多少个
//  2. 超出限制的时候，创建新的时候是等待还是覆盖？
//  3. 覆盖的哪一个？

// 默认都可以取消，用户在 UI 上去做限制就行了。
import {atom, Atom, computed, once, RxList} from "data0";


export const STATUS_PENDING= -1
export const STATUS_PROCESSING= 1
export const STATUS_SUCCESS= 2
export const STATUS_ERROR= 3
export const STATUS_ABORT= 4
export type STATUS_TYPE = typeof STATUS_PENDING |typeof STATUS_PROCESSING | typeof STATUS_SUCCESS | typeof STATUS_ERROR | typeof STATUS_ABORT


export type RunFN<T> = (this:T, ...args:any[]) => any


function withResolvers<T>() {
    let deferred: {
        promise: Promise<T>;
        resolve: (value: T | PromiseLike<T>) => void;
        reject: (reason: any) => void;
    } = {} as any;

    deferred.promise = new Promise<T>((resolve, reject) => {
        deferred.resolve = (data) => {
            resolve(data)
        }
        deferred.reject = reject;
    });

    return deferred;
}


export class ActionProcess<T extends RunFN<any>> {
    static id = 1
    public status: Atom<STATUS_TYPE> = atom(STATUS_PENDING)
    public data: Atom<any> = atom(null)
    public progress: Atom<any> = atom(null)
    public error: Atom<any> = atom(null)
    // @ts-ignore
    public resolvers = withResolvers() as {promise:Promise<any>, resolve:(data:any)=>void, reject:(e:any)=>void}
    public id: number
    public fn: RunFN<ActionProcess<T>>
    public abortCallbacks = new Set<() => any>()
    constructor(fn:T, public args: Parameters<T>) {
        this.fn = fn.bind(this, ...this.args)
        this.id = ActionProcess.id++
    }
    start = async () => {
        if (this.status.raw !== STATUS_PENDING) {
            throw new Error('ActionProcess is already started')
        }
        this.status(STATUS_PROCESSING)
        let data:any = undefined
        try {
            data = await this.fn()
            // @ts-ignore
            if (this.status.raw !== STATUS_ABORT) {
                this.data(data)
                this.status(STATUS_SUCCESS)
                this.resolvers.resolve(data)
            }
        } catch (e) {
            this.error(e)
            this.status(STATUS_ERROR)
            this.resolvers.reject(e)
        }
    }
    abort() {
        if(this.status.raw === STATUS_PENDING || this.status.raw === STATUS_PROCESSING) {
            this.status(STATUS_ABORT)
            this.resolvers.reject(STATUS_ABORT)
            this.abortCallbacks.forEach(fn => fn())
        }
    }
    onAbort = (fn:()=>any) => {
        this.abortCallbacks.add(fn)
    }
}

type ActionClassOptions = {
    // parallel limit, 1 的时候就是串行
    parallelLimit?: number
    pending?: {
        replace?: boolean,
        replaceOldest?: boolean
    }
    // 保存历史
    historyLimit? :number,

}

export class Action<T extends RunFN<any>> {
    public processes: RxList<ActionProcess<T>> = new RxList<ActionProcess<T>>([])
    public pendingProcesses: RxList<ActionProcess<T>> = this.processes.filter(p => {
        return p.status() === STATUS_PENDING
    })
    public processingProcesses: RxList<ActionProcess<T>> = this.processes.filter(p => {
        return p.status() === STATUS_PROCESSING
    })
    public completedProcesses: RxList<ActionProcess<T>> = this.processes.filter(p => {
        return p.status() > STATUS_PROCESSING
    })
    resolvers?: {promise:Promise<any>, resolve:()=>void, reject:()=>void}
    public promise: Atom<Promise<any>|null> = atom(null)
    constructor(public fn: T, public options: ActionClassOptions = {}) {

    }
    run = (...args: Parameters<T>) => {
        const process = new ActionProcess<T>(this.fn, args)

        this.processes.push(process)
        if (!this.promise.raw) {
            this.start()
        }
        return process
    }
    start = async () => {
        if(this.promise.raw) {
            return this.promise.raw
        }

        const {
            parallelLimit = Infinity,
            pending = { replace: true, replaceOldest: true},
            historyLimit = 1
        } = this.options

        const {promise, resolve} = withResolvers()
        this.promise(promise)


        // FIXME 对于 replace 的情况应该在这里判断，不能在上面  run 的地方判断，
        //  因为  once promise then 中执行，可能有新的 run 的会后，上一个还没启动，但是确定了要启动。
        once(() => {
            // 删掉已经完成的，从头删除超过 historyLimit 的
            if (this.completedProcesses.data.length > historyLimit) {
                this.processes.splice(0, this.completedProcesses.data.length - historyLimit)
            }

            // watch pendingProcesses & dispose length change
            if (this.pendingProcesses.length()) {

                // 超过了能同时处理的数量限制，如果是 replace 就要把之前的 abort 掉
                if (this.processingProcesses.data.length >= parallelLimit) {
                    if (pending.replace) {
                        const toReplace = this.processingProcesses.data.at(pending.replaceOldest? 0 : -1)!
                        toReplace.abort()
                    }
                }

                if(this.processingProcesses.length() < parallelLimit) {
                    const process = this.pendingProcesses.data.at(0)!
                    // CAUTION 一定要放到下个 tick，不然会这里就会立刻触发上面的 length 变化，然后 once 又触发。
                    //  data0逻辑里面已经 recomputing 的 computed 遇到重算会认为是依赖脏了，于是直接重算，不会再次 schedule。
                    process.start()
                }
            } else {
                if (!this.processingProcesses.length()) {
                    resolve(null)
                    this.promise(null)
                    // 撤销 once
                    return true
                }
            }
        })

        return promise
    }
    get latest() {
        return computed<ActionProcess<T>>(() => this.processes.data.at(this.processes.length()-1))
    }
}

export class SerialAction<T extends (...args:any[]) => any> extends Action<T>{
    constructor(public fn: T, options:Omit<ActionClassOptions, 'parallelLimit'> = {}) {
        super(fn, {...options, parallelLimit: 1, pending: { replace: false}})
    }
}

export class SingleAction<T extends (...args:any[]) => any> extends Action<T>{
    constructor(public fn: T, options:Omit<ActionClassOptions, 'parallelLimit'> = {}) {
        super(fn, {...options, parallelLimit: 1, pending: { replace: true}})
    }
}

